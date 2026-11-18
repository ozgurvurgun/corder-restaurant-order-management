import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { TableService } from '../table.service';
import { OrderQueryService } from './order-query.service';

export interface MoveItemsToTableInput {
  fromTableId: string;
  toTableId: string;
  items: Array<{ itemId: string; quantity?: number }>;
  userId?: string | null;
  actorDisplayName?: string | null;
}

interface MovedItemSnapshot {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  note?: string;
}

@Injectable()
export class TransferOrderUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly tableService: TableService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  private async lockTablesInDeterministicOrder(
    em: EntityManager,
    restaurantId: string,
    fromTableId: string,
    toTableId: string,
  ): Promise<{ fromTable: TableEntity; toTable: TableEntity }> {
    const sortedIds = [fromTableId, toTableId].sort();
    const lockedById = new Map<string, TableEntity>();
    for (const tableId of sortedIds) {
      const table = await em.findOne(TableEntity, {
        where: { id: tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) {
        throw new NotFoundException('Table not found');
      }
      lockedById.set(tableId, table);
    }
    return {
      fromTable: lockedById.get(fromTableId)!,
      toTable: lockedById.get(toTableId)!,
    };
  }

  private applyTargetTableStateOnFullMove(
    fromTable: TableEntity,
    toTable: TableEntity,
    isMergeIntoOccupied: boolean,
  ): boolean {
    let changed = false;
    if (fromTable.discount && !toTable.discount) {
      toTable.discount = fromTable.discount;
      changed = true;
    }
    if (isMergeIntoOccupied) {
      if (toTable.splitInfo && !toTable.splitInfo.paidShares?.length) {
        toTable.splitInfo = null;
        changed = true;
      }
    } else if (fromTable.splitInfo && !toTable.splitInfo) {
      toTable.splitInfo = fromTable.splitInfo;
      changed = true;
    }
    if (toTable.status === 'empty') {
      toTable.status = 'occupied';
      changed = true;
    }
    return changed;
  }

  async moveTable(
    restaurantId: string,
    fromTableId: string,
    toTableId: string,
    actorStaffId?: string | null,
  ): Promise<{ moved: number }> {
    if (fromTableId === toTableId) return { moved: 0 };
    await this.cashShiftService.requireCurrent(restaurantId);

    const moved = await this.dataSource.transaction(async (em) => {
      const { fromTable, toTable } = await this.lockTablesInDeterministicOrder(
        em,
        restaurantId,
        fromTableId,
        toTableId,
      );
      if (fromTable.status === 'checkout' || toTable.status === 'checkout') {
        throw new BadRequestException('Cannot transfer a table that is in checkout');
      }
      this.tableService.assertStaffMayUseTable(fromTable, actorStaffId);
      this.tableService.assertTableFreeForMergeOrMove(toTable, actorStaffId);

      const activeOrders = await em.find(OrderEntity, {
        where: { restaurantId, tableId: fromTableId, status: 'active' },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeOrders.length === 0) {
        return 0;
      }

      const existingTargetOrders = await em.count(OrderEntity, {
        where: { restaurantId, tableId: toTableId, status: 'active' },
      });

      await em.update(
        OrderEntity,
        { id: In(activeOrders.map((o) => o.id)), restaurantId },
        { tableId: toTableId, updatedAt: new Date() },
      );

      if (this.applyTargetTableStateOnFullMove(fromTable, toTable, existingTargetOrders > 0)) {
        await em.save(TableEntity, toTable);
      }

      fromTable.markEmpty();
      await em.save(TableEntity, fromTable);
      return activeOrders.length;
    });

    if (moved > 0) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
      this.ordersGateway.emitOrdersMoved(restaurantId, { fromTableId, toTableId });
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }
    return { moved };
  }

  private async takeSelectedQuantitiesAndPruneSourceOrders(
    em: EntityManager,
    restaurantId: string,
    uniqueIds: string[],
    itemById: Map<string, OrderItemEntity>,
    qtyByItemId: Map<string, number | undefined>,
    affectedOrderIds: string[],
    now: Date,
  ): Promise<MovedItemSnapshot[]> {
    const snapshots: MovedItemSnapshot[] = [];
    for (const id of uniqueIds) {
      const src = itemById.get(id)!;
      const taken = src.takeQuantity(qtyByItemId.get(id));
      snapshots.push({
        productId: src.productId,
        productName: src.productName,
        price: Number(src.price),
        quantity: taken.quantity,
        note: src.note ?? undefined,
      });
      if (taken.full) {
        await em.delete(OrderItemEntity, { id });
      } else {
        await em.save(OrderItemEntity, src);
      }
    }

    for (const oid of affectedOrderIds) {
      const remainingItems = await em.find(OrderItemEntity, { where: { orderId: oid } });
      if (remainingItems.length === 0) {
        await em.delete(OrderEntity, { id: oid, restaurantId });
      } else {
        const nextStatus = OrderStatusPolicy.resolveOrderStatus(remainingItems);
        await em.update(
          OrderEntity,
          { id: oid, restaurantId },
          { status: nextStatus, updatedAt: now },
        );
      }
    }
    return snapshots;
  }

  private async reconcileTablesAfterItemTransfer(
    em: EntityManager,
    restaurantId: string,
    fromTable: TableEntity,
    toTable: TableEntity,
  ): Promise<boolean> {
    const remainingSourceOrders = await em.count(OrderEntity, {
      where: { restaurantId, tableId: fromTable.id, status: 'active' },
    });
    let fromTableEmptied = false;
    if (remainingSourceOrders === 0) {
      fromTable.markEmpty();
      await em.save(TableEntity, fromTable);
      fromTableEmptied = true;
    } else if (fromTable.splitInfo && !fromTable.splitInfo.paidShares?.length) {
      fromTable.splitInfo = null;
      await em.save(TableEntity, fromTable);
    }

    if (
      toTable.status === 'empty' ||
      (toTable.splitInfo && !toTable.splitInfo.paidShares?.length)
    ) {
      if (toTable.status === 'empty') toTable.status = 'occupied';
      if (toTable.splitInfo && !toTable.splitInfo.paidShares?.length) {
        toTable.splitInfo = null;
      }
      await em.save(TableEntity, toTable);
    }
    return fromTableEmptied;
  }

  async moveItemsToTable(
    restaurantId: string,
    dto: MoveItemsToTableInput,
  ): Promise<Record<string, unknown>> {
    const { fromTableId, toTableId } = dto;
    const selection = this.normalizeMoveSelection(dto.items);
    const uniqueIds = selection.map((s) => s.itemId).sort();
    if (fromTableId === toTableId) {
      throw new BadRequestException('Cannot move items to the same table');
    }
    await this.cashShiftService.requireCurrent(restaurantId);

    const { newOrderId, fromTableEmptied } = await this.dataSource.transaction(async (em) => {
      const { fromTable, toTable } = await this.lockTablesInDeterministicOrder(
        em,
        restaurantId,
        fromTableId,
        toTableId,
      );
      if (fromTable.status === 'checkout' || toTable.status === 'checkout') {
        throw new BadRequestException('Cannot move items from or to a table in checkout');
      }
      this.tableService.assertStaffMayUseTable(fromTable, dto.userId ?? null);
      this.tableService.assertStaffMayUseTable(toTable, dto.userId ?? null);

      const sourceOrders = await em.find(OrderEntity, {
        where: { restaurantId, tableId: fromTableId, status: 'active' },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (sourceOrders.length === 0) {
        throw new BadRequestException('No active orders found on source table');
      }
      const sourceOrderById = new Map(sourceOrders.map((o) => [o.id, o]));

      const items = await em.find(OrderItemEntity, {
        where: { id: In(uniqueIds), orderId: In(sourceOrders.map((o) => o.id)) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length !== uniqueIds.length) {
        throw new BadRequestException('One or more order items were not found on this table');
      }

      for (const item of items) {
        item.order = sourceOrderById.get(item.orderId)!;
        OrderStatusPolicy.assertItemTransferable(item, restaurantId, fromTableId);
      }

      const affectedOrderIds = [...new Set(items.map((i) => i.orderId))].sort();
      const affectedOrders = affectedOrderIds.map((oid) => sourceOrderById.get(oid)!);
      const newUserId = (dto.userId ?? items[0].order?.userId ?? null)?.trim() || null;
      const moverName = await this.resolveMoverDisplayName(
        em,
        restaurantId,
        newUserId,
        dto.actorDisplayName,
      );

      const now = new Date();
      const movedSnapshots = await this.takeSelectedQuantitiesAndPruneSourceOrders(
        em,
        restaurantId,
        uniqueIds,
        new Map(items.map((i) => [i.id, i])),
        new Map(selection.map((s) => [s.itemId, s.quantity])),
        affectedOrderIds,
        now,
      );

      const isFromTableEmpty = await this.reconcileTablesAfterItemTransfer(
        em,
        restaurantId,
        fromTable,
        toTable,
      );

      const savedOrder = await em.save(
        OrderEntity,
        em.create(OrderEntity, {
          restaurantId,
          tableId: toTableId,
          userId: newUserId,
          userDisplayName: moverName,
          status: 'active',
          mergedFrom: (fromTable.name ?? '').trim() || fromTableId,
          kitchenTicketPrintedAt: affectedOrders.every((o) => o.kitchenTicketPrintedAt != null)
            ? now
            : null,
        }),
      );
      await em.save(
        OrderItemEntity,
        movedSnapshots.map((src) =>
          em.create(OrderItemEntity, {
            orderId: savedOrder.id,
            productId: src.productId,
            productName: src.productName,
            price: src.price,
            quantity: src.quantity,
            note: src.note,
            status: 'sent',
          }),
        ),
      );
      return { newOrderId: savedOrder.id, fromTableEmptied: isFromTableEmpty };
    });

    if (fromTableEmptied) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
    }
    const serialized = await this.orderQuery.serializeOrderEntityById(newOrderId, restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return serialized;
  }

  private async resolveMoverDisplayName(
    em: EntityManager,
    restaurantId: string,
    userId: string | null,
    actorDisplayName?: string | null,
  ): Promise<string | null> {
    const explicit = (actorDisplayName ?? '').trim();
    if (explicit) return explicit;
    if (!userId) return null;
    const staff = await em.findOne(RestaurantStaffEntity, {
      where: { id: userId, restaurantId },
    });
    return staff?.name?.trim() || null;
  }

  private normalizeMoveSelection(
    items: Array<{ itemId: string; quantity?: number }>,
  ): Array<{ itemId: string; quantity?: number }> {
    const seen = new Set<string>();
    const out: Array<{ itemId: string; quantity?: number }> = [];
    for (const line of items ?? []) {
      const id = (line.itemId ?? '').trim();
      if (!id) continue;
      if (seen.has(id)) {
        throw new BadRequestException('Duplicate order item in move selection');
      }
      seen.add(id);
      out.push({
        itemId: id,
        ...(line.quantity != null ? { quantity: line.quantity } : {}),
      });
    }
    if (out.length === 0) {
      throw new BadRequestException('No order items selected to move');
    }
    return out;
  }
}
