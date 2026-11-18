import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  computeDiscountMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from '../../../common/money/minor-units';
import { EffectivePolicyLimits, PermissionKey } from '../permissions.catalog';

export const PAYMENT_METHODS = [
  'cash',
  'credit-card',
  'meal-card',
  'multinet',
  'split',
  'ledger',
] as const;

export type SettlementPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SPLIT_PAYMENT_METHODS = [
  'cash',
  'credit-card',
  'meal-card',
  'multinet',
  'ledger',
] as const;

export type SettlementSplitMethod = (typeof SPLIT_PAYMENT_METHODS)[number];

export interface SettlementDiscountInput {
  type: 'percent' | 'amount' | 'complimentary';
  value: number;
  reason?: string;
  appliedBy?: string;
}

export interface SettlementSplitInput {
  method: SettlementSplitMethod;
  amount: number;
}

export interface SettlementActorPolicy {
  isBoss?: boolean;
  permissions?: PermissionKey[];
  limits?: EffectivePolicyLimits;
}

export interface CheckSettlementInput {
  rawTotalMinorUnits: number;
  method: SettlementPaymentMethod;
  discount?: SettlementDiscountInput | null;
  splitDetails?: SettlementSplitInput[] | null;
  ledgerCustomerId?: string | null;
  ledgerDebtAmount?: number | null;
  tip?: number | null;
}

export interface NormalizedPaymentSplit {
  method: string;
  amount: number;
}

export interface DiscountSnapshot {
  type: 'percent' | 'amount' | 'complimentary';
  value: number;
  reason: string;
  appliedBy?: string;
}

export interface MethodBreakdownMinorUnits {
  cashMinorUnits: number;
  cardMinorUnits: number;
  mealCardMinorUnits: number;
  multinetMinorUnits: number;
  ledgerMinorUnits: number;
}

export interface CheckSettlementResult extends MethodBreakdownMinorUnits {
  rawTotalMinorUnits: number;
  discountMinorUnits: number;
  netMinorUnits: number;
  tipMinorUnits: number;
  normalizedSplits?: NormalizedPaymentSplit[];
  discountSnapshot?: DiscountSnapshot;
}

function emptyBreakdown(): MethodBreakdownMinorUnits {
  return {
    cashMinorUnits: 0,
    cardMinorUnits: 0,
    mealCardMinorUnits: 0,
    multinetMinorUnits: 0,
    ledgerMinorUnits: 0,
  };
}

function addTenderPart(
  target: MethodBreakdownMinorUnits,
  method: string,
  amountMinorUnits: number,
): void {
  if (method === 'cash') target.cashMinorUnits += amountMinorUnits;
  else if (method === 'credit-card') target.cardMinorUnits += amountMinorUnits;
  else if (method === 'meal-card') target.mealCardMinorUnits += amountMinorUnits;
  else if (method === 'multinet') target.multinetMinorUnits += amountMinorUnits;
  else if (method === 'ledger') target.ledgerMinorUnits += amountMinorUnits;
}

function sumBreakdown(b: MethodBreakdownMinorUnits): number {
  return (
    b.cashMinorUnits +
    b.cardMinorUnits +
    b.mealCardMinorUnits +
    b.multinetMinorUnits +
    b.ledgerMinorUnits
  );
}

export class CheckSettlementPolicy {
  static assertDiscountAllowedForActor(
    rawTotalMinorUnits: number,
    discountMinorUnits: number,
    discountDto: SettlementDiscountInput | null | undefined,
    actor?: SettlementActorPolicy,
  ): void {
    if (discountMinorUnits <= 0 || !actor || actor.isBoss) {
      return;
    }
    const perms = actor.permissions ?? [];
    const limits = actor.limits ?? { maxDiscountPercent: 0, maxDiscountAmount: 0 };

    if (
      discountDto?.type === 'complimentary' ||
      (rawTotalMinorUnits > 0 && discountMinorUnits >= rawTotalMinorUnits)
    ) {
      if (!perms.includes('discount.complimentary')) {
        throw new ForbiddenException(
          'You do not have permission to apply a 100% complimentary discount (discount.complimentary)',
        );
      }
      return;
    }

    if (discountDto?.type === 'percent' && !perms.includes('discount.apply_percent')) {
      throw new ForbiddenException(
        'You do not have permission to apply a percentage discount (discount.apply_percent)',
      );
    }
    if (discountDto?.type === 'amount' && !perms.includes('discount.apply_amount')) {
      throw new ForbiddenException(
        'You do not have permission to apply an amount discount (discount.apply_amount)',
      );
    }

    const maxAllowedByPercent = Math.round(
      (rawTotalMinorUnits * limits.maxDiscountPercent) / 100,
    );
    if (discountMinorUnits > maxAllowedByPercent) {
      throw new ForbiddenException(
        `Discount exceeds your maximum percentage discount limit of ${limits.maxDiscountPercent}%`,
      );
    }

    if (
      limits.maxDiscountAmount != null &&
      discountMinorUnits > toMinorUnits(limits.maxDiscountAmount)
    ) {
      throw new ForbiddenException(
        `Discount exceeds your maximum amount discount limit of ${limits.maxDiscountAmount} TL`,
      );
    }
  }

  private static computeSingleTender(
    input: CheckSettlementInput,
    netMinorUnits: number,
  ): MethodBreakdownMinorUnits {
    const breakdown = emptyBreakdown();
    if (input.method === 'ledger') {
      if (!input.ledgerCustomerId) {
        throw new BadRequestException(
          'A ledger customer must be selected for ledger settlement',
        );
      }
      if (input.ledgerDebtAmount != null) {
        const requestedLedgerMinor = Math.max(0, toMinorUnits(input.ledgerDebtAmount));
        if (requestedLedgerMinor !== netMinorUnits) {
          throw new BadRequestException(
            'Ledger settlement amount must equal the net check amount (use split payment for partial ledger)',
          );
        }
      }
    }
    addTenderPart(breakdown, input.method, netMinorUnits);
    return breakdown;
  }

  private static computeSplitTender(
    input: CheckSettlementInput,
    netMinorUnits: number,
  ): {
    breakdown: MethodBreakdownMinorUnits;
    normalizedSplits: NormalizedPaymentSplit[];
  } {
    if (netMinorUnits > 0 && (!input.splitDetails || input.splitDetails.length === 0)) {
      throw new BadRequestException('Split payment breakdown is required');
    }
    const breakdown = emptyBreakdown();
    const normalizedSplits: NormalizedPaymentSplit[] = [];

    for (const split of input.splitDetails ?? []) {
      const partMinorUnits = toMinorUnits(split.amount);
      if (partMinorUnits < 0) {
        throw new BadRequestException('Split payment amount cannot be negative');
      }
      if (partMinorUnits === 0) continue;
      addTenderPart(breakdown, split.method, partMinorUnits);
      normalizedSplits.push({
        method: split.method,
        amount: fromMinorUnits(partMinorUnits),
      });
    }

    if (
      breakdown.ledgerMinorUnits === 0 &&
      input.ledgerCustomerId &&
      input.ledgerDebtAmount != null
    ) {
      const extraLedgerMinorUnits = Math.max(0, toMinorUnits(input.ledgerDebtAmount));
      if (extraLedgerMinorUnits > 0) {
        breakdown.ledgerMinorUnits += extraLedgerMinorUnits;
        normalizedSplits.push({
          method: 'ledger',
          amount: fromMinorUnits(extraLedgerMinorUnits),
        });
      }
    }

    if (sumBreakdown(breakdown) !== netMinorUnits) {
      throw new BadRequestException(
        'Split payment total must equal the net check amount',
      );
    }

    return { breakdown, normalizedSplits };
  }

  private static buildDiscountSnapshot(
    discount: SettlementDiscountInput | null | undefined,
    discountMinorUnits: number,
  ): DiscountSnapshot | undefined {
    if (!discount || discountMinorUnits <= 0) return undefined;
    return {
      type: discount.type,
      value: discount.type === 'complimentary' ? 100 : discount.value,
      reason:
        discount.reason?.trim() ||
        (discount.type === 'complimentary' ? 'Complimentary' : 'Discount'),
      ...(discount.appliedBy?.trim()
        ? { appliedBy: discount.appliedBy.trim() }
        : {}),
    };
  }

  static computeSettlement(input: CheckSettlementInput): CheckSettlementResult {
    const rawTotalMinorUnits = Math.max(0, input.rawTotalMinorUnits);
    const discountMinorUnits = computeDiscountMinorUnits(
      rawTotalMinorUnits,
      input.discount ?? null,
    );
    const netMinorUnits = Math.max(0, rawTotalMinorUnits - discountMinorUnits);
    const tipMinorUnits =
      input.tip != null ? Math.max(0, toMinorUnits(input.tip)) : 0;

    const splitOutcome =
      input.method === 'split'
        ? this.computeSplitTender(input, netMinorUnits)
        : null;
    const breakdown = splitOutcome
      ? splitOutcome.breakdown
      : this.computeSingleTender(input, netMinorUnits);

    if (sumBreakdown(breakdown) !== netMinorUnits) {
      throw new BadRequestException(
        'Payment settlement total must equal the net check amount',
      );
    }

    if (
      (breakdown.ledgerMinorUnits > 0 || input.method === 'ledger') &&
      !input.ledgerCustomerId
    ) {
      throw new BadRequestException(
        'ledgerCustomerId is required when recording a ledger debt',
      );
    }

    return {
      rawTotalMinorUnits,
      discountMinorUnits,
      netMinorUnits,
      tipMinorUnits,
      ...breakdown,
      normalizedSplits: splitOutcome?.normalizedSplits,
      discountSnapshot: this.buildDiscountSnapshot(input.discount, discountMinorUnits),
    };
  }

  static computeMethodBreakdownMinorUnits(
    method: string,
    netMinorUnits: number,
    splitDetails?: Array<{ method: string; amount: number }> | null,
  ): MethodBreakdownMinorUnits {
    const breakdown = emptyBreakdown();
    if (method === 'split' && Array.isArray(splitDetails)) {
      for (const s of splitDetails) {
        addTenderPart(breakdown, s.method, Math.max(0, toMinorUnits(s.amount)));
      }
      return breakdown;
    }
    addTenderPart(breakdown, method, netMinorUnits);
    return breakdown;
  }
}
