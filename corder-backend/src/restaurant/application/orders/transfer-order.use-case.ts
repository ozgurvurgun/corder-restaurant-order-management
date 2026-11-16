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
  itemIds: string[];
  userId?: string | null;
  actorDisplayName?: string | null;
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

  async moveTable(
    restaurantId: string,
    fromTableId: string,
    toTableId: string,
  ): Promise<{ moved: number }> {
    if (fromTableId === toTableId) return { moved: 0 };

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
      this.tableService.assertTableFreeForMergeOrMove(toTable);

      const activeOrders = await em.find(OrderEntity, {
        where: { restaurantId, tableId: fromTableId, status: 'active' },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeOrders.length === 0) {
        return 0;
      }

      const now = new Date();
      await em.update(
        OrderEntity,
        { id: In(activeOrders.map((o) => o.id)), restaurantId },
        { tableId: toTableId, updatedAt: now },
      );

      let toTableChanged = false;
      if (fromTable.discount && !toTable.discount) {
        toTable.discount = fromTable.discount;
        toTableChanged = true;
      }
      if (fromTable.splitInfo && !toTable.splitInfo) {
        toTable.splitInfo = fromTable.splitInfo;
        toTableChanged = true;
      }
      if (toTable.status === 'empty') {
        toTable.status = 'occupied';
        toTableChanged = true;
      }
      if (toTableChanged) {
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

  async moveItemsToTable(
    restaurantId: string,
    dto: MoveItemsToTableInput,
  ): Promise<Record<string, unknown>> {
    const { fromTableId, toTableId, itemIds } = dto;
    const uniqueIds = [...new Set(itemIds)].sort();
    if (fromTableId === toTableId) {
      throw new BadRequestException('Cannot move items to the same table');
    }
    await this.cashShiftService.requireCurrent(restaurantId);

    const newOrderId = await this.dataSource.transaction(async (em) => {
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

      const items = await em.find(OrderItemEntity, {
        where: { id: In(uniqueIds) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length !== uniqueIds.length) {
        throw new BadRequestException('One or more order items were not found');
      }

      const affectedOrderIds = [...new Set(items.map((i) => i.orderId))].sort();
      const orders = await em.find(OrderEntity, {
        where: { id: In(affectedOrderIds) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const orderById = new Map(orders.map((o) => [o.id, o]));

      for (const item of items) {
        item.order = orderById.get(item.orderId)!;
        OrderStatusPolicy.assertItemTransferable(item, restaurantId, fromTableId);
      }

      const fromTableLabel = (fromTable.name ?? '').trim() || fromTableId;
      const firstOrderUserId = items[0].order?.userId ?? null;
      const newUserId = (dto.userId ?? firstOrderUserId)?.trim() || null;
      const moverName =
        (dto.actorDisplayName ?? '').trim() ||
        (newUserId
          ? (
              await em.findOne(RestaurantStaffEntity, {
                where: { id: newUserId, restaurantId },
              })
            )?.name?.trim() || null
          : null);

      for (const id of uniqueIds) {
        await em.delete(OrderItemEntity, { id });
      }
      for (const oid of affectedOrderIds) {
        const remaining = await em.count(OrderItemEntity, { where: { orderId: oid } });
        if (remaining === 0) {
          await em.delete(OrderEntity, { id: oid });
        }
      }

      const order = em.create(OrderEntity, {
        restaurantId,
        tableId: toTableId,
        userId: newUserId,
        userDisplayName: moverName,
        status: 'active',
        mergedFrom: fromTableLabel,
        kitchenTicketPrintedAt: new Date(),
      });
      const savedOrder = await em.save(OrderEntity, order);
      const newRows = items.map((src) =>
        em.create(OrderItemEntity, {
          orderId: savedOrder.id,
          productId: src.productId,
          productName: src.productName,
          price: src.price,
          quantity: src.quantity,
          note: src.note ?? undefined,
          status: 'sent',
        }),
      );
      await em.save(OrderItemEntity, newRows);
      return savedOrder.id;
    });

    const serialized = await this.orderQuery.serializeOrderEntityById(newOrderId, restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return serialized;
  }
}
