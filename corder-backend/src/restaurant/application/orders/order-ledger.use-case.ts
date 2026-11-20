import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { LedgerCustomerEntity } from '../../domain/ledger-customer.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { BilledOrderLineForStock } from '../../domain/services/recipe-stock.policy';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { LedgerService } from '../ledger.service';
import { StockMovementsService } from '../stock-movements.service';
import { SESSION_LOCK_STALE_MS, TableService } from '../table.service';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import { normalizeStorageText } from '../../../common/text/text-normalizer';

interface StagedLedgerItem {
  line: { itemId: string; quantity?: number };
  item: OrderItemEntity;
  order: OrderEntity;
}

@Injectable()
export class OrderLedgerUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly ledgerService: LedgerService,
    private readonly stockMovementsService: StockMovementsService,
    @Optional()
    private readonly tableService?: TableService,
  ) {}

  private assertStaffMayUseLockedTable(
    table: TableEntity,
    actorStaffId: string | null | undefined,
  ): void {
    if (actorStaffId === null) return;
    if (this.tableService) {
      this.tableService.assertStaffMayUseTable(table, actorStaffId);
    } else if (table.isLockedByOther(actorStaffId, SESSION_LOCK_STALE_MS)) {
      const holder = (table.sessionStaffName ?? 'Waiter').trim() || 'Waiter';
      throw new ForbiddenException(`Table is currently being served by ${holder}`);
    }
  }

  async assignItemsToLedger(
    restaurantId: string,
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
    staffName: string,
    actorStaffId?: string | null,
  ): Promise<{ ok: true; amount: number }> {
    const seen = new Set<string>();
    for (const line of lines) {
      if (seen.has(line.itemId)) {
        throw new BadRequestException('The same order item cannot be selected twice');
      }
      seen.add(line.itemId);
    }
    await this.cashShiftService.requireCurrent(restaurantId);

    let total = 0;
    let tableEmptied = false;
    await this.dataSource.transaction(async (em) => {
      const { table, staged } = await this.lockTableAndLoadStagedLedgerItems(
        em,
        restaurantId,
        lines,
        actorStaffId,
      );
      const tableId = table.id;
      const tableName = normalizeStorageText(table.name ?? '') || null;

      const customer = await em.findOne(LedgerCustomerEntity, {
        where: { id: ledgerCustomerId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!customer) {
        throw new NotFoundException('Ledger customer not found');
      }

      const snapshotLines: Array<Record<string, unknown>> = [];
      const stockLines: BilledOrderLineForStock[] = [];
      const now = new Date();
      let totalMinorUnits = 0;

      for (const { line, item } of staged) {
        const assignment = item.assignToLedger(line.quantity);
        totalMinorUnits += toMinorUnits(assignment.lineTotal);
        stockLines.push({
          productId: item.productId,
          productName: item.productName,
          quantity: assignment.assignedQuantity,
        });

        if (!assignment.fullAssignment) {
          await em.save(OrderItemEntity, item);
          const newRow = em.create(OrderItemEntity, {
            orderId: item.orderId,
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            quantity: assignment.assignedQuantity,
            note: item.note ?? undefined,
            status: 'ledger',
            cancelReason: null,
            cancelledBy: null,
            cancelledAt: null,
          });
          const savedNew = await em.save(OrderItemEntity, newRow);
          snapshotLines.push({
            orderItemId: savedNew.id,
            productId: item.productId,
            productName: item.productName,
            price: assignment.unitPrice,
            quantity: assignment.assignedQuantity,
            note: item.note ?? null,
          });
        } else {
          await em.save(OrderItemEntity, item);
          snapshotLines.push({
            orderItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            price: assignment.unitPrice,
            quantity: assignment.assignedQuantity,
            note: item.note ?? null,
          });
        }
      }

      total = fromMinorUnits(totalMinorUnits);
      let desc = snapshotLines.map((l) => `${l.productName} x${l.quantity}`).join(', ');
      if (desc.length > 480) desc = desc.slice(0, 477) + '...';
      desc = `Ledger item assignment: ${desc}`;

      await this.ledgerService.recordStandaloneDebt(em, {
        restaurantId,
        customerId: customer.id,
        amount: total,
        description: desc,
        tableId,
        tableName,
        snapshot: { items: snapshotLines, tableId, tableName },
        recordedBy: normalizeStorageText(staffName ?? '') || null,
      });

      await this.stockMovementsService.deductRecipeIngredients(
        em,
        restaurantId,
        stockLines,
        normalizeStorageText(staffName ?? '') || 'system',
        'Ledger item',
      );

      const orderIds = [...new Set(staged.map((s) => s.item.orderId))].sort();
      for (const oid of orderIds) {
        const orderItems = await em.find(OrderItemEntity, { where: { orderId: oid } });
        const nextStatus = OrderStatusPolicy.resolveOrderStatus(orderItems);
        await em.update(OrderEntity, { id: oid, restaurantId }, { status: nextStatus, updatedAt: now });
      }

      const activeTableOrders = await em.find(OrderEntity, {
        where: { restaurantId, tableId, status: 'active' },
      });
      if (activeTableOrders.length === 0) {
        table.markEmpty();
        await em.save(TableEntity, table);
        tableEmptied = true;
      } else {
        const activeOrderItems = await em.find(OrderItemEntity, {
          where: { orderId: In(activeTableOrders.map((o) => o.id)) },
        });
        const anyBillable = activeOrderItems.some((i) =>
          OrderStatusPolicy.isItemOnActiveBill(i.status),
        );
        if (!anyBillable) {
          await em.update(
            OrderEntity,
            { id: In(activeTableOrders.map((o) => o.id)), restaurantId },
            { status: 'closed', updatedAt: now },
          );
          table.markEmpty();
          await em.save(TableEntity, table);
          tableEmptied = true;
        }
      }
    });

    if (tableEmptied) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
    }
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true, amount: total };
  }

  private async lockTableAndLoadStagedLedgerItems(
    em: EntityManager,
    restaurantId: string,
    lines: { itemId: string; quantity?: number }[],
    actorStaffId?: string | null,
  ): Promise<{ table: TableEntity; staged: StagedLedgerItem[] }> {
    const sortedItemIds = [...new Set(lines.map((l) => l.itemId))].sort();
    const itemProbes = await em.find(OrderItemEntity, {
      where: { id: In(sortedItemIds) },
      select: { id: true, orderId: true },
    });
    if (itemProbes.length !== sortedItemIds.length) {
      throw new NotFoundException('Order item not found');
    }

    const sortedOrderIds = [...new Set(itemProbes.map((i) => i.orderId))].sort();
    const orderProbes = await em.find(OrderEntity, {
      where: { id: In(sortedOrderIds), restaurantId },
      select: { id: true, tableId: true },
    });
    if (orderProbes.length !== sortedOrderIds.length) {
      throw new BadRequestException('Invalid order item');
    }
    const tableIds = new Set(orderProbes.map((o) => o.tableId));
    if (tableIds.size !== 1) {
      throw new BadRequestException('All selected items must belong to the same table');
    }
    const tableId = orderProbes[0].tableId;

    const table = await em.findOne(TableEntity, {
      where: { id: tableId, restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    if (table.status === 'checkout') {
      throw new BadRequestException('Cannot assign items to ledger while table is in checkout');
    }
    this.assertStaffMayUseLockedTable(table, actorStaffId);

    const lockedOrders = await em.find(OrderEntity, {
      where: { id: In(sortedOrderIds), restaurantId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (lockedOrders.length !== sortedOrderIds.length) {
      throw new BadRequestException('Invalid order item');
    }
    const orderById = new Map(lockedOrders.map((o) => [o.id, o]));

    const lockedItems = await em.find(OrderItemEntity, {
      where: { id: In(sortedItemIds), orderId: In(sortedOrderIds) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const itemById = new Map(lockedItems.map((i) => [i.id, i]));
    if (itemById.size !== sortedItemIds.length) {
      throw new NotFoundException('Order item not found');
    }

    const staged: StagedLedgerItem[] = [];
    for (const line of lines) {
      const item = itemById.get(line.itemId)!;
      const order = orderById.get(item.orderId);
      if (!order || order.restaurantId !== restaurantId) {
        throw new BadRequestException('Invalid order item');
      }
      if (order.status !== 'active') {
        throw new BadRequestException('Order is not active');
      }
      if (item.status === 'cancelled') {
        throw new BadRequestException('Order item is cancelled');
      }
      if (item.status === 'ledger') {
        throw new BadRequestException('Order item is already assigned to ledger');
      }
      if (item.status === 'paid') {
        throw new BadRequestException('Order item is already paid');
      }
      staged.push({ line, item, order });
    }
    return { table, staged };
  }

  async revertLedgerOrderItem(
    restaurantId: string,
    itemId: string,
    actorName: string,
    actorStaffId?: string | null,
  ): Promise<{ ok: true; amount: number }> {
    await this.cashShiftService.requireCurrent(restaurantId);
    let amountOut = 0;

    await this.dataSource.transaction(async (em) => {
      const itemProbe = await em.findOne(OrderItemEntity, {
        where: { id: itemId },
        select: { id: true, orderId: true },
      });
      if (!itemProbe) {
        throw new NotFoundException('Order item not found');
      }

      const orderProbe = await em.findOne(OrderEntity, {
        where: { id: itemProbe.orderId, restaurantId },
        select: { id: true, tableId: true },
      });
      if (!orderProbe) {
        throw new NotFoundException('Order not found');
      }

      const table = await em.findOne(TableEntity, {
        where: { id: orderProbe.tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) {
        throw new NotFoundException('Table not found');
      }
      if (table.status === 'checkout') {
        throw new BadRequestException('Cannot revert ledger item while table is in checkout');
      }
      this.assertStaffMayUseLockedTable(table, actorStaffId);

      const order = await em.findOne(OrderEntity, {
        where: { id: orderProbe.id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status !== 'active') {
        throw new BadRequestException('Order is not active');
      }

      const item = await em.findOne(OrderItemEntity, {
        where: { id: itemId, orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        throw new NotFoundException('Order item not found');
      }
      if (item.status !== 'ledger') {
        throw new BadRequestException('Only ledger-assigned order items can be reverted');
      }

      const debtEntry = await this.ledgerService.findStandaloneDebtEntryForOrderItem(
        em,
        restaurantId,
        itemId,
      );
      if (!debtEntry) {
        throw new BadRequestException(
          'Ledger debt entry not found; manual adjustment may be required',
        );
      }

      const lineMinorUnits = toMinorUnits(item.price) * item.quantity;
      if (lineMinorUnits <= 0) {
        throw new BadRequestException('Invalid item amount');
      }
      amountOut = fromMinorUnits(lineMinorUnits);

      const tableName = normalizeStorageText(table.name ?? '') || null;
      await this.ledgerService.recordStandaloneCredit(em, {
        restaurantId,
        customerId: debtEntry.customerId,
        amount: amountOut,
        description: `Revert ledger item: ${item.productName} x${item.quantity}`,
        tableId: order.tableId,
        tableName,
        snapshot: {
          revertedOrderItemId: itemId,
          originalDebtEntryId: debtEntry.id,
          productName: item.productName,
          quantity: item.quantity,
        },
        recordedBy: normalizeStorageText(actorName ?? '') || null,
      });

      await this.stockMovementsService.reverseRecipeIngredients(
        em,
        restaurantId,
        [
          {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
          },
        ],
        normalizeStorageText(actorName ?? '') || 'system',
        'Ledger revert',
      );

      await this.mergeOrRestoreRevertedItem(em, item);
      if (
        table.status === 'empty' ||
        table.status === 'reserved' ||
        table.status === 'ordering'
      ) {
        table.status = 'occupied';
        await em.save(TableEntity, table);
      }
      await em.update(OrderEntity, { id: order.id, restaurantId }, { updatedAt: new Date() });
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true, amount: amountOut };
  }

  private async mergeOrRestoreRevertedItem(
    em: EntityManager,
    item: OrderItemEntity,
  ): Promise<void> {
    const noteNormalized = (item.note ?? '').trim();
    const priceMinor = toMinorUnits(item.price);
    const siblings = await em.find(OrderItemEntity, {
      where: {
        orderId: item.orderId,
        productId: item.productId,
        status: Not(In(['cancelled', 'ledger', 'paid'])),
      },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const partner = siblings
      .filter(
        (s) =>
          s.id !== item.id &&
          (s.note ?? '').trim() === noteNormalized &&
          toMinorUnits(s.price) === priceMinor,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    if (partner) {
      await em.delete(OrderItemEntity, { id: item.id });
      partner.quantity += item.quantity;
      await em.save(OrderItemEntity, partner);
    } else {
      item.revertFromLedger();
      await em.save(OrderItemEntity, item);
    }
  }
}
