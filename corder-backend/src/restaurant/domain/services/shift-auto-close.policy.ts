const TR_CURRENCY_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatTurkishMoney(amount: number): string {
  return TR_CURRENCY_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}

export interface CarriedOverTableSnapshotItem {
  tableId: string;
  tableName: string;
  section: string;
  openAmount: number;
  itemCount: number;
  openedAt: string;
}

export const DEFAULT_AUTO_CLOSE_SHIFT_TIME = '04:00';
export const AUTO_CLOSE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * A newly opened shift must be at least 2 hours old before an automatic
 * daily cutoff can close it. This prevents a shift opened at 03:30 from
 * being prematurely auto-closed 30 minutes later at 04:00.
 */
export const MIN_SHIFT_AGE_BEFORE_AUTO_CLOSE_MS = 2 * 3600 * 1000;

/**
 * If a cashier actively processed a transaction within the last 15 minutes
 * around the cutoff time (and all tables are empty), defer auto-close briefly
 * so we never close a shift in the middle of an active checkout
 * (up to 60 minutes max past cutoff).
 */
export const ACTIVE_TRANSACTION_GRACE_MS = 15 * 60 * 1000;
export const MAX_GRACE_AFTER_CUTOFF_MS = 60 * 60 * 1000;

/**
 * When the restaurant still has open tables (active late-night service),
 * never split a shift while staff are actively taking orders or closing checks.
 * Wait until 45 minutes of complete inactivity (up to 4 hours max overtime past cutoff).
 */
export const OPEN_TABLES_IDLE_GRACE_MS = 45 * 60 * 1000;
export const MAX_OPEN_TABLES_OVERTIME_MS = 4 * 3600 * 1000;

const ISTANBUL_UTC_OFFSET_MS = 3 * 3600 * 1000;
const ONE_DAY_MS = 24 * 3600 * 1000;

export class ShiftAutoClosePolicy {
  static normalizeAutoCloseTime(raw?: string | null): string {
    const trimmed = (raw ?? '').trim();
    if (AUTO_CLOSE_TIME_REGEX.test(trimmed)) {
      return trimmed;
    }
    return DEFAULT_AUTO_CLOSE_SHIFT_TIME;
  }

  static parseHourMinute(hhmm: string): { hour: number; minute: number } {
    const normalized = this.normalizeAutoCloseTime(hhmm);
    const [h, m] = normalized.split(':').map(Number);
    return { hour: h || 0, minute: m || 0 };
  }

  /**
   * Resolves the POS Business Day (SOD/EOD İş Günü) boundary time in Europe/Istanbul.
   * Morning cutoff times (00:00 - 11:59, e.g. 04:00 or 07:00) define the start/end of
   * the 24-hour operational business day. Evening cutoffs (>= 12:00) use 00:00 midnight.
   */
  static resolveBusinessDayCutoffHourMinute(
    autoCloseTime?: string | null,
    autoCloseEnabled: boolean = true,
  ): { hour: number; minute: number } {
    if (autoCloseEnabled === false) {
      return { hour: 0, minute: 0 };
    }
    const { hour, minute } = this.parseHourMinute(
      autoCloseTime ?? DEFAULT_AUTO_CLOSE_SHIFT_TIME,
    );
    if (hour >= 0 && hour < 12) {
      return { hour, minute };
    }
    return { hour: 0, minute: 0 };
  }

  /**
   * Computes the earliest occurrence of `cutoffTimeHHmm` in Europe/Istanbul (UTC+3)
   * that is at least `MIN_SHIFT_AGE_BEFORE_AUTO_CLOSE_MS` after `openedAt`.
   */
  static computeShiftAutoCloseCutoffDate(
    openedAt: Date,
    cutoffTimeHHmm?: string | null,
  ): Date {
    const { hour, minute } = this.parseHourMinute(
      cutoffTimeHHmm ?? DEFAULT_AUTO_CLOSE_SHIFT_TIME,
    );
    const minEligibleUtcMs =
      openedAt.getTime() + MIN_SHIFT_AGE_BEFORE_AUTO_CLOSE_MS;
    const minEligibleIstanbul = new Date(
      minEligibleUtcMs + ISTANBUL_UTC_OFFSET_MS,
    );

    const candidateIstanbulUtcMs = Date.UTC(
      minEligibleIstanbul.getUTCFullYear(),
      minEligibleIstanbul.getUTCMonth(),
      minEligibleIstanbul.getUTCDate(),
      hour,
      minute,
      0,
      0,
    );
    let candidateUtcMs = candidateIstanbulUtcMs - ISTANBUL_UTC_OFFSET_MS;
    if (candidateUtcMs < minEligibleUtcMs) {
      candidateUtcMs += ONE_DAY_MS;
    }
    return new Date(candidateUtcMs);
  }

  static isShiftDueForAutoClose(params: {
    openedAt: Date;
    autoCloseEnabled?: boolean | null;
    autoCloseTime?: string | null;
    now?: Date;
    lastActivityAt?: Date | null;
    openTablesCount?: number;
  }): { due: boolean; cutoffDate: Date; normalizedTime: string } {
    const normalizedTime = this.normalizeAutoCloseTime(params.autoCloseTime);
    const cutoffDate = this.computeShiftAutoCloseCutoffDate(
      params.openedAt,
      normalizedTime,
    );
    if (params.autoCloseEnabled === false) {
      return { due: false, cutoffDate, normalizedTime };
    }
    const nowMs = (params.now ?? new Date()).getTime();
    const cutoffMs = cutoffDate.getTime();
    if (nowMs < cutoffMs) {
      return { due: false, cutoffDate, normalizedTime };
    }

    const openTablesCount = Math.max(0, Number(params.openTablesCount ?? 0));
    if (openTablesCount > 0) {
      const latestActivityMs = params.lastActivityAt
        ? params.lastActivityAt.getTime()
        : params.openedAt.getTime();
      if (
        nowMs - cutoffMs < MAX_OPEN_TABLES_OVERTIME_MS &&
        nowMs - latestActivityMs < OPEN_TABLES_IDLE_GRACE_MS
      ) {
        return { due: false, cutoffDate, normalizedTime };
      }
      return { due: true, cutoffDate, normalizedTime };
    }

    if (
      params.lastActivityAt &&
      nowMs - cutoffMs < MAX_GRACE_AFTER_CUTOFF_MS &&
      nowMs - params.lastActivityAt.getTime() < ACTIVE_TRANSACTION_GRACE_MS
    ) {
      return { due: false, cutoffDate, normalizedTime };
    }

    return { due: true, cutoffDate, normalizedTime };
  }

  static buildAutoCloseShiftNotes(params: {
    cutoffTime: string;
    carriedOverTablesCount: number;
    carriedOverTablesAmount: number;
    tableNames?: string[];
  }): string {
    const time = this.normalizeAutoCloseTime(params.cutoffTime);
    if (params.carriedOverTablesCount > 0) {
      const names = (params.tableNames ?? []).filter(Boolean);
      const preview =
        names.length > 0
          ? ` (${names.slice(0, 5).join(', ')}${names.length > 5 ? ` +${names.length - 5}` : ''})`
          : '';
      return `Otomatik gün sonu kapanışı (${time}). Yeni vardiyaya devreden açık masa: ${params.carriedOverTablesCount} adet${preview} - Toplam ₺${formatTurkishMoney(params.carriedOverTablesAmount)} açık adisyon.`;
    }
    return `Otomatik gün sonu kapanışı (${time} - Fiziksel sayım girilmeden sistem tarafından kapatıldı).`;
  }
}

export function buildShiftReportSummaryPayload(params: {
  shift: {
    id: string;
    status: string;
    openedBy: string;
    closedBy?: string | null;
    openedAt: Date;
    closedAt?: Date | null;
    openingBalance: number;
    closingBalance?: number | null;
    cashIn: number;
    cashOut: number;
    totalRevenue: number;
    totalCash: number;
    totalCard: number;
    totalMealCard: number;
    totalMultinet: number;
    transactionCount: number;
    isAutoClosed?: boolean;
    carriedOverTablesCount?: number;
    carriedOverTablesAmount?: number;
  };
  restaurantName: string;
  completedOrders: Array<{
    netAmount: number;
    discountAmount: number;
    paymentMethod: string;
    paymentSplit?: unknown;
  }>;
  cashTxs: Array<{
    type: string;
    amount: number;
    reference?: string | null;
  }>;
  toMinorUnits: (v: number) => number;
  fromMinorUnits: (v: number) => number;
  computeMethodBreakdown: (
    method: string,
    netMinor: number,
    splits: Array<{ method: string; amount: number }> | null,
  ) => {
    cashMinorUnits: number;
    cardMinorUnits: number;
    mealCardMinorUnits: number;
    multinetMinorUnits: number;
    ledgerMinorUnits: number;
  };
}) {
  const {
    shift,
    restaurantName,
    completedOrders,
    cashTxs,
    toMinorUnits,
    fromMinorUnits,
    computeMethodBreakdown,
  } = params;
  let ordersNetMinor = 0,
    ordersCashMinor = 0,
    ordersCardMinor = 0,
    ordersMealCardMinor = 0,
    ordersMultinetMinor = 0,
    ordersLedgerMinor = 0,
    ordersDiscountMinor = 0;

  for (const co of completedOrders) {
    const netMinor = toMinorUnits(co.netAmount || 0);
    ordersNetMinor += netMinor;
    ordersDiscountMinor += toMinorUnits(co.discountAmount || 0);
    const splits = Array.isArray(co.paymentSplit)
      ? (co.paymentSplit as Array<{ method: string; amount: number }>)
      : null;
    const bd = computeMethodBreakdown(co.paymentMethod, netMinor, splits);
    ordersCashMinor += bd.cashMinorUnits;
    ordersCardMinor += bd.cardMinorUnits;
    ordersMealCardMinor += bd.mealCardMinorUnits;
    ordersMultinetMinor += bd.multinetMinorUnits;
    ordersLedgerMinor += bd.ledgerMinorUnits;
  }

  let txCashInMinor = 0,
    txCashOutMinor = 0;
  for (const tx of cashTxs) {
    const amtMinor = toMinorUnits(tx.amount || 0);
    const isCardExpense =
      tx.type === 'expense' &&
      (tx.reference ?? '').trim().toLowerCase() === 'credit-card';
    if (tx.type === 'cash-in' || tx.type === 'sale') txCashInMinor += amtMinor;
    else if (!isCardExpense) txCashOutMinor += amtMinor;
  }

  const totalCashMinor = Math.max(
    toMinorUnits(shift.totalCash || 0),
    ordersCashMinor,
  );
  const totalCardMinor = Math.max(
    toMinorUnits(shift.totalCard || 0),
    ordersCardMinor,
  );
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
  const cashOutMinor = Math.max(
    toMinorUnits(shift.cashOut || 0),
    txCashOutMinor,
  );
  const expectedCashMinor = openingBalanceMinor + cashInMinor - cashOutMinor;
  const closingBalanceMinor =
    shift.closingBalance != null ? toMinorUnits(shift.closingBalance) : null;
  const cashDifferenceMinor =
    closingBalanceMinor != null ? closingBalanceMinor - expectedCashMinor : 0;

  return {
    reportType: shift.status === 'open' ? ('X' as const) : ('Z' as const),
    restaurantName,
    shiftId: shift.id,
    openedBy: shift.openedBy,
    closedBy: shift.closedBy ?? null,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    openingBalance: fromMinorUnits(openingBalanceMinor),
    cashIn: fromMinorUnits(cashInMinor),
    cashOut: fromMinorUnits(cashOutMinor),
    expectedCash: fromMinorUnits(expectedCashMinor),
    closingBalance:
      closingBalanceMinor != null ? fromMinorUnits(closingBalanceMinor) : null,
    cashDifference: fromMinorUnits(cashDifferenceMinor),
    totalRevenue: fromMinorUnits(totalRevenueMinor),
    totalCash: fromMinorUnits(totalCashMinor),
    totalCard: fromMinorUnits(totalCardMinor),
    totalMealCard: fromMinorUnits(totalMealCardMinor),
    totalMultinet: fromMinorUnits(totalMultinetMinor),
    totalLedger: fromMinorUnits(totalLedgerMinor),
    closedTablesCount:
      completedOrders.length || Number(shift.transactionCount || 0),
    discountTotal: fromMinorUnits(ordersDiscountMinor),
    mealAndMultinetCombined: fromMinorUnits(
      totalMealCardMinor + totalMultinetMinor,
    ),
    isAutoClosed: Boolean(shift.isAutoClosed),
    carriedOverTablesCount: Number(shift.carriedOverTablesCount ?? 0),
    carriedOverTablesAmount: Number(shift.carriedOverTablesAmount ?? 0),
  };
}
