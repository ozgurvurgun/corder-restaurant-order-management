import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  addMonthsToPeriod,
  buildConsecutivePeriods,
  computeRestaurantBillingSummary,
  normalizeAndSortPeriods,
} from './subscription-billing.policy';

describe('SubscriptionBillingPolicy', () => {
  it('builds consecutive multi-month periods across year boundaries', () => {
    assert.equal(addMonthsToPeriod('2026-11', 2), '2027-01');
    assert.deepEqual(buildConsecutivePeriods('2026-11', 3), [
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
    assert.deepEqual(
      normalizeAndSortPeriods(['2027-01', '2026-11', '2026-12', '2026-11']),
      ['2026-11', '2026-12', '2027-01'],
    );
  });

  it('marks venue pending before collection end day when current month is unpaid and no past months are unpaid', () => {
    const summary = computeRestaurantBillingSummary({
      status: 'active',
      monthlyFee: 2500,
      billingStartPeriod: '2026-11',
      isAccessSuspended: false,
      payments: [],
      collectionEndDay: 30,
      now: new Date('2026-11-18T12:00:00Z'),
    });

    assert.equal(summary.billingStatus, 'pending');
    assert.equal(summary.isCurrentPeriodPaid, false);
    assert.deepEqual(summary.duePeriods, ['2026-11']);
    assert.deepEqual(summary.overduePeriods, []);
    assert.equal(summary.nextUnpaidPeriod, '2026-11');
  });

  it('keeps venue paid across prepaid 3-month packages and proposes month+4 as nextUnpaidPeriod', () => {
    const summary = computeRestaurantBillingSummary({
      status: 'active',
      monthlyFee: 2500,
      billingStartPeriod: '2026-11',
      isAccessSuspended: false,
      payments: [
        {
          periods: ['2026-11', '2026-12', '2027-01'],
          amount: 7500,
          paidAt: '2026-11-18T10:00:00Z',
        },
      ],
      collectionEndDay: 30,
      now: new Date('2026-12-27T12:00:00Z'),
    });

    assert.equal(summary.billingStatus, 'paid');
    assert.equal(summary.isCurrentPeriodPaid, true);
    assert.equal(summary.paidThroughPeriod, '2027-01');
    assert.deepEqual(summary.prepaidFuturePeriods, ['2027-01']);
    assert.deepEqual(summary.duePeriods, []);
    assert.deepEqual(summary.overduePeriods, []);
    assert.equal(summary.nextUnpaidPeriod, '2027-02');
  });

  it('tracks retroactive missed past months as overdue until paid', () => {
    const summary = computeRestaurantBillingSummary({
      status: 'active',
      monthlyFee: 2500,
      billingStartPeriod: '2026-09',
      isAccessSuspended: false,
      payments: [
        {
          periods: ['2026-09'],
          amount: 2500,
          paidAt: '2026-09-26T10:00:00Z',
        },
      ],
      collectionEndDay: 30,
      now: new Date('2026-11-18T12:00:00Z'),
    });

    assert.equal(summary.billingStatus, 'overdue');
    assert.deepEqual(summary.overduePeriods, ['2026-10']);
    assert.deepEqual(summary.duePeriods, ['2026-10', '2026-11']);
    assert.equal(summary.nextUnpaidPeriod, '2026-10');
  });
});
