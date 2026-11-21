import { Injectable, NotFoundException, Optional } from '@nestjs/common';
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
import {
  assertCompletedOrderEditPermissions,
  buildCompletedOrderEditLogEntry,
  extractStockLinesFromCompletedOrdersSnapshot,
  preserveCompletedOrderSnapshotNumbers,
  sumActiveCompletedOrderLinesMinorUnits,
} from '../domain/services/completed-order-edit-log.policy';
import { CloseCheckSplitDto } from '../api/dto/close-check.dto';
import { UpdateCompletedOrderDto } from '../api/dto/update-completed-order.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { LedgerService } from './ledger.service';
import { StockMovementsService } from './stock-movements.service';
import { FraudDetectionService } from './fraud-detection.service';
import {
  fromMinorUnits,
  toMinorUnits,
} from '../../common/money/minor-units';
import {
  formatTitleCase,
  normalizeStorageText,
} from '../../common/text/text-normalizer';
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
    @Optional()
    private readonly fraudDetection?: FraudDetectionService,
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
    const safeLimit =
      filters.limit != null && Number.isFinite(filters.limit) && filters.limit > 0
        ? Math.min(1000, Math.floor(filters.limit))
        : 500;
    qb.take(safeLimit);
    if (filters.offset != null && Number.isFinite(filters.offset) && filters.offset >= 0) {
      qb.skip(Math.floor(filters.offset));
    }
    return qb.getMany();
  }

  private applyEditedOrderFields(
    row: CompletedOrderEntity,
    dto: UpdateCompletedOrderDto,
    settlement: ReturnType<typeof CheckSettlementPolicy.computeSettlement>,
    ledgerCustomer: { id: string; name: string } | null,
    editEntry: ReturnType<typeof buildCompletedOrderEditLogEntry>,
  ): { totalAmount: number; discountAmount: number; netAmount: number } {
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
    if (editEntry.changes.length > 0) {
      row.editHistory = [
        ...(Array.isArray(row.editHistory) ? row.editHistory : []),
        editEntry,
      ];
    }
    return { totalAmount, discountAmount, netAmount };
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
    actorName = 'Manager',
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
      const prevTotalAmount = Number(row.totalAmount);
      const prevDiscountAmount = Number(row.discountAmount);
      const prevNetAmount = Number(row.netAmount);
      const prevNetMinor = toMinorUnits(row.netAmount);
      const prevDiscountMinor = toMinorUnits(row.discountAmount);
      const prevOrdersSnapshot = row.ordersSnapshot;
      preserveCompletedOrderSnapshotNumbers(prevOrdersSnapshot, dto.orders);

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
      const prevStockLines = extractStockLinesFromCompletedOrdersSnapshot(row.ordersSnapshot);
      const nextStockLines = extractStockLinesFromCompletedOrdersSnapshot(dto.orders);

      const rawTotalMinor = sumActiveCompletedOrderLinesMinorUnits(dto.orders);
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
      assertCompletedOrderEditPermissions({
        settlement,
        prevDiscountMinor,
        prevLedgerMinor: prevBreakdown.ledgerMinorUnits,
        prevPaymentDiscount: row.paymentDiscount,
        prevDiscountAppliedBy: prevPaymentSnap.discount?.appliedBy,
        requestedDiscount: dto.payment.discount ?? null,
        safeActorName,
        actor,
      });

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

      const editEntry = buildCompletedOrderEditLogEntry({
        editedBy: safeActorName,
        editedByUserId: actor?.id?.trim() || null,
        previousOrdersSnapshot: prevOrdersSnapshot,
        nextOrdersSnapshot: dto.orders,
        previousTotalAmount: prevTotalAmount,
        nextTotalAmount: fromMinorUnits(settlement.rawTotalMinorUnits),
        previousDiscountAmount: prevDiscountAmount,
        nextDiscountAmount: fromMinorUnits(settlement.discountMinorUnits),
        previousNetAmount: prevNetAmount,
        nextNetAmount: fromMinorUnits(settlement.netMinorUnits),
        previousMethod: prevMethod,
        nextMethod: dto.payment.method,
        previousSplit: prevSplits,
        nextSplit: settlement.normalizedSplits ?? null,
        previousLedgerCustomerName: prevPaymentSnap.ledgerCustomerName ?? null,
        nextLedgerCustomerName:
          ledgerCustomer?.name ?? dto.payment.ledgerCustomerName ?? null,
      });

      const { netAmount } = this.applyEditedOrderFields(
        row,
        dto,
        settlement,
        ledgerCustomer,
        editEntry,
      );
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
            changes: editEntry.changes,
          },
        }),
      );

      return savedRow;
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    void this.fraudDetection?.analyzeRestaurantAnomalies(restaurantId).catch(() => undefined);
    return saved;
  }

  private async findShiftCoveringClosedOrder(
    em: EntityManager,
    restaurantId: string,
    closedAt: Date,
  ): Promise<CashShiftEntity | null> {
    if (typeof em.createQueryBuilder === 'function') {
      const matched = await em
        .createQueryBuilder(CashShiftEntity, 'shift')
        .setLock('pessimistic_write')
        .where('shift.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('shift.opened_at <= :closedAt', { closedAt })
        .andWhere('(shift.closed_at IS NULL OR shift.closed_at >= :closedAt)', {
          closedAt,
        })
        .orderBy('shift.opened_at', 'DESC')
        .getOne();
      if (matched) return matched;
    } else if (typeof em.find === 'function') {
      const candidates = await em.find(CashShiftEntity, {
        where: { restaurantId },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      const matched = candidates.find(
        (s) =>
          s.openedAt <= closedAt &&
          (s.closedAt == null || s.closedAt >= closedAt),
      );
      if (matched) return matched;
    }

    return em.findOne(CashShiftEntity, {
      where: { restaurantId, status: 'open' },
      order: { openedAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
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
    const targetShift = await this.findShiftCoveringClosedOrder(
      em,
      restaurantId,
      row.closedAt,
    );
    if (!targetShift) {
      return;
    }

    targetShift.adjustSettlementDiff({
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
          shiftId: targetShift.id,
          type: 'sale',
          reference: row.id,
        },
        order: { createdAt: 'DESC' },
      });

      const displayTable = formatTitleCase(row.tableName, 'tr') || row.tableName;
      if (existingSaleTx) {
        if (settlement.cashMinorUnits <= 0) {
          await em.remove(CashTransactionEntity, existingSaleTx);
        } else {
          existingSaleTx.amount = fromMinorUnits(settlement.cashMinorUnits);
          existingSaleTx.description =
            row.paymentMethod === 'split'
              ? `${displayTable} - Hesap Kapanışı (Parçalı Nakit)`
              : `${displayTable} - Hesap Kapanışı`;
          existingSaleTx.createdBy = createdBy;
          await em.save(CashTransactionEntity, existingSaleTx);
        }
      } else if (settlement.cashMinorUnits > 0 && cashDeltaMinor > 0) {
        const tx = em.create(CashTransactionEntity, {
          restaurantId,
          shiftId: targetShift.id,
          type: 'sale',
          amount: fromMinorUnits(cashDeltaMinor),
          description: `${displayTable} - Hesap Düzenleme Farkı`,
          reference: row.id,
          createdBy,
        });
        await em.save(CashTransactionEntity, tx);
      }
    }

    await em.save(CashShiftEntity, targetShift);
  }
}
