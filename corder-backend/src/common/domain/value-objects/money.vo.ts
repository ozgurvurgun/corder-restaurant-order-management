import { BadRequestException } from '@nestjs/common';

export interface DiscountSpecification {
  type: 'percent' | 'amount' | 'complimentary';
  value: number;
}

/**
 * Immutable Value Object representing a monetary amount in integer minor units (e.g. cents).
 * Prevents IEEE-754 floating-point drift during financial calculations.
 */
export class Money {
  private readonly _minorUnits: number;

  private constructor(minorUnits: number) {
    if (!Number.isFinite(minorUnits)) {
      throw new BadRequestException('Invalid minor unit amount');
    }
    this._minorUnits = Math.round(minorUnits);
  }

  static zero(): Money {
    return new Money(0);
  }

  static fromMinor(minorUnits: number): Money {
    return new Money(minorUnits);
  }

  static fromMajor(amount: number | string | null | undefined): Money {
    if (amount === null || amount === undefined || amount === '') {
      return Money.zero();
    }
    const num = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid monetary amount');
    }
    return new Money(Math.round(num * 100));
  }

  get minorUnits(): number {
    return this._minorUnits;
  }

  toMajor(): number {
    return Number((this._minorUnits / 100).toFixed(2));
  }

  add(other: Money): Money {
    return new Money(this._minorUnits + other._minorUnits);
  }

  subtract(other: Money): Money {
    return new Money(this._minorUnits - other._minorUnits);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new BadRequestException('Invalid multiplication factor');
    }
    return new Money(Math.round(this._minorUnits * factor));
  }

  clampNonNegative(): Money {
    return this._minorUnits < 0 ? Money.zero() : this;
  }

  isZero(): boolean {
    return this._minorUnits === 0;
  }

  isPositive(): boolean {
    return this._minorUnits > 0;
  }

  isNegative(): boolean {
    return this._minorUnits < 0;
  }

  equals(other: Money): boolean {
    return this._minorUnits === other._minorUnits;
  }

  computeDiscount(discount?: DiscountSpecification | null): Money {
    if (!discount || this._minorUnits <= 0) {
      return Money.zero();
    }
    if (discount.type === 'complimentary') {
      return this;
    }
    const val = Number(discount.value);
    if (!Number.isFinite(val) || val <= 0) {
      return Money.zero();
    }

    if (discount.type === 'percent') {
      if (val >= 100) {
        return this;
      }
      const raw = Math.round((this._minorUnits * val) / 100);
      return new Money(Math.min(this._minorUnits, Math.max(0, raw)));
    }

    const discountMinor = Math.max(0, Money.fromMajor(val).minorUnits);
    return new Money(Math.min(discountMinor, this._minorUnits));
  }
}
