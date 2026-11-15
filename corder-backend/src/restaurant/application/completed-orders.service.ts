import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { UpdateCompletedOrderDto } from '../api/dto/update-completed-order.dto';
import { computeDiscountKurus, fromKurus, toKurus } from '../../common/money/kurus';

interface ListFilters {
  from?: Date;
  to?: Date;
  waiter?: string;
  tableName?: string;
  limit?: number;
  offset?: number;
}

export function serializeCompletedOrder(entity: CompletedOrderEntity) {
  return {
    id: entity.id,
    tableName: entity.tableName,
    section: entity.section,
    waiter: entity.waiter,
    orders: entity.ordersSnapshot,
    payment: entity.paymentSnapshot,
    totalAmount: Number(entity.totalAmount),
    discountAmount: Number(entity.discountAmount),
    netAmount: Number(entity.netAmount),
    closedBy: entity.closedBy,
    openedAt: entity.openedAt,
    closedAt: entity.closedAt,
    paymentMethod: entity.paymentMethod,
    paymentSplit: entity.paymentSplit,
    paymentDiscount: entity.paymentDiscount,
    paymentTip: Number(entity.paymentTip),
    createdAt: entity.createdAt,
  };
}

function methodBreakdownKurus(
  method: string,
  netKurus: number,
  splitDetails?: Array<{ method: string; amount: number }> | null,
) {
  let nakit = 0;
  let kart = 0;
  let yemek = 0;
  let multinet = 0;
  if (method === 'nakit') nakit = netKurus;
  else if (method === 'kredi-karti') kart = netKurus;
  else if (method === 'yemek-karti') yemek = netKurus;
  else if (method === 'multinet') multinet = netKurus;
  else if (method === 'coklu' && Array.isArray(splitDetails)) {
    for (const s of splitDetails) {
      const k = Math.max(0, toKurus(s.amount));
      if (s.method === 'nakit') nakit += k;
      else if (s.method === 'kredi-karti') kart += k;
      else if (s.method === 'yemek-karti') yemek += k;
      else if (s.method === 'multinet') multinet += k;
    }
  }
  return { nakit, kart, yemek, multinet };
}

@Injectable()
export class CompletedOrdersService {
  constructor(
    @InjectRepository(CompletedOrderEntity)
    private readonly repo: Repository<CompletedOrderEntity>,
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

  private sumActiveOrderLinesKurus(
    orders: { items: { status: string; price: number; quantity: number }[] }[],
  ): number {
    let sumKurus = 0;
    for (const o of orders) {
      for (const i of o.items || []) {
        if (i.status === 'cancelled' || i.status === 'ledger') continue;
        const qty = Math.max(0, Math.floor(Number(i.quantity) || 0));
        sumKurus += toKurus(i.price) * qty;
      }
    }
    return sumKurus;
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
    actorName: string,
  ): Promise<CompletedOrderEntity> {
    return this.repo.manager.transaction(async (em) => {
      const row = await em.findOne(CompletedOrderEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new NotFoundException('Tamamlanan siparis bulunamadi');
      }

      const prevNetKurus = toKurus(row.netAmount);
      const prevSplits = Array.isArray(row.paymentSplit)
        ? (row.paymentSplit as Array<{ method: string; amount: number }>)
        : null;
      const prevBreakdown = methodBreakdownKurus(row.paymentMethod, prevNetKurus, prevSplits);

      const rawTotalKurus = this.sumActiveOrderLinesKurus(dto.orders);
      const discountKurus = computeDiscountKurus(rawTotalKurus, dto.payment.discount ?? null);
      const newNetKurus = Math.max(0, rawTotalKurus - discountKurus);
      const tipKurus = dto.payment.tip != null ? Math.max(0, toKurus(dto.payment.tip)) : 0;

      const totalAmount = fromKurus(rawTotalKurus);
      const discountAmount = fromKurus(discountKurus);
      const netAmount = fromKurus(newNetKurus);

      const paymentSnapshot = {
        ...dto.payment,
        amount: netAmount,
        tip: fromKurus(tipKurus),
      };

      row.ordersSnapshot = dto.orders as unknown[];
      row.paymentSnapshot = paymentSnapshot as unknown;
      row.totalAmount = totalAmount;
      row.discountAmount = discountAmount;
      row.netAmount = netAmount;
      row.paymentMethod = dto.payment.method;
      row.paymentTip = fromKurus(tipKurus);
      row.paymentSplit = dto.payment.splitDetails ?? null;
      row.paymentDiscount = dto.payment.discount ?? null;

      const savedRow = await em.save(CompletedOrderEntity, row);

      const openShift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (openShift && row.closedAt >= openShift.openedAt) {
        const nextBreakdown = methodBreakdownKurus(
          dto.payment.method,
          newNetKurus,
          dto.payment.splitDetails ?? null,
        );

        openShift.totalRevenue = fromKurus(
          Math.max(0, toKurus(openShift.totalRevenue) + (newNetKurus - prevNetKurus)),
        );
        openShift.totalNakit = fromKurus(
          Math.max(0, toKurus(openShift.totalNakit) + (nextBreakdown.nakit - prevBreakdown.nakit)),
        );
        openShift.totalKart = fromKurus(
          Math.max(0, toKurus(openShift.totalKart) + (nextBreakdown.kart - prevBreakdown.kart)),
        );
        openShift.totalYemekKarti = fromKurus(
          Math.max(
            0,
            toKurus(openShift.totalYemekKarti) + (nextBreakdown.yemek - prevBreakdown.yemek),
          ),
        );
        openShift.totalMultinet = fromKurus(
          Math.max(
            0,
            toKurus(openShift.totalMultinet) + (nextBreakdown.multinet - prevBreakdown.multinet),
          ),
        );

        const cashDeltaKurus = nextBreakdown.nakit - prevBreakdown.nakit;
        if (cashDeltaKurus > 0) {
          const tx = em.create(CashTransactionEntity, {
            restaurantId,
            shiftId: openShift.id,
            type: 'sale',
            amount: fromKurus(cashDeltaKurus),
            description: `${row.tableName} — tamamlanan hesap duzeltmesi`,
            reference: row.id,
            createdBy: actorName.trim() || 'Yonetici',
          });
          await em.save(CashTransactionEntity, tx);
          openShift.cashIn = fromKurus(toKurus(openShift.cashIn) + cashDeltaKurus);
          openShift.transactionCount = (openShift.transactionCount ?? 0) + 1;
        } else if (cashDeltaKurus < 0) {
          const refundKurus = Math.abs(cashDeltaKurus);
          const tx = em.create(CashTransactionEntity, {
            restaurantId,
            shiftId: openShift.id,
            type: 'refund',
            amount: fromKurus(refundKurus),
            description: `${row.tableName} — tamamlanan hesap duzeltmesi (iade)`,
            reference: row.id,
            createdBy: actorName.trim() || 'Yonetici',
          });
          await em.save(CashTransactionEntity, tx);
          openShift.cashOut = fromKurus(toKurus(openShift.cashOut) + refundKurus);
          openShift.transactionCount = (openShift.transactionCount ?? 0) + 1;
        }

        await em.save(CashShiftEntity, openShift);
      }

      return savedRow;
    });
  }
}
