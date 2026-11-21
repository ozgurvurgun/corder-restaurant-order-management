import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { RestaurantService } from '../src/platform/application/restaurant.service';
import { PlatformBillingService } from '../src/platform/application/platform-billing.service';
import { BossOverviewService } from '../src/restaurant/application/boss-overview.service';
import { FraudDetectionService } from '../src/restaurant/application/fraud-detection.service';
import { PrintAgentController } from '../src/restaurant/api/print-agent.controller';
import { findExistingSessionCompletedOrder } from '../src/restaurant/application/orders/completed-order-consolidation.helper';
import { CheckSettlementPolicy } from '../src/restaurant/domain/services/check-settlement.policy';
import { RestaurantEntity } from '../src/platform/domain/restaurant.entity';
import { RootAdminEntity } from '../src/platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../src/platform/domain/boss-restaurant.entity';
import { RestaurantSubscriptionPaymentEntity } from '../src/platform/domain/restaurant-subscription-payment.entity';
import { CashShiftEntity } from '../src/restaurant/domain/cash-shift.entity';
import { TableEntity } from '../src/restaurant/domain/table.entity';
import { OrderEntity } from '../src/restaurant/domain/order.entity';
import { OrderItemEntity } from '../src/restaurant/domain/order-item.entity';
import { CompletedOrderEntity } from '../src/restaurant/domain/completed-order.entity';

describe('10,000+ Restaurant Scale, Concurrency & Financial Consistency Suite', () => {
  it('SC-01: Enriches 10,000 restaurants across 50 franchise brands with 15,000 boss links and 20,000 payments in < 600ms', async () => {
    const TOTAL_RESTAURANTS = 10_000;
    const BRAND_COUNT = 50;
    const now = new Date('2026-11-20T12:00:00.000Z');

    const restaurants: RestaurantEntity[] = [];
    const links: BossRestaurantEntity[] = [];
    const bosses: RootAdminEntity[] = [];
    const payments: RestaurantSubscriptionPaymentEntity[] = [];

    for (let b = 0; b < BRAND_COUNT; b++) {
      bosses.push({
        id: `brand-boss-${b}`,
        name: `Brand HQ Boss ${b}`,
        email: `hq${b}@brand${b}.corder.com`,
        bossTier: 'brand_owner',
        brandName: `Brand-${b}`,
        isActive: true,
      } as RootAdminEntity);
    }

    for (let i = 0; i < TOTAL_RESTAURANTS; i++) {
      const restId = `rest-${i}`;
      const brandIdx = i % BRAND_COUNT;
      const franchiseBossId = `franchise-boss-${i}`;

      if (i < 2000) {
        bosses.push({
          id: franchiseBossId,
          name: `Franchise Boss ${i}`,
          email: `patron@branch${i}.corder.com`,
          bossTier: 'franchise_owner',
          brandName: null,
          isActive: true,
        } as RootAdminEntity);
      }

      restaurants.push({
        id: restId,
        name: `Branch ${i}`,
        slug: `branch-${i}`,
        status: 'active',
        brandName: `Brand-${brandIdx}`,
        branchType: i % 3 === 0 ? 'franchise' : 'company_owned',
        monthlyFee: '1500',
        royaltyRate: '5',
        billingStartPeriod: '2026-10',
        billingStatus: 'paid',
        isAccessSuspended: false,
        rootAdminId: i < 2000 ? franchiseBossId : null,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
      } as unknown as RestaurantEntity);

      links.push({
        id: `link-${i}`,
        bossId: i < 2000 ? franchiseBossId : `brand-boss-${brandIdx}`,
        restaurantId: restId,
        title: 'Branch Manager',
      } as BossRestaurantEntity);

      payments.push(
        {
          id: `pay-${i}-1`,
          restaurantId: restId,
          paidAt: new Date('2026-10-05T10:00:00.000Z'),
          amount: '1500.00',
          periods: ['2026-10', '2026-11'],
          periodStart: '2026-10',
          periodEnd: '2026-11',
          monthsCount: 2,
          paymentMethod: 'bank_transfer',
          recordedBy: 'Platform Admin',
          createdAt: now,
        } as unknown as RestaurantSubscriptionPaymentEntity,
      );
    }

    let linkChunksQueried = 0;
    let paymentChunksQueried = 0;

    const mockBossRestRepo = {
      find: async () => {
        linkChunksQueried += 1;
        return linkChunksQueried === 1 ? links : [];
      },
    };
    const mockPaymentRepo = {
      find: async () => {
        paymentChunksQueried += 1;
        return paymentChunksQueried === 1 ? payments : [];
      },
    };
    const mockRootAdminRepo = {
      find: async () => bosses,
    };
    const mockBillingConfigRepo = {
      find: async () => [{ collectionEndDay: 30 }],
    };

    const service = new RestaurantService(
      {} as never,
      mockRootAdminRepo as never,
      mockBossRestRepo as never,
      mockPaymentRepo as never,
      mockBillingConfigRepo as never,
      {} as never,
    );

    const startMs = performance.now();
    const enriched = await service.enrichRestaurantsWithBosses(restaurants);
    const elapsedMs = performance.now() - startMs;

    assert.equal(enriched.length, TOTAL_RESTAURANTS);
    assert.equal(linkChunksQueried, 5); // 10,000 / 2,000 = 5 safe parameter chunks
    assert.equal(paymentChunksQueried, 5);
    assert.ok(
      elapsedMs < 600,
      `Expected 10,000-restaurant enrichment in < 600ms, took ${elapsedMs.toFixed(1)}ms`,
    );
    // First restaurant has both its Franchise Boss and its Brand Owner (HQ)
    assert.equal(enriched[0].bosses.length, 2);
    assert.equal(enriched[0].paymentHistory.length, 1);
  });

  it('SC-02: Evaluates 10,000 active restaurants in PlatformBillingService.suspendAllUnpaidRestaurants without N+1 shift queries', async () => {
    const TOTAL = 10_000;
    const candidates: RestaurantEntity[] = [];
    const payments: RestaurantSubscriptionPaymentEntity[] = [];
    const openShifts: Array<{ restaurantId: string }> = [];

    for (let i = 0; i < TOTAL; i++) {
      const id = `rest-${i}`;
      candidates.push({
        id,
        name: `Rest ${i}`,
        status: 'active',
        isAccessSuspended: false,
        monthlyFee: '2000',
        billingStartPeriod: '2026-01',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      } as unknown as RestaurantEntity);

      if (i < 7000) {
        // 7,000 restaurants paid through 2027-12
        payments.push({
          id: `p-${i}`,
          restaurantId: id,
          periods: [
            '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
            '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
          ],
        } as unknown as RestaurantSubscriptionPaymentEntity);
      } else if (i < 8000) {
        // 1,000 overdue restaurants with an OPEN cash shift (must be deferred, NOT suspended)
        openShifts.push({ restaurantId: id });
      }
      // Remaining 2,000 restaurants (8000..9999) are overdue with no open cash shift -> must be suspended
    }

    let paymentBatchCalls = 0;
    let shiftBatchCalls = 0;
    let savedEntitiesCount = 0;
    const expiredSocketNotifications: string[] = [];

    const mockEm = {
      find: async (entity: unknown) => {
        if (entity === RestaurantEntity) return candidates;
        if (entity === RestaurantSubscriptionPaymentEntity) {
          paymentBatchCalls += 1;
          return paymentBatchCalls === 1 ? payments : [];
        }
        if (entity === CashShiftEntity) {
          shiftBatchCalls += 1;
          return shiftBatchCalls === 1 ? openShifts : [];
        }
        return [{ collectionEndDay: 30 }];
      },
      exists: async () => false,
      save: async (_entity: unknown, row: RestaurantEntity) => {
        savedEntitiesCount += 1;
        return row;
      },
    };

    const billingService = new PlatformBillingService(
      { manager: { transaction: (fn: (em: unknown) => unknown) => fn(mockEm) } } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        emitAuthExpired: (restId: string) => {
          expiredSocketNotifications.push(restId);
        },
      } as never,
    );

    const startMs = performance.now();
    const res = await billingService.suspendAllUnpaidRestaurants();
    const elapsedMs = performance.now() - startMs;

    assert.equal(res.suspendedCount, 2000);
    assert.equal(res.deferredOpenShiftCount, 1000);
    assert.equal(savedEntitiesCount, 3000);
    assert.equal(expiredSocketNotifications.length, 2000);
    assert.ok(
      elapsedMs < 600,
      `Expected 10,000-restaurant billing suspension pass in < 600ms, took ${elapsedMs.toFixed(1)}ms`,
    );
  });

  it('SC-03: Aggregates 100-branch BossOverviewService live pulse across 2,000 tables and 10,000 completed orders in < 350ms', async () => {
    const BRANCH_COUNT = 100;
    const branches: RestaurantEntity[] = [];
    const tables: TableEntity[] = [];
    const activeOrders: OrderEntity[] = [];
    const activeOrderItems: OrderItemEntity[] = [];
    const completedMonth: CompletedOrderEntity[] = [];
    const now = new Date();

    for (let b = 0; b < BRANCH_COUNT; b++) {
      const branchId = `branch-${b}`;
      branches.push({
        id: branchId,
        name: `Branch ${b}`,
        slug: `branch-${b}`,
        status: 'active',
        branchType: b % 2 === 0 ? 'franchise' : 'company_owned',
        royaltyRate: '6',
        monthlyFee: '2500',
        billingStatus: 'paid',
      } as unknown as RestaurantEntity);

      for (let t = 0; t < 20; t++) {
        const tableId = `table-${b}-${t}`;
        tables.push({
          id: tableId,
          restaurantId: branchId,
          name: `M${t + 1}`,
          section: 'Salon',
          status: t < 5 ? 'occupied' : 'empty',
        } as unknown as TableEntity);

        if (t < 5) {
          const orderId = `ord-${b}-${t}`;
          activeOrders.push({
            id: orderId,
            restaurantId: branchId,
            tableId,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          } as unknown as OrderEntity);
          activeOrderItems.push({
            id: `item-${b}-${t}`,
            orderId,
            productId: 'prod-1',
            productName: 'Latte',
            price: 120,
            quantity: 2,
            status: 'sent',
            createdAt: now,
          } as unknown as OrderItemEntity);
        }
      }

      for (let c = 0; c < 100; c++) {
        completedMonth.push({
          id: `comp-${b}-${c}`,
          restaurantId: branchId,
          tableName: 'M1',
          section: 'Salon',
          waiter: 'Ahmet',
          totalAmount: 300,
          discountAmount: 0,
          netAmount: 300,
          paymentMethod: c % 2 === 0 ? 'cash' : 'credit-card',
          paymentSplit: null,
          paymentTip: 0,
          closedBy: 'Kasa',
          openedAt: now,
          closedAt: now,
          ordersSnapshot: [],
          createdAt: now,
        } as unknown as CompletedOrderEntity);
      }
    }

    const mockEm = {
      find: async (entity: unknown) => {
        if (entity === TableEntity) return tables;
        if (entity === OrderEntity) return activeOrders;
        if (entity === OrderItemEntity) return activeOrderItems;
        return [];
      },
      createQueryBuilder: () => ({
        select: () => ({
          addSelect: () => ({
            where: () => ({
              groupBy: () => ({
                getRawMany: async () => [],
              }),
            }),
          }),
        }),
      }),
    };

    const overviewService = new BossOverviewService(
      { manager: mockEm } as never,
      { find: async () => completedMonth } as never,
      { find: async () => [] } as never,
      { find: async () => [] } as never,
      { loadBossOwnedBranches: async () => branches } as never,
      {
        listForBranches: async () => ({
          alerts: [],
          summary: { openCount: 0, investigatingCount: 0, criticalCount: 0, highCount: 0, totalAmountImpact: 0 },
        }),
      } as never,
    );

    const startMs = performance.now();
    const overview = await overviewService.getOverview('boss-hq-1', 'ALL');
    const elapsedMs = performance.now() - startMs;

    assert.equal(overview.branches.length, BRANCH_COUNT);
    assert.equal(overview.consolidated.totalBranchesCount, BRANCH_COUNT);
    assert.equal(overview.consolidated.totalTableCount, 2000);
    assert.equal(overview.consolidated.occupiedTableCount, 500);
    assert.equal(overview.consolidated.openChecksTotal, 500 * 240);
    assert.equal(overview.consolidated.todayOrderCount, 10_000);
    assert.equal(overview.consolidated.todayRevenue, 10_000 * 300);
    assert.ok(
      elapsedMs < 350,
      `Expected 100-branch overview aggregation in < 350ms, took ${elapsedMs.toFixed(1)}ms`,
    );
  });

  it('SC-04: Coalesces 200 concurrent FraudDetectionService scans for the same restaurant into 1 DB execution & consolidates split checks with zero drift', async () => {
    let dbScanExecutions = 0;
    const mockEm = {
      find: async () => {
        await new Promise((r) => setTimeout(r, 15));
        return [];
      },
    };
    const fraudService = new FraudDetectionService(
      {
        find: async () => {
          dbScanExecutions += 1;
          return [];
        },
      } as never,
      { manager: mockEm } as never,
      { emitFraudAlert: () => undefined } as never,
    );

    const results = await Promise.all(
      Array.from({ length: 200 }, () =>
        fraudService.analyzeRestaurantAnomalies('rest-moscow-1'),
      ),
    );
    assert.equal(results.length, 200);
    assert.equal(
      dbScanExecutions,
      1,
      '200 concurrent anomaly scans for the same restaurant must coalesce into 1 DB scan',
    );

    // Verify PrintAgentController.pendingSync coalesces kitchenOrders & printJobs in 1 call
    const controller = new PrintAgentController(
      {} as never,
      {} as never,
      {
        findPendingKitchenPrints: async () => [{ id: 'ord-1' }],
        findPendingPrintJobs: async () => [{ jobId: 'job-1' }],
      } as never,
      {} as never,
      { recordAgentHttpHeartbeat: async () => false } as never,
      {} as never,
      { emitPrintersUpdated: () => undefined } as never,
    );
    const syncRes = await controller.pendingSync({
      printAgentRestaurantId: 'rest-moscow-1',
      headers: {},
    });
    assert.equal(syncRes.kitchenOrders.length, 1);
    assert.equal(syncRes.printJobs.length, 1);

    // Verify 4-part split check settlement + consolidation math matches to the exact kurus
    const sessionOpen = new Date('2026-11-20T11:33:00.000Z');
    const existingRows: CompletedOrderEntity[] = [
      {
        id: 'co-1',
        restaurantId: 'rest-moscow-1',
        tableName: 'B12',
        section: 'Bahçe',
        totalAmount: 310,
        discountAmount: 0,
        netAmount: 310,
        paymentMethod: 'split',
        paymentSplit: [
          { method: 'cash', amount: 50 },
          { method: 'credit-card', amount: 50 },
          { method: 'credit-card', amount: 105 },
          { method: 'credit-card', amount: 105 },
        ],
        openedAt: sessionOpen,
        closedAt: new Date('2026-11-20T13:04:00.000Z'),
      } as unknown as CompletedOrderEntity,
    ];
    const mockFindEm = {
      find: async () => existingRows,
    };
    const matched = await findExistingSessionCompletedOrder(
      mockFindEm as never,
      'rest-moscow-1',
      'B12',
      sessionOpen,
      ['ord-b12-1'],
    );
    assert.ok(matched);
    assert.equal(matched.id, 'co-1');
    const breakdown = CheckSettlementPolicy.computeMethodBreakdownMinorUnits(
      matched.paymentMethod,
      31000,
      matched.paymentSplit as Array<{ method: string; amount: number }>,
    );
    assert.equal(breakdown.cashMinorUnits, 5000);
    assert.equal(breakdown.cardMinorUnits, 26000);
  });
});
