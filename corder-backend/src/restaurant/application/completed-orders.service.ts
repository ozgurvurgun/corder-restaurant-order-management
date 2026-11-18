import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { AuditLogEntity } from '../domain/audit-log.entity';
import {
  CheckSettlementPolicy,
  SettlementActorPolicy,
} from '../domain/services/check-settlement.policy';
import { OrderStatusPolicy } from '../domain/services/order-status.policy';
import { BilledOrderLineForStock } from '../domain/services/recipe-stock.policy';
import { CloseCheckSplitDto } from '../api/dto/close-check.dto';
import { UpdateCompletedOrderDto } from '../api/dto/update-completed-order.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { LedgerService } from './ledger.service';
import { StockMovementsService } from './stock-movements.service';
import {
  fromMinorUnits,
  toMinorUnits,
} from '../../common/money/minor-units';
import { normalizeStorageText } from '../../common/text/text-normalizer';
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
    private readonly ledgerService: LedgerService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async list(restaurantId: string, filters: ListFilters): Promise<CompletedOrderEntity[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('c.closed_at', 'DESC');

    if (filters.from && !Number.isNaN(filters.from.getTime())) {
      qb.andWhere('c.closed_at >= :from', { from: filters.from.toISOString() });
    }
    if (filters.to && !Number.isNaN(filters.to.getTime())) {
      qb.andWhere('c.closed_at <= :to', { to: filters.to.toISOString() });
    }
    if (filters.waiter) {
      qb.andWhere('c.waiter = :waiter', { waiter: filters.waiter });
    }
    if (filters.tableName) {
      qb.andWhere('c.table_name = :tableName', { tableName: filters.tableName });
    }
    if (filters.limit != null && Number.isFinite(filters.limit) && filters.limit > 0) {
      qb.take(Math.min(1000, Math.floor(filters.limit)));
    }
    if (filters.offset != null && Number.isFinite(filters.offset) && filters.offset >= 0) {
      qb.skip(Math.floor(filters.offset));
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
        const unitMinor = toMinorUnits(item.price);
        if (unitMinor < 0) {
          throw new BadRequestException('Invalid item price in completed order');
        }
        sumMinorUnits += unitMinor * qty;
      }
    }
    return sumMinorUnits;
  }

  private extractStockLinesFromOrders(
    ordersSnapshot: unknown,
  ): BilledOrderLineForStock[] {
    if (!Array.isArray(ordersSnapshot)) return [];
    const out: BilledOrderLineForStock[] = [];
    for (const ord of ordersSnapshot) {
      const items = (ord as { items?: Array<{ productId?: string; productName?: string; quantity?: number; status?: string }> })?.items ?? [];
      for (const item of items) {
        if (!item?.productId || !OrderStatusPolicy.isItemOnActiveBill(String(item.status ?? 'served'))) {
          continue;
        }
        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
        if (qty > 0) {
          out.push({
            productId: String(item.productId),
            productName: String(item.productName ?? 'Product'),
            quantity: qty,
          });
        }
      }
    }
    return out;
  }

  async updateFromPanel(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
    actorName = 'Manager',
    actor?: { id?: string } & SettlementActorPolicy,
  ): Promise<CompletedOrderEntity> {
    return this.update(restaurantId, id, dto, actorName, actor);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
    actorName: string,
    actor?: { id?: string } & SettlementActorPolicy,
  ): Promise<CompletedOrderEntity> {
    const saved = await this.dataSource.transaction(async (em) => {
      const row = await em.findOne(CompletedOrderEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new NotFoundException('Completed order not found');
      }

      const prevMethod = row.paymentMethod;
      const prevNetMinor = toMinorUnits(row.netAmount);
      const prevDiscountMinor = toMinorUnits(row.discountAmount);
      const prevSplits = Array.isArray(row.paymentSplit)
        ? (row.paymentSplit as Array<{ method: string; amount: number }>)
        : null;
      const prevBreakdown = CheckSettlementPolicy.computeMethodBreakdownMinorUnits(
        row.paymentMethod,
        prevNetMinor,
        prevSplits,
      );
      const prevPaymentSnap = (row.paymentSnapshot ?? {}) as {
        ledgerCustomerId?: string;
        ledgerCustomerName?: string;
        discount?: { appliedBy?: string };
      };
      const prevStockLines = this.extractStockLinesFromOrders(row.ordersSnapshot);
      const nextStockLines = this.extractStockLinesFromOrders(dto.orders);

      const rawTotalMinor = this.sumActiveOrderLinesMinorUnits(dto.orders);
      const effectiveLedgerCustomerId =
        dto.payment.ledgerCustomerId ?? prevPaymentSnap.ledgerCustomerId ?? null;

      const settlement = CheckSettlementPolicy.computeSettlement({
        rawTotalMinorUnits: rawTotalMinor,
        method: dto.payment.method,
        discount: dto.payment.discount ?? null,
        splitDetails: (dto.payment.splitDetails as CloseCheckSplitDto[] | undefined) ?? null,
        ledgerCustomerId: effectiveLedgerCustomerId,
        tip: dto.payment.tip ?? null,
      });

      const safeActorName = normalizeStorageText(actorName || '') || 'sistem';
      const discountChanged =
        settlement.discountMinorUnits > prevDiscountMinor ||
        JSON.stringify(dto.payment.discount ?? null) !== JSON.stringify(row.paymentDiscount ?? null);
      if (discountChanged && settlement.discountMinorUnits > 0) {
        CheckSettlementPolicy.assertDiscountAllowedForActor(
          settlement.rawTotalMinorUnits,
          settlement.discountMinorUnits,
          dto.payment.discount ?? null,
          actor,
        );
      }
      if (settlement.discountSnapshot) {
        settlement.discountSnapshot.appliedBy = discountChanged
          ? safeActorName
          : normalizeStorageText(
              dto.payment.discount?.appliedBy ||
                (prevPaymentSnap.discount as { appliedBy?: string } | undefined)?.appliedBy ||
                safeActorName,
            );
      }

      if (
        settlement.ledgerMinorUnits > prevBreakdown.ledgerMinorUnits &&
        actor &&
        !actor.isBoss &&
        !(actor.permissions ?? []).includes('ledger.assign_order')
      ) {
        throw new ForbiddenException(
          'You do not have permission to assign checks to a customer ledger (ledger.assign_order)',
        );
      }

      const ledgerCustomer = await this.ledgerService.reconcileCompletedOrderDebtInTransaction(
        em,
        {
          restaurantId,
          completedOrderId: row.id,
          tableId: dto.payment.tableId || null,
          tableName: row.tableName,
          nextCustomerId: effectiveLedgerCustomerId,
          nextLedgerMinorUnits: settlement.ledgerMinorUnits,
          snapshot: dto.orders,
          recordedBy: safeActorName,
        },
      );

      await this.stockMovementsService.reconcileRecipeIngredientsDelta(
        em,
        restaurantId,
        prevStockLines,
        nextStockLines,
        safeActorName,
      );

      const totalAmount = fromMinorUnits(settlement.rawTotalMinorUnits);
      const discountAmount = fromMinorUnits(settlement.discountMinorUnits);
      const netAmount = fromMinorUnits(settlement.netMinorUnits);

      row.ordersSnapshot = dto.orders as unknown[];
      row.paymentSnapshot = {
        ...dto.payment,
        amount: netAmount,
        tip: fromMinorUnits(settlement.tipMinorUnits),
        ...(settlement.normalizedSplits ? { splitDetails: settlement.normalizedSplits } : {}),
        ...(settlement.discountSnapshot ? { discount: settlement.discountSnapshot } : {}),
        ...(ledgerCustomer
          ? {
              ledgerCustomerId: ledgerCustomer.id,
              ledgerCustomerName: ledgerCustomer.name,
            }
          : {}),
      } as unknown;
      row.totalAmount = totalAmount;
      row.discountAmount = discountAmount;
      row.netAmount = netAmount;
      row.paymentMethod = dto.payment.method;
      row.paymentTip = fromMinorUnits(settlement.tipMinorUnits);
      row.paymentSplit = settlement.normalizedSplits ?? null;
      row.paymentDiscount = settlement.discountSnapshot ?? null;

      const savedRow = await em.save(CompletedOrderEntity, row);

      await this.reconcileActiveShiftIfNeeded(
        em,
        restaurantId,
        row,
        settlement,
        prevNetMinor,
        prevBreakdown,
        safeActorName,
      );

      await em.save(
        AuditLogEntity,
        em.create(AuditLogEntity, {
          restaurantId,
          userId: actor?.id?.trim() || restaurantId,
          userName: safeActorName,
          action: 'completed_order_updated',
          category: 'payment',
          details: `${row.tableName} completed check updated (${prevMethod} ${fromMinorUnits(prevNetMinor)} TL -> ${dto.payment.method} ${netAmount} TL)`,
          metadata: {
            completedOrderId: row.id,
            tableName: row.tableName,
            previousMethod: prevMethod,
            nextMethod: dto.payment.method,
            previousNetAmount: fromMinorUnits(prevNetMinor),
            nextNetAmount: netAmount,
          },
        }),
      );

      return savedRow;
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return saved;
  }

  private async reconcileActiveShiftIfNeeded(
    em: EntityManager,
    restaurantId: string,
    row: CompletedOrderEntity,
    settlement: ReturnType<typeof CheckSettlementPolicy.computeSettlement>,
    prevNetMinor: number,
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

    openShift.adjustSettlementDiff({
      netDiffMinorUnits: settlement.netMinorUnits - prevNetMinor,
      cashDiffMinorUnits: settlement.cashMinorUnits - prevBreakdown.cashMinorUnits,
      cardDiffMinorUnits: settlement.cardMinorUnits - prevBreakdown.cardMinorUnits,
      mealCardDiffMinorUnits:
        settlement.mealCardMinorUnits - prevBreakdown.mealCardMinorUnits,
      multinetDiffMinorUnits:
        settlement.multinetMinorUnits - prevBreakdown.multinetMinorUnits,
    });

    const cashDeltaMinor = settlement.cashMinorUnits - prevBreakdown.cashMinorUnits;
    const createdBy = actorName.trim() || 'Manager';
    if (cashDeltaMinor !== 0) {
      const existingSaleTx = await em.findOne(CashTransactionEntity, {
        where: {
          restaurantId,
          shiftId: openShift.id,
          type: 'sale',
          reference: row.id,
        },
        order: { createdAt: 'DESC' },
      });

      if (existingSaleTx) {
        if (settlement.cashMinorUnits <= 0) {
          await em.remove(CashTransactionEntity, existingSaleTx);
        } else {
          existingSaleTx.amount = fromMinorUnits(settlement.cashMinorUnits);
          existingSaleTx.description =
            row.paymentMethod === 'split'
              ? `${row.tableName} - Check (split cash)`
              : `${row.tableName} - Check`;
          existingSaleTx.createdBy = createdBy;
          await em.save(CashTransactionEntity, existingSaleTx);
        }
      } else if (settlement.cashMinorUnits > 0 && cashDeltaMinor > 0) {
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
      }
    }

    await em.save(CashShiftEntity, openShift);
  }
}
