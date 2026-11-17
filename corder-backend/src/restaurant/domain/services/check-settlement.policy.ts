import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  computeDiscountMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from '../../../common/money/minor-units';
import {
  CloseCheckDiscountDto,
  CloseCheckMethod,
  CloseCheckSplitDto,
} from '../../api/dto/close-check.dto';
import { EffectivePolicyLimits, PermissionKey } from '../permissions.catalog';

export interface SettlementActorPolicy {
  isBoss?: boolean;
  permissions?: PermissionKey[];
  limits?: EffectivePolicyLimits;
}

export interface CheckSettlementInput {
  rawTotalMinorUnits: number;
  method: CloseCheckMethod;
  discount?: CloseCheckDiscountDto | null;
  splitDetails?: CloseCheckSplitDto[] | null;
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
}

export interface CheckSettlementResult {
  rawTotalMinorUnits: number;
  discountMinorUnits: number;
  netMinorUnits: number;
  tipMinorUnits: number;
  cashMinorUnits: number;
  cardMinorUnits: number;
  mealCardMinorUnits: number;
  multinetMinorUnits: number;
  ledgerMinorUnits: number;
  normalizedSplits?: NormalizedPaymentSplit[];
  discountSnapshot?: DiscountSnapshot;
}

export interface MethodBreakdownMinorUnits {
  cashMinorUnits: number;
  cardMinorUnits: number;
  mealCardMinorUnits: number;
  multinetMinorUnits: number;
  ledgerMinorUnits: number;
}

export class CheckSettlementPolicy {
  static assertDiscountAllowedForActor(
    rawTotalMinorUnits: number,
    discountMinorUnits: number,
    discountDto: CloseCheckDiscountDto | null | undefined,
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

  static computeSettlement(input: CheckSettlementInput): CheckSettlementResult {
    const rawTotalMinorUnits = Math.max(0, input.rawTotalMinorUnits);
    const discountMinorUnits = computeDiscountMinorUnits(
      rawTotalMinorUnits,
      input.discount ?? null,
    );
    const netMinorUnits = Math.max(0, rawTotalMinorUnits - discountMinorUnits);
    const tipMinorUnits =
      input.tip != null ? Math.max(0, toMinorUnits(input.tip)) : 0;

    let cashMinorUnits = 0;
    let cardMinorUnits = 0;
    let mealCardMinorUnits = 0;
    let multinetMinorUnits = 0;
    let ledgerMinorUnits = 0;
    let normalizedSplits: NormalizedPaymentSplit[] | undefined;

    if (input.method === 'cash') {
      cashMinorUnits = netMinorUnits;
    } else if (input.method === 'credit-card') {
      cardMinorUnits = netMinorUnits;
    } else if (input.method === 'meal-card') {
      mealCardMinorUnits = netMinorUnits;
    } else if (input.method === 'multinet') {
      multinetMinorUnits = netMinorUnits;
    } else if (input.method === 'ledger') {
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
      ledgerMinorUnits = netMinorUnits;
    } else if (input.method === 'split') {
      if (netMinorUnits > 0 && (!input.splitDetails || input.splitDetails.length === 0)) {
        throw new BadRequestException('Split payment breakdown is required');
      }
      normalizedSplits = [];
      for (const split of input.splitDetails ?? []) {
        const partMinorUnits = toMinorUnits(split.amount);
        if (partMinorUnits < 0) {
          throw new BadRequestException('Split payment amount cannot be negative');
        }
        if (partMinorUnits === 0) continue;
        if (split.method === 'cash') cashMinorUnits += partMinorUnits;
        else if (split.method === 'credit-card') cardMinorUnits += partMinorUnits;
        else if (split.method === 'meal-card') mealCardMinorUnits += partMinorUnits;
        else if (split.method === 'multinet') multinetMinorUnits += partMinorUnits;
        else if (split.method === 'ledger') ledgerMinorUnits += partMinorUnits;
        normalizedSplits.push({
          method: split.method,
          amount: fromMinorUnits(partMinorUnits),
        });
      }
      if (
        ledgerMinorUnits === 0 &&
        input.ledgerCustomerId &&
        input.ledgerDebtAmount != null
      ) {
        const extraLedgerMinorUnits = Math.max(0, toMinorUnits(input.ledgerDebtAmount));
        if (extraLedgerMinorUnits > 0) {
          ledgerMinorUnits += extraLedgerMinorUnits;
          normalizedSplits.push({
            method: 'ledger',
            amount: fromMinorUnits(extraLedgerMinorUnits),
          });
        }
      }
      const splitSumMinorUnits =
        cashMinorUnits +
        cardMinorUnits +
        mealCardMinorUnits +
        multinetMinorUnits +
        ledgerMinorUnits;
      if (splitSumMinorUnits !== netMinorUnits) {
        throw new BadRequestException(
          'Split payment total must equal the net check amount',
        );
      }
    }

    const totalSettledMinorUnits =
      cashMinorUnits +
      cardMinorUnits +
      mealCardMinorUnits +
      multinetMinorUnits +
      ledgerMinorUnits;
    if (totalSettledMinorUnits !== netMinorUnits) {
      throw new BadRequestException(
        'Payment settlement total must equal the net check amount',
      );
    }

    if ((ledgerMinorUnits > 0 || input.method === 'ledger') && !input.ledgerCustomerId) {
      throw new BadRequestException(
        'ledgerCustomerId is required when recording a ledger debt',
      );
    }

    const discountSnapshot: DiscountSnapshot | undefined =
      input.discount && discountMinorUnits > 0
        ? {
            type: input.discount.type,
            value: input.discount.type === 'complimentary' ? 100 : input.discount.value,
            reason:
              input.discount.reason?.trim() ||
              (input.discount.type === 'complimentary' ? 'Complimentary' : 'Discount'),
          }
        : undefined;

    return {
      rawTotalMinorUnits,
      discountMinorUnits,
      netMinorUnits,
      tipMinorUnits,
      cashMinorUnits,
      cardMinorUnits,
      mealCardMinorUnits,
      multinetMinorUnits,
      ledgerMinorUnits,
      normalizedSplits,
      discountSnapshot,
    };
  }

  static computeMethodBreakdownMinorUnits(
    method: string,
    netMinorUnits: number,
    splitDetails?: Array<{ method: string; amount: number }> | null,
  ): MethodBreakdownMinorUnits {
    let cashMinorUnits = 0;
    let cardMinorUnits = 0;
    let mealCardMinorUnits = 0;
    let multinetMinorUnits = 0;
    let ledgerMinorUnits = 0;

    if (method === 'cash') cashMinorUnits = netMinorUnits;
    else if (method === 'credit-card') cardMinorUnits = netMinorUnits;
    else if (method === 'meal-card') mealCardMinorUnits = netMinorUnits;
    else if (method === 'multinet') multinetMinorUnits = netMinorUnits;
    else if (method === 'ledger') ledgerMinorUnits = netMinorUnits;
    else if (method === 'split' && Array.isArray(splitDetails)) {
      for (const s of splitDetails) {
        const part = Math.max(0, toMinorUnits(s.amount));
        if (s.method === 'cash') cashMinorUnits += part;
        else if (s.method === 'credit-card') cardMinorUnits += part;
        else if (s.method === 'meal-card') mealCardMinorUnits += part;
        else if (s.method === 'multinet') multinetMinorUnits += part;
        else if (s.method === 'ledger') ledgerMinorUnits += part;
      }
    }

    return {
      cashMinorUnits,
      cardMinorUnits,
      mealCardMinorUnits,
      multinetMinorUnits,
      ledgerMinorUnits,
    };
  }
}
