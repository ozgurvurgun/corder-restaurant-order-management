import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeDiscountMinorUnits,
  fromMinorUnits,
  toMinorUnits,
} from '../../../common/money/minor-units';
import { CheckSettlementPolicy } from './check-settlement.policy';
import { OrderStatusPolicy } from './order-status.policy';
import {
  BossOverviewPolicy,
  computeIstanbulDateBoundaries,
  getIstanbulHour,
} from './boss-overview.policy';
import { formatTitleCase, normalizeStorageText } from '../../../common/text/text-normalizer';
import { CashShiftEntity } from '../cash-shift.entity';
import { TableEntity } from '../table.entity';
import { OrderItemEntity } from '../order-item.entity';
import { CompletedOrderEntity } from '../completed-order.entity';
import { RestaurantEntity } from '../../../platform/domain/restaurant.entity';

describe('Money VO & CheckSettlementPolicy', () => {
  it('handles IEEE-754 floating point amounts without minor-unit drift', () => {
    const a = toMinorUnits(0.1);
    const b = toMinorUnits(0.2);
    assert.equal(a + b, 30);
    assert.equal(fromMinorUnits(a + b), 0.3);
    assert.equal(toMinorUnits(19.99), 1999);
    assert.equal(fromMinorUnits(1999), 19.99);
  });

  it('computes percent, amount, and complimentary discounts accurately', () => {
    assert.equal(
      computeDiscountMinorUnits(10000, { type: 'percent', value: 15 }),
      1500,
    );
    assert.equal(
      computeDiscountMinorUnits(10000, { type: 'amount', value: 25.5 }),
      2550,
    );
    assert.equal(
      computeDiscountMinorUnits(10000, { type: 'complimentary', value: 0 }),
      10000,
    );
  });

  it('reconciles split payments including ledger and rejects mismatched totals', () => {
    const res = CheckSettlementPolicy.computeSettlement({
      rawTotalMinorUnits: 30000, // 300.00 TL
      method: 'split',
      discount: { type: 'amount', value: 50, reason: 'Promo' },
      splitDetails: [
        { method: 'cash', amount: 100 },
        { method: 'credit-card', amount: 100 },
        { method: 'ledger', amount: 50 },
      ],
      ledgerCustomerId: 'cust-1',
      tip: 20,
    });

    assert.equal(res.rawTotalMinorUnits, 30000);
    assert.equal(res.discountMinorUnits, 5000);
    assert.equal(res.netMinorUnits, 25000);
    assert.equal(res.cashMinorUnits, 10000);
    assert.equal(res.cardMinorUnits, 10000);
    assert.equal(res.ledgerMinorUnits, 5000);
    assert.equal(res.tipMinorUnits, 2000);

    assert.throws(
      () =>
        CheckSettlementPolicy.computeSettlement({
          rawTotalMinorUnits: 10000,
          method: 'split',
          splitDetails: [
            { method: 'cash', amount: 33.33 },
            { method: 'credit-card', amount: 33.33 },
            { method: 'meal-card', amount: 33.33 },
          ],
        }),
      /Split payment total must equal the net check amount/,
    );
  });

  it('rejects partial ledgerDebtAmount when method is single-tender ledger', () => {
    assert.throws(
      () =>
        CheckSettlementPolicy.computeSettlement({
          rawTotalMinorUnits: 20000,
          method: 'ledger',
          ledgerCustomerId: 'cust-1',
          ledgerDebtAmount: 150,
        }),
      /Ledger settlement amount must equal the net check amount/,
    );
  });

  it('enforces actor discount permissions and limits', () => {
    assert.throws(
      () =>
        CheckSettlementPolicy.assertDiscountAllowedForActor(
          10000,
          10000,
          { type: 'complimentary', value: 100 },
          {
            isBoss: false,
            permissions: ['discount.apply_percent'],
            limits: { maxDiscountPercent: 50, maxDiscountAmount: 500 },
          },
        ),
      /discount\.complimentary/,
    );

    assert.throws(
      () =>
        CheckSettlementPolicy.assertDiscountAllowedForActor(
          10000,
          3000,
          { type: 'percent', value: 30 },
          {
            isBoss: false,
            permissions: ['discount.apply_percent'],
            limits: { maxDiscountPercent: 20, maxDiscountAmount: null },
          },
        ),
      /maximum percentage discount limit of 20%/,
    );
  });
});

describe('CashShiftEntity & TableEntity & OrderItemEntity', () => {
  it('reconciles cashIn and totalCash when a check is edited from cash to card', () => {
    const shift = new CashShiftEntity();
    shift.openingBalance = 1000;
    shift.cashIn = 0;
    shift.cashOut = 0;
    shift.totalRevenue = 0;
    shift.totalCash = 0;
    shift.totalCard = 0;
    shift.totalMealCard = 0;
    shift.totalMultinet = 0;
    shift.transactionCount = 0;

    shift.recordCheckSettlement({
      netMinorUnits: 50000,
      cashMinorUnits: 50000,
      cardMinorUnits: 0,
      mealCardMinorUnits: 0,
      multinetMinorUnits: 0,
    });
    assert.equal(shift.cashIn, 500);
    assert.equal(shift.totalCash, 500);
    assert.equal(shift.totalRevenue, 500);

    // Edit check from 500 TL Cash to 500 TL Card
    shift.adjustSettlementDiff({
      netDiffMinorUnits: 0,
      cashDiffMinorUnits: -50000,
      cardDiffMinorUnits: 50000,
      mealCardDiffMinorUnits: 0,
      multinetDiffMinorUnits: 0,
    });
    assert.equal(shift.cashIn, 0);
    assert.equal(shift.cashOut, 0);
    assert.equal(shift.totalCash, 0);
    assert.equal(shift.totalCard, 500);
    assert.equal(shift.totalRevenue, 500);
  });

  it('expires table session locks after stale threshold', () => {
    const table = new TableEntity();
    const lockedAt = new Date('2026-11-17T10:00:00Z');
    table.lockSession('staff-1', 'Ali', lockedAt);

    const withinWindow = new Date('2026-11-17T10:01:30Z');
    assert.equal(table.hasActiveLock(120_000, withinWindow), true);
    assert.equal(table.isLockedByOther('staff-2', 120_000, withinWindow), true);
    assert.equal(table.isLockedByOther('staff-1', 120_000, withinWindow), false);

    const afterExpiry = new Date('2026-11-17T10:02:05Z');
    assert.equal(table.hasActiveLock(120_000, afterExpiry), false);
    assert.equal(table.isLockedByOther('staff-2', 120_000, afterExpiry), false);
  });

  it('resolves order status when items are cancelled or assigned to ledger', () => {
    const item1 = new OrderItemEntity();
    item1.price = 120;
    item1.quantity = 2;
    item1.status = 'sent';

    const partial = item1.assignToLedger(1);
    assert.equal(partial.fullAssignment, false);
    assert.equal(item1.quantity, 1);
    assert.equal(OrderStatusPolicy.resolveOrderStatus([item1]), 'active');

    item1.cancel('Customer changed mind', 'Manager');
    assert.equal(item1.status, 'cancelled');
    assert.equal(OrderStatusPolicy.resolveOrderStatus([item1]), 'closed');
  });

  it('supports partial and full takeQuantity for item cancel and table transfer', () => {
    const item = new OrderItemEntity();
    item.price = 95;
    item.quantity = 4;
    item.status = 'sent';

    const partial = item.takeQuantity(2);
    assert.deepEqual(partial, { full: false, quantity: 2 });
    assert.equal(item.quantity, 2);

    assert.throws(() => item.takeQuantity(0));
    assert.throws(() => item.takeQuantity(3));

    const full = item.takeQuantity(2);
    assert.deepEqual(full, { full: true, quantity: 2 });
    assert.equal(item.quantity, 2);
  });

  it('deducts cashOut for cash expenses but not for credit-card expenses', () => {
    const shift = new CashShiftEntity();
    shift.openingBalance = 1000;
    shift.cashIn = 0;
    shift.cashOut = 0;
    shift.transactionCount = 0;

    shift.recordCashMovement('expense', 25000, true, 'cash');
    assert.equal(shift.cashOut, 250);
    assert.equal(shift.transactionCount, 1);

    shift.recordCashMovement('expense', 40000, true, 'credit-card');
    assert.equal(shift.cashOut, 250);
    assert.equal(shift.transactionCount, 2);
  });

  it('normalizes text to lowercase for storage and Title Case across global Unicode scripts for UI', () => {
    assert.equal(normalizeStorageText('  NARGİLE   MENÜ  '), 'nargile menü');
    assert.equal(normalizeStorageText('İZMİR   IŞIK'), 'izmir ışık');
    assert.equal(normalizeStorageText('  Москва   Чай  '), 'москва чай');
    assert.equal(formatTitleCase('  NARGİLE   MENÜ  '), 'Nargile Menü');
    assert.equal(formatTitleCase('ırmak'), 'Irmak');
    assert.equal(formatTitleCase('nargile  + çerez tabağı + çay'), 'Nargile + Çerez Tabağı + Çay');
    assert.equal(formatTitleCase('marilyn monroe (merlin)'), 'Marilyn Monroe (Merlin)');
    assert.equal(formatTitleCase('soda/limon'), 'Soda/Limon');
    assert.equal(formatTitleCase('москва чай'), 'Москва Чай');
    assert.equal(formatTitleCase('crème brûlée'), 'Crème Brûlée');
    assert.equal(formatTitleCase('ice tea'), 'Ice Tea');
  });
});

describe('BossOverviewPolicy (Europe/Istanbul & Minor Units)', () => {
  it('computes Europe/Istanbul business day boundaries across UTC midnight', () => {
    // 2026-11-16T22:30:00Z is 2026-11-17T01:30:00+03:00 in Istanbul
    const nowUtc = new Date('2026-11-16T22:30:00.000Z');
    const { startOfToday, startOfMonth } = computeIstanbulDateBoundaries(nowUtc);

    // Midnight Nov 17 in Istanbul is 2026-11-16T21:00:00.000Z
    assert.equal(startOfToday.toISOString(), '2026-11-16T21:00:00.000Z');
    // Midnight Nov 1 in Istanbul is 2026-10-31T21:00:00.000Z
    assert.equal(startOfMonth.toISOString(), '2026-10-31T21:00:00.000Z');
    assert.equal(getIstanbulHour(nowUtc), 1);
  });

  it('includes split ledger payments in branch pulse and consolidated breakdown', () => {
    const branch = new RestaurantEntity();
    branch.id = 'rest-1';
    branch.name = 'Kadıköy Şube';
    branch.slug = 'kadikoy';
    branch.status = 'active';
    branch.branchType = 'franchise';
    branch.royaltyRate = '5.00';

    const startOfToday = new Date('2026-11-16T21:00:00.000Z');
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date('2026-10-31T21:00:00.000Z');

    const co = new CompletedOrderEntity();
    co.id = 'co-1';
    co.restaurantId = 'rest-1';
    co.totalAmount = 250.3;
    co.discountAmount = 0;
    co.netAmount = 250.3;
    co.paymentMethod = 'split';
    co.paymentSplit = [
      { method: 'cash', amount: 100.1 },
      { method: 'credit-card', amount: 100.1 },
      { method: 'ledger', amount: 50.1 },
    ];
    co.ordersSnapshot = [];
    co.closedAt = new Date('2026-11-17T08:00:00.000Z');

    const pulse = BossOverviewPolicy.buildBranchPulse({
      branch,
      tables: [],
      activeOrders: [],
      itemsByOrderId: new Map(),
      completedMonth: [co],
      openShifts: [],
      materials: [],
      staffList: [],
      openLedgerBalanceByBranchId: new Map([['rest-1', 50.1]]),
      startOfToday,
      startOfWeek,
      startOfMonth,
    });

    assert.equal(pulse.todayRevenue, 250.3);
    assert.deepEqual(pulse.paymentBreakdown, {
      cash: 100.1,
      creditCard: 100.1,
      mealCard: 0,
      multinet: 0,
      ledger: 50.1,
    });
    assert.equal(pulse.openLedgerBalance, 50.1);
  });
});
