import { BadRequestException } from '@nestjs/common';

export function toKurus(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) {
    throw new BadRequestException('Gecersiz tutar');
  }
  return Math.round(num * 100);
}

export function fromKurus(kurus: number): number {
  if (!Number.isFinite(kurus)) {
    throw new BadRequestException('Gecersiz kurus tutari');
  }
  return Number((Math.round(kurus) / 100).toFixed(2));
}

export function computeDiscountKurus(
  rawTotalKurus: number,
  discount?: { type: 'percent' | 'amount'; value: number } | null,
): number {
  if (!discount || rawTotalKurus <= 0) return 0;
  const val = Number(discount.value);
  if (!Number.isFinite(val) || val <= 0) return 0;

  if (discount.type === 'percent') {
    if (val >= 100) return rawTotalKurus;
    const raw = Math.round((rawTotalKurus * val) / 100);
    return Math.min(rawTotalKurus, Math.max(0, raw));
  }

  const amountKurus = Math.max(0, toKurus(val));
  return Math.min(amountKurus, rawTotalKurus);
}
