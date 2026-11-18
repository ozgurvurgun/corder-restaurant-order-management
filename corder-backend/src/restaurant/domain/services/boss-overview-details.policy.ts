import { CategoryEntity } from '../category.entity';
import { ProductEntity } from '../product.entity';
import { OrderEntity } from '../order.entity';
import { OrderItemEntity } from '../order-item.entity';
import { CompletedOrderEntity } from '../completed-order.entity';
import { CashShiftEntity } from '../cash-shift.entity';
import {
  ConsolidatedOverviewMetricsDto,
  getIstanbulHour,
} from './boss-overview.policy';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';

export class BossOverviewDetailsPolicy {
  static build24HourlySales(
    completedMonth: CompletedOrderEntity[],
    startOfToday: Date,
  ) {
    const hourlyMap = new Map<
      number,
      { hour: string; revenueMinor: number; ordersCount: number }
    >();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, {
        hour: `${String(h).padStart(2, '0')}:00`,
        revenueMinor: 0,
        ordersCount: 0,
      });
    }
    for (const c of completedMonth) {
      if (c.closedAt < startOfToday) continue;
      const h = getIstanbulHour(new Date(c.closedAt));
      const bucket = hourlyMap.get(h);
      if (bucket) {
        bucket.revenueMinor += toMinorUnits(c.netAmount || 0);
        bucket.ordersCount += 1;
      }
    }
    return Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, b]) => ({
        hour: b.hour,
        revenue: fromMinorUnits(b.revenueMinor),
        ordersCount: b.ordersCount,
        orders: b.ordersCount,
      }));
  }

  static buildCategoryAndProductBreakdown(
    completedMonth: CompletedOrderEntity[],
    products: ProductEntity[],
    categories: CategoryEntity[],
  ) {
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const categoryNameByProductId = new Map<string, string>();
    const categoryNameByProductName = new Map<string, string>();

    for (const p of products) {
      const cName = categoryNameById.get(p.categoryId) || 'Diğer';
      categoryNameByProductId.set(p.id, cName);
      categoryNameByProductName.set(p.name.trim().toLowerCase(), cName);
    }

    const catStats = new Map<
      string,
      { categoryName: string; revenueMinor: number; quantity: number }
    >();
    const prodStats = new Map<
      string,
      { productName: string; revenueMinor: number; quantity: number }
    >();
    let totalLinesMinor = 0;

    for (const co of completedMonth) {
      for (const so of Array.isArray(co.ordersSnapshot)
        ? co.ordersSnapshot
        : []) {
        const sItems =
          (
            so as {
              items?: Array<{
                productId?: string;
                productName?: string;
                price?: number;
                quantity?: number;
                status?: string;
              }>;
            }
          ).items ?? [];
        for (const item of sItems) {
          if (item.status === 'cancelled' || item.status === 'ledger') continue;
          const pName = (item.productName || 'Ürün').trim();
          const qty = Math.max(0, Math.floor(Number(item.quantity || 1)));
          if (qty <= 0) continue;
          const lineMinor = toMinorUnits(item.price || 0) * qty;
          totalLinesMinor += lineMinor;

          const curProd = prodStats.get(pName) ?? {
            productName: pName,
            revenueMinor: 0,
            quantity: 0,
          };
          curProd.quantity += qty;
          curProd.revenueMinor += lineMinor;
          prodStats.set(pName, curProd);

          const catName =
            (item.productId
              ? categoryNameByProductId.get(item.productId)
              : undefined) ||
            categoryNameByProductName.get(pName.toLowerCase()) ||
            'Diğer';
          const curCat = catStats.get(catName) ?? {
            categoryName: catName,
            revenueMinor: 0,
            quantity: 0,
          };
          curCat.quantity += qty;
          curCat.revenueMinor += lineMinor;
          catStats.set(catName, curCat);
        }
      }
    }

    const categoryBreakdown = Array.from(catStats.values())
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .slice(0, 12)
      .map((c) => ({
        categoryName: c.categoryName,
        revenue: fromMinorUnits(c.revenueMinor),
        quantity: c.quantity,
        sharePct:
          totalLinesMinor > 0
            ? Number(((c.revenueMinor * 100) / totalLinesMinor).toFixed(1))
            : 0,
      }));

    const topProducts = Array.from(prodStats.values())
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .slice(0, 12)
      .map((p) => ({
        name: p.productName,
        productName: p.productName,
        quantity: p.quantity,
        revenue: fromMinorUnits(p.revenueMinor),
      }));

    return { categoryBreakdown, topProducts };
  }

  static buildWaiterPerformance(
    completedMonth: CompletedOrderEntity[],
    activeOrders: OrderEntity[],
    itemsByOrderId: Map<string, OrderItemEntity[]>,
  ) {
    const stats = new Map<
      string,
      {
        waiterName: string;
        ordersCount: number;
        revenueMinor: number;
        discountMinor: number;
        cancelledCount: number;
        cancelledMinor: number;
      }
    >();

    const ensure = (rawName: string) => {
      const name = (rawName || 'Personel').trim() || 'Personel';
      let cur = stats.get(name);
      if (!cur) {
        cur = {
          waiterName: name,
          ordersCount: 0,
          revenueMinor: 0,
          discountMinor: 0,
          cancelledCount: 0,
          cancelledMinor: 0,
        };
        stats.set(name, cur);
      }
      return cur;
    };

    for (const co of completedMonth) {
      const st = ensure(co.waiter || co.closedBy || 'Personel');
      st.ordersCount += 1;
      st.revenueMinor += toMinorUnits(co.netAmount || 0);
      st.discountMinor += toMinorUnits(co.discountAmount || 0);

      for (const so of Array.isArray(co.ordersSnapshot)
        ? co.ordersSnapshot
        : []) {
        const sItems =
          (
            so as {
              items?: Array<{
                status?: string;
                price?: number;
                quantity?: number;
                cancelledBy?: string;
              }>;
            }
          ).items ?? [];
        for (const item of sItems) {
          if (item.status === 'cancelled') {
            const cSt = ensure(item.cancelledBy || co.waiter || 'Personel');
            const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
            cSt.cancelledCount += qty;
            cSt.cancelledMinor += toMinorUnits(item.price || 0) * qty;
          }
        }
      }
    }

    for (const ord of activeOrders) {
      for (const item of itemsByOrderId.get(ord.id) ?? []) {
        if (item.status === 'cancelled') {
          const cSt = ensure(
            item.cancelledBy || ord.userDisplayName || 'Personel',
          );
          const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
          cSt.cancelledCount += qty;
          cSt.cancelledMinor += toMinorUnits(item.price || 0) * qty;
        }
      }
    }

    return Array.from(stats.values())
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .slice(0, 15)
      .map((s) => ({
        name: s.waiterName,
        waiterName: s.waiterName,
        ordersCount: s.ordersCount,
        revenue: fromMinorUnits(s.revenueMinor),
        discountGiven: fromMinorUnits(s.discountMinor),
        cancelledCount: s.cancelledCount,
        cancelledAmount: fromMinorUnits(s.cancelledMinor),
      }));
  }

  static buildShiftSummaries(
    shifts: CashShiftEntity[],
    branchNameById: Map<string, string>,
  ) {
    return shifts.slice(0, 20).map((s) => {
      const openingMinor = toMinorUnits(s.openingBalance || 0);
      const cashInMinor = toMinorUnits(s.cashIn || 0);
      const cashOutMinor = toMinorUnits(s.cashOut || 0);
      const expectedMinor = openingMinor + cashInMinor - cashOutMinor;
      const closingMinor =
        s.closingBalance != null ? toMinorUnits(s.closingBalance) : null;
      const diffMinor =
        closingMinor != null ? closingMinor - expectedMinor : 0;

      return {
        id: s.id,
        branchId: s.restaurantId,
        branchName: branchNameById.get(s.restaurantId) ?? '',
        status: s.status,
        openedBy: s.openedBy,
        closedBy: s.closedBy ?? null,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt ? s.closedAt.toISOString() : null,
        openingBalance: fromMinorUnits(openingMinor),
        closingBalance:
          closingMinor != null ? fromMinorUnits(closingMinor) : null,
        expectedCash: fromMinorUnits(expectedMinor),
        cashDifference: fromMinorUnits(diffMinor),
        totalRevenue: Number(s.totalRevenue || 0),
        totalCash: Number(s.totalCash || 0),
        totalCard: Number(s.totalCard || 0),
      };
    });
  }

  static computeExtendedKpis(c: ConsolidatedOverviewMetricsDto) {
    const grossRevenue = fromMinorUnits(
      toMinorUnits(c.todayRevenue) + toMinorUnits(c.todayDiscountTotal),
    );
    const discountTotal = c.todayDiscountTotal;
    const discountRatePct =
      grossRevenue > 0
        ? Number(((discountTotal / grossRevenue) * 100).toFixed(1))
        : 0;
    const cancelledCount = c.todayCancelCount;
    const totalAttempts = c.todayOrderCount + cancelledCount;
    const cancelRatePct =
      totalAttempts > 0
        ? Number(((cancelledCount / totalAttempts) * 100).toFixed(1))
        : 0;
    const averageOrderValue =
      c.todayOrderCount > 0
        ? fromMinorUnits(
            Math.round(toMinorUnits(c.todayRevenue) / c.todayOrderCount),
          )
        : 0;
    const revenuePerTable =
      c.totalTableCount > 0
        ? fromMinorUnits(
            Math.round(toMinorUnits(c.todayRevenue) / c.totalTableCount),
          )
        : 0;
    const openLedgerTotal = c.openLedgerBalance;

    return {
      grossRevenue,
      discountTotal,
      discountRatePct,
      cancelledCount,
      cancelRatePct,
      averageOrderValue,
      revenuePerTable,
      openLedgerTotal,
    };
  }
}
