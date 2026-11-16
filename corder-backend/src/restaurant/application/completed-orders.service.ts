import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CheckSettlementPolicy } from '../domain/services/check-settlement.policy';
import { OrderStatusPolicy } from '../domain/services/order-status.policy';
import { UpdateCompletedOrderDto } from '../api/dto/update-completed-order.dto';
import {
  computeDiscountMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from '../../common/money/minor-units';
import { serializeCompletedOrder } from './orders/order.mapper';

export { serializeCompletedOrder };

interface ListFilters {
  from?: Date;
  to?: Date;
  waiter?: string;
  tableName?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class CompletedOrdersService {
  constructor(
    @InjectRepository(CompletedOrderEntity)
    private readonly repo: Repository<CompletedOrderEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async list(restaurantId: string, filters: ListFilters): Promise<CompletedOrderEntity[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('c.closed_at', 'DESC');

    if (filters.from) {
      qb.andWhere('c.closed_at >= :from', { from: filters.from.toISOString() });
    }
    if (filters.to) {
      qb.andWhere('c.closed_at <= :to', { to: filters.to.toISOString() });
    }
    if (filters.waiter) {
      qb.andWhere('c.waiter = :waiter', { waiter: filters.waiter });
    }
    if (filters.tableName) {
      qb.andWhere('c.table_name = :tableName', { tableName: filters.tableName });
    }
    if (filters.limit != null) {
      qb.take(filters.limit);
    }
    if (filters.offset != null) {
      qb.skip(filters.offset);
    }
    return qb.getMany();
  }

  private sumActiveOrderLinesMinorUnits(
    orders: { items: { status: string; price: number; quantity: number }[] }[],
  ): number {
    let sumMinorUnits = 0;
    for (const order of orders) {
      for (const item of order.items || []) {
        if (!OrderStatusPolicy.isItemOnActiveBill(item.status)) continue;
        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
        sumMinorUnits += toMinorUnits(item.price) * qty;
      }
    }
    return sumMinorUnits;
  }

  async updateFromPanel(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
    actorName = 'Manager',
  ): Promise<CompletedOrderEntity> {
    return this.update(restaurantId, id, dto, actorName);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
    actorName: string,
  ): Promise<CompletedOrderEntity> {
    return this.dataSource.transaction(async (em) => {
      const row = await em.findOne(CompletedOrderEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new NotFoundException('Completed order not found');
      }

      const prevNetMinor = toMinorUnits(row.netAmount);
      const prevSplits = Array.isArray(row.paymentSplit)
        ? (row.paymentSplit as Array<{ method: string; amount: number }>)
        : null;
      const prevBreakdown = CheckSettlementPolicy.computeMethodBreakdownMinorUnits(
        row.paymentMethod,
        prevNetMinor,
        prevSplits,
      );

      const rawTotalMinor = this.sumActiveOrderLinesMinorUnits(dto.orders);
      const discountMinor = computeDiscountMinorUnits(
        rawTotalMinor,
        dto.payment.discount ?? null,
      );
      const newNetMinor = Math.max(0, rawTotalMinor - discountMinor);
      const tipMinor =
        dto.payment.tip != null ? Math.max(0, toMinorUnits(dto.payment.tip)) : 0;

      const totalAmount = fromMinorUnits(rawTotalMinor);
      const discountAmount = fromMinorUnits(discountMinor);
      const netAmount = fromMinorUnits(newNetMinor);

      row.ordersSnapshot = dto.orders as unknown[];
      row.paymentSnapshot = {
        ...dto.payment,
        amount: netAmount,
        tip: fromMinorUnits(tipMinor),
      } as unknown;
      row.totalAmount = totalAmount;
      row.discountAmount = discountAmount;
      row.netAmount = netAmount;
      row.paymentMethod = dto.payment.method;
      row.paymentTip = fromMinorUnits(tipMinor);
      row.paymentSplit = dto.payment.splitDetails ?? null;
      row.paymentDiscount = dto.payment.discount ?? null;

      const savedRow = await em.save(CompletedOrderEntity, row);

      await this.reconcileActiveShiftIfNeeded(
        em,
        restaurantId,
        row,
        dto,
        prevNetMinor,
        newNetMinor,
        prevBreakdown,
        actorName,
      );

      return savedRow;
    });
  }

  private async reconcileActiveShiftIfNeeded(
    em: EntityManager,
    restaurantId: string,
    row: CompletedOrderEntity,
    dto: UpdateCompletedOrderDto,
    prevNetMinor: number,
    newNetMinor: number,
    prevBreakdown: ReturnType<typeof CheckSettlementPolicy.computeMethodBreakdownMinorUnits>,
    actorName: string,
  ): Promise<void> {
    const openShift = await em.findOne(CashShiftEntity, {
      where: { restaurantId, status: 'open' },
      order: { openedAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!openShift || row.closedAt < openShift.openedAt) {
      return;
    }

    const nextBreakdown = CheckSettlementPolicy.computeMethodBreakdownMinorUnits(
      dto.payment.method,
      newNetMinor,
      dto.payment.splitDetails ?? null,
    );

    openShift.adjustSettlementDiff({
      netDiffMinorUnits: newNetMinor - prevNetMinor,
      cashDiffMinorUnits: nextBreakdown.cashMinorUnits - prevBreakdown.cashMinorUnits,
      cardDiffMinorUnits: nextBreakdown.cardMinorUnits - prevBreakdown.cardMinorUnits,
      mealCardDiffMinorUnits:
        nextBreakdown.mealCardMinorUnits - prevBreakdown.mealCardMinorUnits,
      multinetDiffMinorUnits:
        nextBreakdown.multinetMinorUnits - prevBreakdown.multinetMinorUnits,
    });

    const cashDeltaMinor = nextBreakdown.cashMinorUnits - prevBreakdown.cashMinorUnits;
    const createdBy = actorName.trim() || 'Manager';
    if (cashDeltaMinor > 0) {
      const tx = em.create(CashTransactionEntity, {
        restaurantId,
        shiftId: openShift.id,
        type: 'sale',
        amount: fromMinorUnits(cashDeltaMinor),
        description: `${row.tableName} — completed check adjustment`,
        reference: row.id,
        createdBy,
      });
      await em.save(CashTransactionEntity, tx);
      openShift.recordCashMovement('sale', cashDeltaMinor);
    } else if (cashDeltaMinor < 0) {
      const refundMinor = Math.abs(cashDeltaMinor);
      const tx = em.create(CashTransactionEntity, {
        restaurantId,
        shiftId: openShift.id,
        type: 'refund',
        amount: fromMinorUnits(refundMinor),
        description: `${row.tableName} — completed check adjustment (refund)`,
        reference: row.id,
        createdBy,
      });
      await em.save(CashTransactionEntity, tx);
      openShift.recordCashMovement('refund', refundMinor);
    }

    await em.save(CashShiftEntity, openShift);
  }
}
