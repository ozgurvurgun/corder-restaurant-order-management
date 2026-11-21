import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { TableEntity } from '../domain/table.entity';
import { AuditLogEntity } from '../domain/audit-log.entity';
import { PrintJobEntity } from '../domain/print-job.entity';
import { CheckSettlementPolicy } from '../domain/services/check-settlement.policy';
import { OrderStatusPolicy } from '../domain/services/order-status.policy';
import {
  buildShiftReportSummaryPayload,
  CarriedOverTableSnapshotItem,
  ShiftAutoClosePolicy,
} from '../domain/services/shift-auto-close.policy';
import { OrdersGateway, PrintJobSocketPayload } from '../api/orders.gateway';
import { FraudDetectionService } from './fraud-detection.service';
import {
  computeDiscountMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from '../../common/money/minor-units';
import {
  formatTitleCase,
  normalizeStorageText,
} from '../../common/text/text-normalizer';
import { serializeCashShift } from './orders/order.mapper';

export { serializeCashShift };

@Injectable()
export class CashShiftService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CashShiftService.name);
  private autoCloseTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private isProcessingAutoClose = false;

  constructor(
    @InjectRepository(CashShiftEntity)
    private readonly repo: Repository<CashShiftEntity>,
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
    @Optional()
    private readonly fraudDetection?: FraudDetectionService,
  ) {}

  onModuleInit(): void {
    this.startupTimer = setTimeout(() => void this.processDueAutoCloseShifts(), 3_000);
    if (typeof this.startupTimer.unref === 'function') this.startupTimer.unref();
    this.autoCloseTimer = setInterval(() => void this.processDueAutoCloseShifts(), 60_000);
    if (typeof this.autoCloseTimer.unref === 'function') this.autoCloseTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.startupTimer) { clearTimeout(this.startupTimer); this.startupTimer = null; }
    if (this.autoCloseTimer) { clearInterval(this.autoCloseTimer); this.autoCloseTimer = null; }
  }

  async getCurrent(restaurantId: string): Promise<CashShiftEntity | null> {
    const shift = await this.repo.findOne({
      where: { restaurantId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
    if (!shift) return null;

    if (this.dataSource && typeof this.dataSource.manager?.findOne === 'function') {
      const restaurant = await this.dataSource.manager
        .findOne(RestaurantEntity, {
          where: { id: restaurantId },
          select: ['id', 'autoCloseShiftEnabled', 'autoCloseShiftTime'],
        })
        .catch(() => null);
      if (restaurant && restaurant.autoCloseShiftEnabled !== false) {
        const lastActivityAt = await this.findLatestShiftActivityTime(
          this.dataSource.manager,
          restaurantId,
          shift.id,
          shift.openedAt,
        );
        const check = ShiftAutoClosePolicy.isShiftDueForAutoClose({
          openedAt: shift.openedAt,
          autoCloseEnabled: restaurant.autoCloseShiftEnabled,
          autoCloseTime: restaurant.autoCloseShiftTime,
          now: new Date(),
          lastActivityAt,
        });
        if (check.due) {
          await this.autoCloseSingleShift(shift.id, restaurantId, check.normalizedTime).catch((err) =>
            this.logger.warn(`Lazy auto-close failed for shift ${shift.id}: ${err instanceof Error ? err.message : String(err)}`),
          );
          return null;
        }
      }
    }
    return shift;
  }

  private async findLatestShiftActivityTime(
    em: EntityManager,
    restaurantId: string,
    shiftId: string,
    openedAt: Date,
  ): Promise<Date | null> {
    if (typeof em.findOne !== 'function') return null;
    const [lastTx, lastCompleted] = await Promise.all([
      em.findOne(CashTransactionEntity, { where: { restaurantId, shiftId }, order: { createdAt: 'DESC' }, select: ['id', 'createdAt'] }).catch(() => null),
      em.findOne(CompletedOrderEntity, { where: { restaurantId }, order: { closedAt: 'DESC' }, select: ['id', 'closedAt'] }).catch(() => null),
    ]);
    let latestMs = openedAt.getTime();
    if (lastTx?.createdAt && lastTx.createdAt.getTime() > latestMs) latestMs = lastTx.createdAt.getTime();
    if (lastCompleted?.closedAt && lastCompleted.closedAt.getTime() > latestMs) latestMs = lastCompleted.closedAt.getTime();
    return new Date(latestMs);
  }

  async computeOpenTablesRolloverSnapshot(
    em: EntityManager,
    restaurantId: string,
  ): Promise<{ count: number; totalMinorUnits: number; snapshot: CarriedOverTableSnapshotItem[] }> {
    if (typeof em.find !== 'function') return { count: 0, totalMinorUnits: 0, snapshot: [] };
    const activeOrders = await em
      .find(OrderEntity, { where: { restaurantId, status: 'active' }, order: { createdAt: 'ASC' } })
      .catch(() => [] as OrderEntity[]);
    if (!activeOrders.length) return { count: 0, totalMinorUnits: 0, snapshot: [] };

    const orderIds = activeOrders.map((o) => o.id);
    const tableIds = [...new Set(activeOrders.map((o) => o.tableId))];
    const [orderItems, tables] = await Promise.all([
      em.find(OrderItemEntity, { where: { orderId: In(orderIds) } }).catch(() => [] as OrderItemEntity[]),
      em.find(TableEntity, { where: { id: In(tableIds), restaurantId } }).catch(() => [] as TableEntity[]),
    ]);

    const itemsByOrderId = new Map<string, OrderItemEntity[]>();
    for (const item of orderItems) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const ordersByTableId = new Map<string, OrderEntity[]>();
    for (const ord of activeOrders) {
      const list = ordersByTableId.get(ord.tableId) ?? [];
      list.push(ord);
      ordersByTableId.set(ord.tableId, list);
    }

    const snapshot: CarriedOverTableSnapshotItem[] = [];
    let totalMinorUnits = 0;

    for (const [tableId, tableOrders] of ordersByTableId.entries()) {
      let rawMinor = 0;
      let itemCount = 0;
      let earliestOpen = tableOrders[0]?.createdAt ?? new Date();
      for (const ord of tableOrders) {
        if (ord.createdAt && ord.createdAt < earliestOpen) earliestOpen = ord.createdAt;
        const lines = itemsByOrderId.get(ord.id) ?? [];
        for (const line of lines) {
          if (OrderStatusPolicy.isItemOnActiveBill(line.status)) {
            const unitMinor = Math.max(0, toMinorUnits(line.price));
            const qty = Math.max(0, Number(line.quantity) || 0);
            if (qty > 0) { rawMinor += unitMinor * qty; itemCount += qty; }
          }
        }
      }
      if (itemCount <= 0 || rawMinor <= 0) continue;
      const table = tableById.get(tableId);
      const discountMinor = table?.discount ? computeDiscountMinorUnits(rawMinor, table.discount) : 0;
      const netMinor = Math.max(0, rawMinor - discountMinor);
      totalMinorUnits += netMinor;
      snapshot.push({
        tableId,
        tableName: formatTitleCase(table?.name || tableId, 'tr') || tableId,
        section: formatTitleCase(table?.section || 'Salon', 'tr') || 'Salon',
        openAmount: fromMinorUnits(netMinor),
        itemCount,
        openedAt: earliestOpen.toISOString(),
      });
    }

    snapshot.sort((a, b) => a.tableName.localeCompare(b.tableName, 'tr'));
    return { count: snapshot.length, totalMinorUnits, snapshot };
  }

  async open(restaurantId: string, openedBy: string, openingBalance: number): Promise<CashShiftEntity> {
    const openingMinorUnits = Math.max(0, toMinorUnits(openingBalance));
    return this.dataSource.transaction(async (em) => {
      const restaurant = await em.findOne(RestaurantEntity, {
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!restaurant) throw new NotFoundException('Restaurant not found.');

      const current = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (current) {
        throw new BadRequestException('A cash shift is already open. Please close the current shift first.');
      }
      const shift = em.create(CashShiftEntity, {
        restaurantId,
        openedBy: normalizeStorageText(openedBy) || 'system',
        openedAt: new Date(),
        status: 'open',
        openingBalance: fromMinorUnits(openingMinorUnits),
        cashIn: 0,
        cashOut: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalCard: 0,
        totalMealCard: 0,
        totalMultinet: 0,
        transactionCount: 0,
        isAutoClosed: false,
        carriedOverTablesCount: 0,
        carriedOverTablesAmount: 0,
        carriedOverTablesSnapshot: null,
      });
      return em.save(CashShiftEntity, shift);
    });
  }

  async close(
    id: string,
    restaurantId: string,
    closedBy: string,
    closingBalance: number,
    notes?: string,
  ): Promise<CashShiftEntity> {
    const closingMinorUnits = Math.max(0, toMinorUnits(closingBalance));
    const closedShift = await this.dataSource.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('Cash shift not found.');
      if (shift.status !== 'open') throw new BadRequestException('This cash shift is already closed.');

      const rollover = await this.computeOpenTablesRolloverSnapshot(em, restaurantId);
      let effectiveNotes = notes?.trim() || null;
      if (rollover.count > 0) {
        const rolloverSummary = `Yeni vardiyaya devreden açık masa: ${rollover.count} adet (Toplam ₺${fromMinorUnits(rollover.totalMinorUnits).toFixed(2)} açık adisyon)`;
        effectiveNotes = effectiveNotes ? `${effectiveNotes} · ${rolloverSummary}` : rolloverSummary;
      }
      shift.closeShift(normalizeStorageText(closedBy) || 'system', closingMinorUnits, effectiveNotes, {
        isAutoClosed: false,
        carriedOverTablesCount: rollover.count,
        carriedOverTablesAmountMinorUnits: rollover.totalMinorUnits,
        carriedOverTablesSnapshot: rollover.snapshot,
      });
      return em.save(CashShiftEntity, shift);
    });
    void this.fraudDetection?.analyzeRestaurantAnomalies(restaurantId).catch(() => undefined);
    return closedShift;
  }

  async autoCloseSingleShift(
    shiftId: string,
    restaurantId: string,
    cutoffTime: string,
    now: Date = new Date(),
  ): Promise<CashShiftEntity | null> {
    const closedShift = await this.dataSource.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { id: shiftId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift || shift.status !== 'open') return null;

      const rollover = await this.computeOpenTablesRolloverSnapshot(em, restaurantId);
      const expectedCashMinor =
        toMinorUnits(shift.openingBalance || 0) +
        toMinorUnits(shift.cashIn || 0) -
        toMinorUnits(shift.cashOut || 0);
      const autoClosingBalanceMinor = Math.max(0, expectedCashMinor);
      const notes = ShiftAutoClosePolicy.buildAutoCloseShiftNotes({
        cutoffTime,
        carriedOverTablesCount: rollover.count,
        carriedOverTablesAmount: fromMinorUnits(rollover.totalMinorUnits),
        tableNames: rollover.snapshot.map((s) => s.tableName),
      });

      shift.closeShift('sistem (otomatik gün sonu)', autoClosingBalanceMinor, notes, {
        isAutoClosed: true,
        closedAt: now,
        carriedOverTablesCount: rollover.count,
        carriedOverTablesAmountMinorUnits: rollover.totalMinorUnits,
        carriedOverTablesSnapshot: rollover.snapshot,
      });
      const saved = await em.save(CashShiftEntity, shift);

      if (typeof em.create === 'function') {
        await em.save(
          AuditLogEntity,
          em.create(AuditLogEntity, {
            restaurantId,
            userId: restaurantId,
            userName: 'Sistem (Otomatik Gün Sonu)',
            action: 'shift_auto_closed',
            category: 'cash-register',
            details: notes,
            metadata: {
              shiftId: saved.id,
              cutoffTime,
              expectedCash: fromMinorUnits(expectedCashMinor),
              carriedOverTablesCount: rollover.count,
              carriedOverTablesAmount: fromMinorUnits(rollover.totalMinorUnits),
            },
          }),
        );
      }
      return saved;
    });

    if (closedShift) {
      this.ordersGateway.emitOrdersUpdated(restaurantId);
      void this.fraudDetection?.analyzeRestaurantAnomalies(restaurantId).catch(() => undefined);
    }
    return closedShift;
  }

  async processDueAutoCloseShifts(now: Date = new Date()): Promise<number> {
    if (this.isProcessingAutoClose) return 0;
    this.isProcessingAutoClose = true;
    let closedCount = 0;
    try {
      const openShifts = await this.repo.find({
        where: { status: 'open' },
        relations: ['restaurant'],
        order: { openedAt: 'ASC' },
      });
      if (!openShifts.length) return 0;

      for (const shift of openShifts) {
        const restaurant = shift.restaurant;
        if (restaurant && restaurant.autoCloseShiftEnabled === false) continue;
        const autoCloseTime = ShiftAutoClosePolicy.normalizeAutoCloseTime(restaurant?.autoCloseShiftTime);
        const lastActivityAt = await this.findLatestShiftActivityTime(
          this.dataSource.manager,
          shift.restaurantId,
          shift.id,
          shift.openedAt,
        );
        const check = ShiftAutoClosePolicy.isShiftDueForAutoClose({
          openedAt: shift.openedAt,
          autoCloseEnabled: restaurant?.autoCloseShiftEnabled ?? true,
          autoCloseTime,
          now,
          lastActivityAt,
        });
        if (!check.due) continue;

        const closed = await this.autoCloseSingleShift(shift.id, shift.restaurantId, check.normalizedTime, now);
        if (closed) {
          closedCount += 1;
          this.logger.log(
            `Auto-closed cash shift ${closed.id} for restaurant ${shift.restaurantId} (cutoff ${check.normalizedTime}, carriedOverTables=${closed.carriedOverTablesCount})`,
          );
        }
      }
      return closedCount;
    } catch (err) {
      this.logger.warn(`processDueAutoCloseShifts error: ${err instanceof Error ? err.message : String(err)}`);
      return closedCount;
    } finally {
      this.isProcessingAutoClose = false;
    }
  }

  async list(restaurantId: string, limit = 50): Promise<CashShiftEntity[]> {
    return this.repo.find({ where: { restaurantId }, order: { openedAt: 'DESC' }, take: limit });
  }

  async requireCurrent(restaurantId: string): Promise<CashShiftEntity> {
    const current = await this.getCurrent(restaurantId);
    if (!current) {
      throw new BadRequestException(
        'Cannot process transaction without an open cash shift. Please open a shift first.',
      );
    }
    return current;
  }

  async printShiftReport(id: string, restaurantId: string) {
    const em = this.dataSource.manager;
    const [shift, restaurant] = await Promise.all([
      this.repo.findOne({ where: { id, restaurantId } }),
      em.findOne(RestaurantEntity, { where: { id: restaurantId } }),
    ]);
    if (!shift) throw new NotFoundException('Cash shift not found.');

    const windowStart = shift.openedAt;
    const windowEnd = shift.closedAt ?? new Date();
    const [completedOrders, cashTxs] = await Promise.all([
      em.find(CompletedOrderEntity, {
        where: { restaurantId, closedAt: Between(windowStart, windowEnd) },
        select: ['id', 'netAmount', 'discountAmount', 'paymentMethod', 'paymentSplit', 'closedAt'],
        order: { closedAt: 'ASC' },
      }),
      em.find(CashTransactionEntity, { where: { restaurantId, shiftId: shift.id }, order: { createdAt: 'ASC' } }),
    ]);

    const { mealAndMultinetCombined, ...shiftReport } = buildShiftReportSummaryPayload({
      shift,
      restaurantName: restaurant?.name || 'Corder Restoran',
      completedOrders,
      cashTxs,
      toMinorUnits,
      fromMinorUnits,
      computeMethodBreakdown: (method, netMinor, splits) =>
        CheckSettlementPolicy.computeMethodBreakdownMinorUnits(method, netMinor, splits),
    });

    const jobId = randomUUID();
    const payload: PrintJobSocketPayload = {
      type: 'order.print_job',
      jobId,
      restaurantId,
      printType: 'receipt',
      createdAt: new Date().toISOString(),
      receiptMode: 'consolidated',
      includeLineNotes: false,
      isReprint: false,
      openCashDrawer: false,
      shiftReport,
      order: {
        tableName: shiftReport.reportType === 'X' ? 'X RAPORU (ANLIK)' : 'Z RAPORU (KAPANIŞ)',
        waiterName: shift.closedBy || shift.openedBy || '-',
        subtotal: shiftReport.totalRevenue,
        total: shiftReport.totalRevenue,
        items: [
          { productName: `Kapanan Masa (${shiftReport.closedTablesCount} Adet)`, quantity: 1, price: shiftReport.totalRevenue },
          { productName: 'Nakit Tahsilat', quantity: 1, price: shiftReport.totalCash },
          { productName: 'Kredi Kartı Tahsilat', quantity: 1, price: shiftReport.totalCard },
          { productName: 'Yemek Kartı / Multinet', quantity: 1, price: mealAndMultinetCombined },
          { productName: 'Cari / Açık Hesap', quantity: 1, price: shiftReport.totalLedger },
          { productName: 'Beklenen Kasa Nakit', quantity: 1, price: shiftReport.expectedCash },
          ...(shiftReport.carriedOverTablesCount > 0
            ? [{ productName: `Devreden Açık Masa (${shiftReport.carriedOverTablesCount} Adet)`, quantity: 1, price: shiftReport.carriedOverTablesAmount }]
            : []),
        ],
      },
    };

    await em.save(
      PrintJobEntity,
      em.create(PrintJobEntity, {
        id: jobId,
        restaurantId,
        printType: 'receipt',
        payload: payload as unknown as Record<string, unknown>,
        printedAt: null,
      }),
    );

    this.ordersGateway.emitPrintJob(restaurantId, payload);
    return { ok: true, jobId, report: shiftReport };
  }
}
