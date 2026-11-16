import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { LedgerService } from '../ledger.service';

@Injectable()
export class OrderLedgerUseCase {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly ledgerService: LedgerService,
  ) {}

  async assignItemsToLedger(
    restaurantId: string,
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
    staffName: string,
  ): Promise<{ ok: true; amount: number }> {
    const seen = new Set<string>();
    for (const line of lines) {
      if (seen.has(line.itemId)) {
        throw new BadRequestException('The same order item cannot be selected twice');
      }
      seen.add(line.itemId);
    }

    let total = 0;
    await this.orderRepo.manager.transaction(async (em) => {
      const staged = await this.loadStagedLedgerItems(em, restaurantId, lines);
      const tableIds = new Set(staged.map((s) => s.item.order!.tableId));
      if (tableIds.size !== 1) {
        throw new BadRequestException('All selected items must belong to the same table');
      }
      const table = staged[0].item.order?.table;
      if (!table || table.restaurantId !== restaurantId) {
        throw new NotFoundException('Table not found');
      }
      if (table.status === 'checkout') {
        throw new BadRequestException('Cannot assign items to ledger while table is in checkout');
      }
      const tableId = table.id;
      const tableName = (table.name ?? '').trim() || null;

      const snapshotLines: Array<Record<string, unknown>> = [];
      const now = new Date();

      for (const { line, item } of staged) {
        const assignment = item.assignToLedger(line.quantity);
        total += assignment.lineTotal;

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

      let desc = snapshotLines.map((l) => `${l.productName} x${l.quantity}`).join(', ');
      if (desc.length > 480) desc = desc.slice(0, 477) + '...';
      desc = `Ledger item assignment: ${desc}`;

      await this.ledgerService.recordStandaloneDebt(em, {
        restaurantId,
        customerId: ledgerCustomerId,
        amount: total,
        description: desc,
        tableId,
        tableName,
        snapshot: { items: snapshotLines, tableId, tableName },
        recordedBy: (staffName ?? '').trim() || null,
      });

      const orderIds = new Set(staged.map((s) => s.item.orderId));
      for (const oid of orderIds) {
        await em.update(OrderEntity, { id: oid, restaurantId }, { updatedAt: now });
      }
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true, amount: total };
  }

  private async loadStagedLedgerItems(
    em: EntityManager,
    restaurantId: string,
    lines: { itemId: string; quantity?: number }[],
  ): Promise<{ line: { itemId: string; quantity?: number }; item: OrderItemEntity }[]> {
    const staged: { line: { itemId: string; quantity?: number }; item: OrderItemEntity }[] = [];
    for (const line of lines) {
      const item = await em.findOne(OrderItemEntity, {
        where: { id: line.itemId },
        relations: ['order', 'order.table'],
      });
      if (!item?.order) {
        throw new NotFoundException('Order item not found');
      }
      const order = item.order;
      if (order.restaurantId !== restaurantId) {
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
      staged.push({ line, item });
    }
    return staged;
  }

  async revertLedgerOrderItem(
    restaurantId: string,
    itemId: string,
    actorName: string,
  ): Promise<{ ok: true; amount: number }> {
    await this.cashShiftService.requireCurrent(restaurantId);
    let amountOut = 0;
    await this.orderRepo.manager.transaction(async (em) => {
      const item = await em.findOne(OrderItemEntity, {
        where: { id: itemId },
        relations: ['order', 'order.table'],
      });
      if (!item?.order) {
        throw new NotFoundException('Order item not found');
      }
      const order = item.order;
      if (order.restaurantId !== restaurantId) {
        throw new BadRequestException('Invalid order item');
      }
      if (order.status !== 'active') {
        throw new BadRequestException('Order is not active');
      }
      if (item.status !== 'ledger') {
        throw new BadRequestException('Only ledger-assigned order items can be reverted');
      }
      const table = await this.tableRepo.findOne({
        where: { id: order.tableId, restaurantId },
      });
      if (!table) {
        throw new NotFoundException('Table not found');
      }
      if (table.status === 'checkout') {
        throw new BadRequestException('Cannot revert ledger item while table is in checkout');
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

      const lineAmount = Number(item.price) * item.quantity;
      if (!Number.isFinite(lineAmount) || lineAmount <= 0) {
        throw new BadRequestException('Invalid item amount');
      }
      amountOut = lineAmount;

      const tableName = (table.name ?? '').trim() || null;
      await this.ledgerService.recordStandaloneCredit(em, {
        restaurantId,
        customerId: debtEntry.customerId,
        amount: lineAmount,
        description: `Revert ledger item: ${item.productName} x${item.quantity}`,
        tableId: order.tableId,
        tableName,
        snapshot: {
          revertedOrderItemId: itemId,
          originalDebtEntryId: debtEntry.id,
          productName: item.productName,
          quantity: item.quantity,
        },
        recordedBy: (actorName ?? '').trim() || null,
      });

      await this.mergeOrRestoreRevertedItem(em, item);
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
    const priceNormalized = Number(item.price);
    const siblings = await em.find(OrderItemEntity, {
      where: {
        orderId: item.orderId,
        productId: item.productId,
        status: Not(In(['cancelled', 'ledger'])),
      },
    });
    const partner = siblings
      .filter(
        (s) =>
          s.id !== item.id &&
          (s.note ?? '').trim() === noteNormalized &&
          Number(s.price) === priceNormalized,
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
