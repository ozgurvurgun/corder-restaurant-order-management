import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { PrintJobEntity } from '../domain/print-job.entity';
import { CheckSettlementPolicy } from '../domain/services/check-settlement.policy';
import { OrdersGateway, PrintJobSocketPayload } from '../api/orders.gateway';
import { FraudDetectionService } from './fraud-detection.service';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { serializeCashShift } from './orders/order.mapper';

export { serializeCashShift };

@Injectable()
export class CashShiftService {
  constructor(
    @InjectRepository(CashShiftEntity)
    private readonly repo: Repository<CashShiftEntity>,
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
    @Optional()
    private readonly fraudDetection?: FraudDetectionService,
  ) {}

  async getCurrent(restaurantId: string): Promise<CashShiftEntity | null> {
    return this.repo.findOne({
      where: { restaurantId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
  }

  async open(
    restaurantId: string,
    openedBy: string,
    openingBalance: number,
  ): Promise<CashShiftEntity> {
    const openingMinorUnits = Math.max(0, toMinorUnits(openingBalance));
    return this.dataSource.transaction(async (em) => {
      const restaurant = await em.findOne(RestaurantEntity, {
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!restaurant) {
        throw new NotFoundException('Restaurant not found.');
      }

      const current = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (current) {
        throw new BadRequestException(
          'A cash shift is already open. Please close the current shift first.',
        );
      }
      const shift = em.create(CashShiftEntity, {
        restaurantId,
        openedBy,
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
      if (shift.status !== 'open') {
        throw new BadRequestException('This cash shift is already closed.');
      }
      shift.closeShift(closedBy, closingMinorUnits, notes);
      return em.save(CashShiftEntity, shift);
    });
    void this.fraudDetection?.analyzeRestaurantAnomalies(restaurantId).catch(() => undefined);
    return closedShift;
  }

  async list(restaurantId: string, limit = 50): Promise<CashShiftEntity[]> {
    return this.repo.find({
      where: { restaurantId },
      order: { openedAt: 'DESC' },
      take: limit,
    });
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
    if (!shift) {
      throw new NotFoundException('Cash shift not found.');
    }

    const windowStart = shift.openedAt;
    const windowEnd = shift.closedAt ?? new Date();
    const [completedOrders, cashTxs] = await Promise.all([
      em.find(CompletedOrderEntity, {
        where: { restaurantId, closedAt: Between(windowStart, windowEnd) },
        order: { closedAt: 'ASC' },
      }),
      em.find(CashTransactionEntity, {
        where: { restaurantId, shiftId: shift.id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    let ordersNetMinor = 0;
    let ordersCashMinor = 0;
    let ordersCardMinor = 0;
    let ordersMealCardMinor = 0;
    let ordersMultinetMinor = 0;
    let ordersLedgerMinor = 0;
    let ordersDiscountMinor = 0;

    for (const co of completedOrders) {
      const netMinor = toMinorUnits(co.netAmount || 0);
      ordersNetMinor += netMinor;
      ordersDiscountMinor += toMinorUnits(co.discountAmount || 0);
      const splits = Array.isArray(co.paymentSplit)
        ? (co.paymentSplit as Array<{ method: string; amount: number }>)
        : null;
      const bd = CheckSettlementPolicy.computeMethodBreakdownMinorUnits(
        co.paymentMethod,
        netMinor,
        splits,
      );
      ordersCashMinor += bd.cashMinorUnits;
      ordersCardMinor += bd.cardMinorUnits;
      ordersMealCardMinor += bd.mealCardMinorUnits;
      ordersMultinetMinor += bd.multinetMinorUnits;
      ordersLedgerMinor += bd.ledgerMinorUnits;
    }

    let txCashInMinor = 0;
    let txCashOutMinor = 0;
    for (const tx of cashTxs) {
      const amtMinor = toMinorUnits(tx.amount || 0);
      const normalizedRef = (tx.reference ?? '').trim().toLowerCase();
      const isCardExpense = tx.type === 'expense' && normalizedRef === 'credit-card';
      if (tx.type === 'cash-in' || tx.type === 'sale') {
        txCashInMinor += amtMinor;
      } else if (!isCardExpense) {
        txCashOutMinor += amtMinor;
      }
    }

    const totalCashMinor = Math.max(toMinorUnits(shift.totalCash || 0), ordersCashMinor);
    const totalCardMinor = Math.max(toMinorUnits(shift.totalCard || 0), ordersCardMinor);
    const totalMealCardMinor = Math.max(
      toMinorUnits(shift.totalMealCard || 0),
      ordersMealCardMinor,
    );
    const totalMultinetMinor = Math.max(
      toMinorUnits(shift.totalMultinet || 0),
      ordersMultinetMinor,
    );
    const totalLedgerMinor = ordersLedgerMinor;
    const totalRevenueMinor = Math.max(
      toMinorUnits(shift.totalRevenue || 0),
      ordersNetMinor,
      totalCashMinor +
        totalCardMinor +
        totalMealCardMinor +
        totalMultinetMinor +
        totalLedgerMinor,
    );
    const openingBalanceMinor = toMinorUnits(shift.openingBalance || 0);
    const cashInMinor = Math.max(
      toMinorUnits(shift.cashIn || 0),
      txCashInMinor,
      totalCashMinor,
    );
    const cashOutMinor = Math.max(toMinorUnits(shift.cashOut || 0), txCashOutMinor);
    const expectedCashMinor = openingBalanceMinor + cashInMinor - cashOutMinor;
    const closingBalanceMinor =
      shift.closingBalance != null ? toMinorUnits(shift.closingBalance) : null;
    const cashDifferenceMinor =
      closingBalanceMinor != null ? closingBalanceMinor - expectedCashMinor : 0;

    const totalRevenue = fromMinorUnits(totalRevenueMinor);
    const totalCash = fromMinorUnits(totalCashMinor);
    const totalCard = fromMinorUnits(totalCardMinor);
    const totalMealCard = fromMinorUnits(totalMealCardMinor);
    const totalMultinet = fromMinorUnits(totalMultinetMinor);
    const totalLedger = fromMinorUnits(totalLedgerMinor);
    const discountTotal = fromMinorUnits(ordersDiscountMinor);
    const openingBalance = fromMinorUnits(openingBalanceMinor);
    const cashIn = fromMinorUnits(cashInMinor);
    const cashOut = fromMinorUnits(cashOutMinor);
    const expectedCash = fromMinorUnits(expectedCashMinor);
    const closingBalance =
      closingBalanceMinor != null ? fromMinorUnits(closingBalanceMinor) : null;
    const cashDifference = fromMinorUnits(cashDifferenceMinor);
    const closedTablesCount =
      completedOrders.length || Number(shift.transactionCount || 0);
    const reportType = shift.status === 'open' ? 'X' : 'Z';
    const restaurantName = restaurant?.name || 'Corder Restoran';

    const shiftReport = {
      reportType,
      restaurantName,
      shiftId: shift.id,
      openedBy: shift.openedBy,
      closedBy: shift.closedBy ?? null,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
      openingBalance,
      cashIn,
      cashOut,
      expectedCash,
      closingBalance,
      cashDifference,
      totalRevenue,
      totalCash,
      totalCard,
      totalMealCard,
      totalMultinet,
      totalLedger,
      closedTablesCount,
      discountTotal,
    };

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const payload: PrintJobSocketPayload = {
      type: 'order.print_job',
      jobId,
      restaurantId,
      printType: 'receipt',
      createdAt,
      receiptMode: 'consolidated',
      includeLineNotes: false,
      isReprint: false,
      openCashDrawer: false,
      shiftReport,
      order: {
        tableName:
          reportType === 'X' ? 'X RAPORU (ANLIK)' : 'Z RAPORU (KAPANIŞ)',
        waiterName: shift.closedBy || shift.openedBy || '-',
        subtotal: totalRevenue,
        total: totalRevenue,
        items: [
          {
            productName: `Kapanan Masa (${closedTablesCount} Adet)`,
            quantity: 1,
            price: totalRevenue,
          },
          { productName: 'Nakit Tahsilat', quantity: 1, price: totalCash },
          { productName: 'Kredi Kartı Tahsilat', quantity: 1, price: totalCard },
          {
            productName: 'Yemek Kartı / Multinet',
            quantity: 1,
            price: fromMinorUnits(totalMealCardMinor + totalMultinetMinor),
          },
          { productName: 'Cari / Açık Hesap', quantity: 1, price: totalLedger },
          { productName: 'Beklenen Kasa Nakit', quantity: 1, price: expectedCash },
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
