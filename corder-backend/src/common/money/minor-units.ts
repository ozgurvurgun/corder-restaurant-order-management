import { Money, DiscountSpecification } from '../domain/value-objects/money.vo';

export function toMinorUnits(amount: number | string | null | undefined): number {
  return Money.fromMajor(amount).minorUnits;
}

export function fromMinorUnits(minorUnits: number): number {
  return Money.fromMinor(minorUnits).toMajor();
}

export function computeDiscountMinorUnits(
  rawTotalMinorUnits: number,
  discount?: DiscountSpecification | null,
): number {
  return Money.fromMinor(rawTotalMinorUnits).computeDiscount(discount).minorUnits;
}
