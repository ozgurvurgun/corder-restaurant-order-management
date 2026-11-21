import { BadRequestException } from '@nestjs/common';
import {
  RestaurantSubscriptionPaymentEntity,
  SubscriptionPaymentMethod,
} from './restaurant-subscription-payment.entity';

export type RestaurantBillingStatus = 'paid' | 'pending' | 'overdue' | 'suspended';

export interface RestaurantPaymentRecord {
  id: string;
  restaurantId: string;
  /** Compact period label, e.g. '2026-11' or '2026-11..2027-01'. */
  period: string;
  periods: string[];
  periodStart: string;
  periodEnd: string;
  monthsCount: number;
  amount: number;
  paidAt: string;
  paymentMethod: SubscriptionPaymentMethod;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface ComputedRestaurantBillingSummary {
  billingStartPeriod: string;
  billingStatus: RestaurantBillingStatus;
  currentPeriod: string;
  isCurrentPeriodPaid: boolean;
  paidPeriods: string[];
  paidThroughPeriod: string | null;
  prepaidFuturePeriods: string[];
  overduePeriods: string[];
  duePeriods: string[];
  nextUnpaidPeriod: string;
  lastPaymentDate: Date | null;
  lastPaidPeriod: string | null;
  totalCollectedAmount: number;
}

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidBillingPeriod(period: string | null | undefined): period is string {
  if (!period || typeof period !== 'string') return false;
  return PERIOD_REGEX.test(period.trim());
}

export function comparePeriods(a: string, b: string): number {
  return a.localeCompare(b);
}

export function addMonthsToPeriod(period: string, deltaMonths: number): string {
  const trimmed = period.trim();
  if (!isValidBillingPeriod(trimmed)) {
    throw new BadRequestException(`Invalid billing period format: ${period}`);
  }
  const [yStr, mStr] = trimmed.split('-');
  const totalMonths = Number(yStr) * 12 + (Number(mStr) - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

export function buildConsecutivePeriods(
  startPeriod: string,
  monthsCount: number,
): string[] {
  const count = Math.max(1, Math.min(36, Math.floor(monthsCount)));
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(addMonthsToPeriod(startPeriod, i));
  }
  return result;
}

export function enumeratePeriodsInclusive(
  startPeriod: string,
  endPeriod: string,
): string[] {
  if (!isValidBillingPeriod(startPeriod) || !isValidBillingPeriod(endPeriod)) {
    return [];
  }
  if (comparePeriods(startPeriod, endPeriod) > 0) {
    return [];
  }
  const out: string[] = [];
  let cursor = startPeriod;
  let guard = 0;
  while (comparePeriods(cursor, endPeriod) <= 0 && guard < 240) {
    out.push(cursor);
    cursor = addMonthsToPeriod(cursor, 1);
    guard += 1;
  }
  return out;
}

export function normalizeAndSortPeriods(rawPeriods: string[]): string[] {
  const unique = new Set<string>();
  for (const item of rawPeriods) {
    const cleaned = (item ?? '').trim();
    if (!isValidBillingPeriod(cleaned)) {
      throw new BadRequestException(
        `Invalid billing period "${item}". Expected YYYY-MM (e.g. 2026-11).`,
      );
    }
    unique.add(cleaned);
  }
  const sorted = Array.from(unique).sort(comparePeriods);
  if (sorted.length === 0) {
    throw new BadRequestException('At least one valid billing period (YYYY-MM) is required.');
  }
  return sorted;
}

/** Permanent UTC+3 offset for Europe/Istanbul. */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function dateToIstanbulPeriod(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getIstanbulCalendarNow(now: Date = new Date()): {
  currentPeriod: string;
  dayOfMonth: number;
} {
  const shifted = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = shifted.getUTCDate();
  return {
    currentPeriod: `${y}-${m}`,
    dayOfMonth: Number.isFinite(d) && d >= 1 && d <= 31 ? d : now.getUTCDate(),
  };
}

export function toPaymentRecordDto(
  entity: RestaurantSubscriptionPaymentEntity,
): RestaurantPaymentRecord {
  const sortedPeriods = Array.isArray(entity.periods)
    ? [...entity.periods].filter(isValidBillingPeriod).sort(comparePeriods)
    : isValidBillingPeriod(entity.periodStart)
      ? [entity.periodStart]
      : [];
  const periodStart = sortedPeriods[0] ?? entity.periodStart;
  const periodEnd = sortedPeriods[sortedPeriods.length - 1] ?? entity.periodEnd;
  const monthsCount = sortedPeriods.length || entity.monthsCount || 1;
  const period =
    monthsCount === 1 || periodStart === periodEnd
      ? periodStart
      : `${periodStart}..${periodEnd}`;

  return {
    id: entity.id,
    restaurantId: entity.restaurantId,
    period,
    periods: sortedPeriods,
    periodStart,
    periodEnd,
    monthsCount,
    amount: Number(entity.amount || 0),
    paidAt:
      entity.paidAt instanceof Date
        ? entity.paidAt.toISOString()
        : new Date(entity.paidAt).toISOString(),
    paymentMethod: entity.paymentMethod || 'bank_transfer',
    note: entity.note ?? null,
    recordedBy: entity.recordedBy ?? null,
    createdAt:
      entity.createdAt instanceof Date
        ? entity.createdAt.toISOString()
        : new Date(entity.createdAt).toISOString(),
  };
}

export function computeRestaurantBillingSummary(params: {
  status: string;
  monthlyFee: number | string | null | undefined;
  billingStartPeriod?: string | null;
  createdAt?: Date | string | null;
  isAccessSuspended?: boolean | null;
  payments: Array<{
    periods: string[];
    amount: number | string;
    paidAt: Date | string;
  }>;
  collectionEndDay?: number;
  now?: Date;
}): ComputedRestaurantBillingSummary {
  const { currentPeriod, dayOfMonth } = getIstanbulCalendarNow(params.now ?? new Date());
  const collectionEndDay = params.collectionEndDay ?? 30;
  const monthlyFee = Math.max(0, Number(params.monthlyFee || 0));
  const isSuspended = Boolean(params.isAccessSuspended);

  const fallbackCreatedDate = params.createdAt
    ? params.createdAt instanceof Date
      ? params.createdAt
      : new Date(params.createdAt)
    : new Date();
  const rawStart = isValidBillingPeriod(params.billingStartPeriod)
    ? params.billingStartPeriod.trim()
    : dateToIstanbulPeriod(
        Number.isNaN(fallbackCreatedDate.getTime()) ? new Date() : fallbackCreatedDate,
      );

  const paidSet = new Set<string>();
  let latestPaidAt: Date | null = null;
  let totalMinor = 0;

  for (const p of params.payments) {
    totalMinor += Math.round((Number(p.amount) || 0) * 100);
    const d = p.paidAt instanceof Date ? p.paidAt : new Date(p.paidAt);
    if (!Number.isNaN(d.getTime())) {
      if (!latestPaidAt || d.getTime() > latestPaidAt.getTime()) {
        latestPaidAt = d;
      }
    }
    for (const per of p.periods ?? []) {
      if (isValidBillingPeriod(per)) {
        paidSet.add(per.trim());
      }
    }
  }

  const paidPeriods = Array.from(paidSet).sort(comparePeriods);
  const earliestPaid = paidPeriods[0] ?? null;
  const billingStartPeriod =
    earliestPaid && comparePeriods(earliestPaid, rawStart) < 0 ? earliestPaid : rawStart;
  const paidThroughPeriod =
    paidPeriods.length > 0 ? paidPeriods[paidPeriods.length - 1] : null;

  const isBeforeStart = comparePeriods(currentPeriod, billingStartPeriod) < 0;
  const isBillable = params.status === 'active' && monthlyFee > 0;

  const isCurrentPeriodPaid =
    !isBillable || isBeforeStart || paidSet.has(currentPeriod);

  const prepaidFuturePeriods = paidPeriods.filter(
    (per) => comparePeriods(per, currentPeriod) > 0,
  );

  const duePeriods: string[] = [];
  const overduePeriods: string[] = [];

  if (isBillable && !isBeforeStart) {
    const elapsedAndCurrent = enumeratePeriodsInclusive(billingStartPeriod, currentPeriod);
    for (const per of elapsedAndCurrent) {
      if (!paidSet.has(per)) {
        duePeriods.push(per);
        const isPastMonth = comparePeriods(per, currentPeriod) < 0;
        const isPastCurrentWindow =
          per === currentPeriod && dayOfMonth > collectionEndDay;
        if (isPastMonth || isPastCurrentWindow) {
          overduePeriods.push(per);
        }
      }
    }
  }

  let nextUnpaidPeriod: string;
  if (duePeriods.length > 0) {
    nextUnpaidPeriod = duePeriods[0];
  } else if (paidThroughPeriod && comparePeriods(paidThroughPeriod, currentPeriod) >= 0) {
    nextUnpaidPeriod = addMonthsToPeriod(paidThroughPeriod, 1);
  } else if (comparePeriods(billingStartPeriod, currentPeriod) > 0) {
    nextUnpaidPeriod = billingStartPeriod;
  } else {
    nextUnpaidPeriod = currentPeriod;
  }

  let billingStatus: RestaurantBillingStatus;
  if (isSuspended) {
    billingStatus = 'suspended';
  } else if (!isBillable || isBeforeStart) {
    billingStatus = 'paid';
  } else if (overduePeriods.length > 0) {
    billingStatus = 'overdue';
  } else if (!isCurrentPeriodPaid) {
    billingStatus = 'pending';
  } else {
    billingStatus = 'paid';
  }

  return {
    billingStartPeriod,
    billingStatus,
    currentPeriod,
    isCurrentPeriodPaid,
    paidPeriods,
    paidThroughPeriod,
    prepaidFuturePeriods,
    overduePeriods,
    duePeriods,
    nextUnpaidPeriod,
    lastPaymentDate: latestPaidAt,
    lastPaidPeriod: paidThroughPeriod,
    totalCollectedAmount: Number((totalMinor / 100).toFixed(2)),
  };
}

