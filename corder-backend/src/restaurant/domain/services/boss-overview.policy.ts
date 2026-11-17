import { RestaurantEntity } from '../../../platform/domain/restaurant.entity';
import { TableEntity } from '../table.entity';
import { OrderEntity } from '../order.entity';
import { OrderItemEntity } from '../order-item.entity';
import { CompletedOrderEntity } from '../completed-order.entity';
import { CashShiftEntity } from '../cash-shift.entity';
import { StockMaterialEntity } from '../stock-material.entity';
import { RestaurantStaffEntity } from '../restaurant-staff.entity';
import { LedgerEntryEntity } from '../ledger-entry.entity';
import { AuditLogEntity } from '../audit-log.entity';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';

/** Permanent UTC+3 offset for Europe/Istanbul (Turkey). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function computeIstanbulDateBoundaries(now: Date = new Date()): {
  startOfToday: Date;
  startOfWeek: Date;
  startOfMonth: Date;
} {
  const istanbulShifted = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  const year = istanbulShifted.getUTCFullYear();
  const month = istanbulShifted.getUTCMonth();
  const day = istanbulShifted.getUTCDate();

  const startOfToday = new Date(Date.UTC(year, month, day) - ISTANBUL_OFFSET_MS);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(year, month, 1) - ISTANBUL_OFFSET_MS);
  return { startOfToday, startOfWeek, startOfMonth };
}

export function getIstanbulHour(date: Date): number {
  const istanbulShifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return istanbulShifted.getUTCHours();
}

export interface PaymentMethodBreakdownDto {
  cash: number;
  creditCard: number;
  mealCard: number;
  multinet: number;
  ledger: number;
}

export interface ConsolidatedOverviewMetricsDto {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayOrderCount: number;
  todayDiscountTotal: number;
  todayCancelCount: number;
  todayCancelAmount: number;
  occupiedTableCount: number;
  totalTableCount: number;
  openChecksTotal: number;
  openOrderCount: number;
  criticalStockCount: number;
  staffCount: number;
  openLedgerBalance: number;
  totalBranchesCount?: number;
  companyOwnedCount?: number;
  franchiseBranchCount?: number;
  todayEstimatedRoyalty?: number;
  monthEstimatedRoyalty?: number;
  paymentBreakdown: PaymentMethodBreakdownDto;
}

export interface BranchLivePulseDto extends ConsolidatedOverviewMetricsDto {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: string;
  brandName?: string | null;
  branchType?: string;
  franchiseeCompanyName?: string | null;
  royaltyRate?: number;
  estimatedTodayRoyalty?: number;
  estimatedMonthRoyalty?: number;
  monthlyFee?: number;
  billingStatus?: string;
  isAccessSuspended?: boolean;
  panelStaffCount: number;
  terminalStaffCount: number;
  activeShift: {
    id: string;
    openedBy: string;
    openedAt: string;
    openingBalance: number;
    totalSales: number;
    totalCash: number;
    totalCard: number;
  } | null;
}

export interface BranchPulseInput {
  branch: RestaurantEntity;
  tables: TableEntity[];
  activeOrders: OrderEntity[];
  itemsByOrderId: Map<string, OrderItemEntity[]>;
  completedMonth: CompletedOrderEntity[];
  openShifts: CashShiftEntity[];
  materials: StockMaterialEntity[];
  staffList: RestaurantStaffEntity[];
  ledgerEntries?: LedgerEntryEntity[];
  openLedgerBalanceByBranchId?: Map<string, number>;
  startOfToday: Date;
  startOfWeek: Date;
  startOfMonth: Date;
}

export class BossOverviewPolicy {
  static emptyConsolidated(): ConsolidatedOverviewMetricsDto {
    return {
      todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, todayOrderCount: 0,
      todayDiscountTotal: 0, todayCancelCount: 0, todayCancelAmount: 0,
      occupiedTableCount: 0, totalTableCount: 0, openChecksTotal: 0,
      openOrderCount: 0, criticalStockCount: 0, staffCount: 0, openLedgerBalance: 0,
      totalBranchesCount: 0, companyOwnedCount: 0, franchiseBranchCount: 0,
      todayEstimatedRoyalty: 0, monthEstimatedRoyalty: 0,
      paymentBreakdown: { cash: 0, creditCard: 0, mealCard: 0, multinet: 0, ledger: 0 },
    };
  }

  static buildBranchPulse(input: BranchPulseInput): BranchLivePulseDto {
    const { branch, itemsByOrderId, startOfToday, startOfWeek, startOfMonth } = input;
    const bTables = input.tables.filter((t) => t.restaurantId === branch.id);
    const bActiveOrders = input.activeOrders.filter((o) => o.restaurantId === branch.id);
    const bCompletedMonth = filterCompletedSince(input.completedMonth, branch.id, startOfMonth);
    const bCompletedWeek = filterCompletedSince(bCompletedMonth, branch.id, startOfWeek);
    const bCompletedToday = filterCompletedSince(bCompletedMonth, branch.id, startOfToday);
    const bShift = input.openShifts.find((s) => s.restaurantId === branch.id) ?? null;
    const bMaterials = input.materials.filter((m) => m.restaurantId === branch.id);
    const bStaff = input.staffList.filter((s) => s.restaurantId === branch.id);
    const bLedger = (input.ledgerEntries ?? []).filter((l) => l.restaurantId === branch.id);
    const openLedgerBalance =
      input.openLedgerBalanceByBranchId?.get(branch.id) ?? computeOpenLedgerBalance(bLedger);

    const activeStats = summarizeActiveOrders(bActiveOrders, itemsByOrderId, startOfToday);
    const todayStats = summarizeCompletedToday(bCompletedToday, startOfToday);
    const monthRev = sumNetAmount(bCompletedMonth);
    const royaltyPct = Number(branch.royaltyRate || 0);
    const estimatedTodayRoyalty =
      branch.branchType === 'franchise' && royaltyPct > 0
        ? fromMinorUnits(Math.round((toMinorUnits(todayStats.todayRevenue) * royaltyPct) / 100))
        : 0;
    const estimatedMonthRoyalty =
      branch.branchType === 'franchise' && royaltyPct > 0
        ? fromMinorUnits(Math.round((toMinorUnits(monthRev) * royaltyPct) / 100))
        : 0;

    return {
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      address: branch.address ?? null,
      phone: branch.phone ?? null,
      status: branch.status,
      brandName: branch.brandName ?? null,
      branchType: branch.branchType || 'independent',
      franchiseeCompanyName: branch.franchiseeCompanyName ?? null,
      royaltyRate: royaltyPct,
      estimatedTodayRoyalty,
      estimatedMonthRoyalty,
      monthlyFee: Number(branch.monthlyFee || 0),
      billingStatus: branch.billingStatus || 'paid',
      isAccessSuspended: Boolean(branch.isAccessSuspended),
      todayRevenue: todayStats.todayRevenue,
      weekRevenue: sumNetAmount(bCompletedWeek),
      monthRevenue: monthRev,
      todayOrderCount: bCompletedToday.length,
      todayDiscountTotal: todayStats.todayDiscountTotal,
      todayCancelCount: activeStats.cancelCount + todayStats.cancelCount,
      todayCancelAmount: fromMinorUnits(
        toMinorUnits(activeStats.cancelAmount) + toMinorUnits(todayStats.cancelAmount),
      ),
      occupiedTableCount: activeStats.occupiedTableIds.size,
      totalTableCount: bTables.length,
      openChecksTotal: activeStats.openChecksTotal,
      openOrderCount: bActiveOrders.length,
      criticalStockCount: bMaterials.filter((m) => Number(m.currentStock) <= Number(m.minStock)).length,
      staffCount: bStaff.length,
      panelStaffCount: bStaff.filter((s) => s.canAccessPanel || Boolean(s.email)).length,
      terminalStaffCount: bStaff.filter((s) => s.canAccessTerminal !== false).length,
      openLedgerBalance,
      paymentBreakdown: todayStats.paymentBreakdown,
      activeShift: bShift
        ? {
            id: bShift.id,
            openedBy: bShift.openedBy,
            openedAt: bShift.openedAt.toISOString(),
            openingBalance: Number(bShift.openingBalance || 0),
            totalSales: Number(bShift.totalRevenue || 0),
            totalCash: Number(bShift.totalCash || 0),
            totalCard: Number(bShift.totalCard || 0),
          }
        : null,
    };
  }

  static computeConsolidatedMetrics(branchPulses: BranchLivePulseDto[]): ConsolidatedOverviewMetricsDto {
    let todayRevenueMinor = 0, weekRevenueMinor = 0, monthRevenueMinor = 0;
    let todayDiscountMinor = 0, todayCancelMinor = 0, openChecksMinor = 0, openLedgerMinor = 0;
    let todayRoyaltyMinor = 0, monthRoyaltyMinor = 0;
    let cashMinor = 0, cardMinor = 0, mealCardMinor = 0, multinetMinor = 0, ledgerMinor = 0;

    const acc = BossOverviewPolicy.emptyConsolidated();
    for (const b of branchPulses) {
      todayRevenueMinor += toMinorUnits(b.todayRevenue);
      weekRevenueMinor += toMinorUnits(b.weekRevenue);
      monthRevenueMinor += toMinorUnits(b.monthRevenue);
      acc.todayOrderCount += b.todayOrderCount;
      todayDiscountMinor += toMinorUnits(b.todayDiscountTotal);
      acc.todayCancelCount += b.todayCancelCount;
      todayCancelMinor += toMinorUnits(b.todayCancelAmount);
      acc.occupiedTableCount += b.occupiedTableCount;
      acc.totalTableCount += b.totalTableCount;
      openChecksMinor += toMinorUnits(b.openChecksTotal);
      acc.openOrderCount += b.openOrderCount;
      acc.criticalStockCount += b.criticalStockCount;
      acc.staffCount += b.staffCount;
      openLedgerMinor += toMinorUnits(b.openLedgerBalance);
      acc.totalBranchesCount = (acc.totalBranchesCount ?? 0) + 1;
      if (b.branchType === 'franchise') acc.franchiseBranchCount = (acc.franchiseBranchCount ?? 0) + 1;
      else acc.companyOwnedCount = (acc.companyOwnedCount ?? 0) + 1;
      todayRoyaltyMinor += toMinorUnits(b.estimatedTodayRoyalty ?? 0);
      monthRoyaltyMinor += toMinorUnits(b.estimatedMonthRoyalty ?? 0);
      cashMinor += toMinorUnits(b.paymentBreakdown.cash);
      cardMinor += toMinorUnits(b.paymentBreakdown.creditCard);
      mealCardMinor += toMinorUnits(b.paymentBreakdown.mealCard);
      multinetMinor += toMinorUnits(b.paymentBreakdown.multinet);
      ledgerMinor += toMinorUnits(b.paymentBreakdown.ledger);
    }

    acc.todayRevenue = fromMinorUnits(todayRevenueMinor);
    acc.weekRevenue = fromMinorUnits(weekRevenueMinor);
    acc.monthRevenue = fromMinorUnits(monthRevenueMinor);
    acc.todayDiscountTotal = fromMinorUnits(todayDiscountMinor);
    acc.todayCancelAmount = fromMinorUnits(todayCancelMinor);
    acc.openChecksTotal = fromMinorUnits(openChecksMinor);
    acc.openLedgerBalance = fromMinorUnits(openLedgerMinor);
    acc.todayEstimatedRoyalty = fromMinorUnits(todayRoyaltyMinor);
    acc.monthEstimatedRoyalty = fromMinorUnits(monthRoyaltyMinor);
    acc.paymentBreakdown = {
      cash: fromMinorUnits(cashMinor),
      creditCard: fromMinorUnits(cardMinor),
      mealCard: fromMinorUnits(mealCardMinor),
      multinet: fromMinorUnits(multinetMinor),
      ledger: fromMinorUnits(ledgerMinor),
    };
    return acc;
  }

  static buildHourlySales(completedMonth: CompletedOrderEntity[], startOfToday: Date) {
    const hourlyMap = new Map<number, { hour: string; revenueMinor: number; orders: number }>();
    for (let h = 8; h <= 23; h++) {
      hourlyMap.set(h, { hour: `${String(h).padStart(2, '0')}:00`, revenueMinor: 0, orders: 0 });
    }
    for (const c of completedMonth) {
      if (c.closedAt < startOfToday) continue;
      const h = getIstanbulHour(new Date(c.closedAt));
      const bucket = hourlyMap.get(h) ?? { hour: `${String(h).padStart(2, '0')}:00`, revenueMinor: 0, orders: 0 };
      bucket.revenueMinor += toMinorUnits(c.netAmount || 0);
      bucket.orders += 1;
      hourlyMap.set(h, bucket);
    }
    return Array.from(hourlyMap.entries())
      .sort(([hA], [hB]) => hA - hB)
      .map(([, b]) => ({ hour: b.hour, revenue: fromMinorUnits(b.revenueMinor), orders: b.orders }));
  }

  static buildTopProductsAndStaffPerformance(completedMonth: CompletedOrderEntity[]) {
    const productStats = new Map<string, { name: string; quantity: number; revenueMinor: number }>();
    const staffStats = new Map<string, { name: string; ordersCount: number; revenueMinor: number; discountMinor: number }>();

    for (const c of completedMonth) {
      const waiterName = (c.waiter || c.closedBy || 'Staff').trim();
      const st = staffStats.get(waiterName) ?? { name: waiterName, ordersCount: 0, revenueMinor: 0, discountMinor: 0 };
      st.ordersCount += 1;
      st.revenueMinor += toMinorUnits(c.netAmount || 0);
      st.discountMinor += toMinorUnits(c.discountAmount || 0);
      staffStats.set(waiterName, st);

      for (const so of Array.isArray(c.ordersSnapshot) ? c.ordersSnapshot : []) {
        const sItems = (so as { items?: Array<{ productName?: string; price?: number; quantity?: number; status?: string }> }).items ?? [];
        for (const item of sItems) {
          if (item.status === 'cancelled' || item.status === 'ledger') continue;
          const pName = (item.productName || 'Product').trim();
          const qty = Math.max(0, Math.floor(Number(item.quantity || 1)));
          if (qty <= 0) continue;
          const cur = productStats.get(pName) ?? { name: pName, quantity: 0, revenueMinor: 0 };
          cur.quantity += qty;
          cur.revenueMinor += toMinorUnits(item.price || 0) * qty;
          productStats.set(pName, cur);
        }
      }
    }

    return {
      topProducts: Array.from(productStats.values())
        .sort((a, b) => b.revenueMinor - a.revenueMinor)
        .slice(0, 10)
        .map((p) => ({ name: p.name, quantity: p.quantity, revenue: fromMinorUnits(p.revenueMinor) })),
      staffPerformance: Array.from(staffStats.values())
        .sort((a, b) => b.revenueMinor - a.revenueMinor)
        .slice(0, 12)
        .map((s) => ({
          name: s.name,
          ordersCount: s.ordersCount,
          revenue: fromMinorUnits(s.revenueMinor),
          discountGiven: fromMinorUnits(s.discountMinor),
        })),
    };
  }

  static buildCriticalMaterials(materials: StockMaterialEntity[], branchNameById: Map<string, string>) {
    return materials
      .filter((m) => Number(m.currentStock) <= Number(m.minStock))
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        restaurantId: m.restaurantId,
        branchName: branchNameById.get(m.restaurantId) ?? '',
        name: m.name,
        category: m.category,
        unit: m.unit,
        currentStock: Number(m.currentStock),
        minStock: Number(m.minStock),
      }));
  }

  static buildRecentAudits(recentAudits: AuditLogEntity[], branchNameById: Map<string, string>) {
    return recentAudits.map((a) => ({
      id: a.id,
      restaurantId: a.restaurantId,
      branchName: branchNameById.get(a.restaurantId) ?? '',
      userName: a.userName,
      action: a.action,
      category: a.category,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}

function filterCompletedSince(list: CompletedOrderEntity[], restaurantId: string, since: Date): CompletedOrderEntity[] {
  return list.filter((c) => c.restaurantId === restaurantId && c.closedAt >= since);
}

function sumNetAmount(orders: CompletedOrderEntity[]): number {
  const minor = orders.reduce((s, c) => s + toMinorUnits(c.netAmount || 0), 0);
  return fromMinorUnits(minor);
}

function computeOpenLedgerBalance(entries: LedgerEntryEntity[]): number {
  const minor = entries.reduce(
    (sum, e) =>
      sum + (e.entryType === 'debt' ? toMinorUnits(e.amount || 0) : -toMinorUnits(e.amount || 0)),
    0,
  );
  return fromMinorUnits(Math.max(0, minor));
}

function summarizeActiveOrders(activeOrders: OrderEntity[], itemsByOrderId: Map<string, OrderItemEntity[]>, startOfToday: Date) {
  let openChecksMinor = 0;
  let cancelCount = 0;
  let cancelMinor = 0;
  const occupiedTableIds = new Set<string>();

  for (const ord of activeOrders) {
    for (const item of itemsByOrderId.get(ord.id) ?? []) {
      const lineMinor = toMinorUnits(item.price) * item.quantity;
      if (item.status === 'cancelled') {
        if (!item.cancelledAt || item.cancelledAt >= startOfToday) {
          cancelCount += item.quantity;
          cancelMinor += lineMinor;
        }
      } else if (item.status !== 'ledger') {
        openChecksMinor += lineMinor;
        occupiedTableIds.add(ord.tableId);
      }
    }
  }
  return {
    openChecksTotal: fromMinorUnits(openChecksMinor),
    cancelCount,
    cancelAmount: fromMinorUnits(cancelMinor),
    occupiedTableIds,
  };
}

function summarizeCompletedToday(completedToday: CompletedOrderEntity[], startOfToday: Date) {
  const breakdownMinor = {
    cash: 0,
    creditCard: 0,
    mealCard: 0,
    multinet: 0,
    ledger: 0,
  };
  let todayRevenueMinor = 0;
  let todayDiscountMinor = 0;
  let cancelCount = 0;
  let cancelMinor = 0;
  const seenCancelledItemIds = new Set<string>();

  for (const co of completedToday) {
    todayRevenueMinor += toMinorUnits(co.netAmount || 0);
    todayDiscountMinor += toMinorUnits(co.discountAmount || 0);
    accumulatePaymentBreakdownMinor(breakdownMinor, co);
    for (const so of Array.isArray(co.ordersSnapshot) ? co.ordersSnapshot : []) {
      const sItems = (
        so as {
          items?: Array<{
            id?: string;
            status?: string;
            price?: number;
            quantity?: number;
            cancelledAt?: string;
          }>;
        }
      ).items ?? [];
      for (const si of sItems) {
        if (si.status === 'cancelled') {
          if (si.id && seenCancelledItemIds.has(si.id)) continue;
          if (si.cancelledAt) {
            const cancelledDate = new Date(si.cancelledAt);
            if (!Number.isNaN(cancelledDate.getTime()) && cancelledDate < startOfToday) {
              continue;
            }
          }
          if (si.id) seenCancelledItemIds.add(si.id);
          const qty = Math.max(0, Math.floor(Number(si.quantity || 1)));
          cancelCount += qty;
          cancelMinor += toMinorUnits(si.price || 0) * qty;
        }
      }
    }
  }
  return {
    paymentBreakdown: {
      cash: fromMinorUnits(breakdownMinor.cash),
      creditCard: fromMinorUnits(breakdownMinor.creditCard),
      mealCard: fromMinorUnits(breakdownMinor.mealCard),
      multinet: fromMinorUnits(breakdownMinor.multinet),
      ledger: fromMinorUnits(breakdownMinor.ledger),
    },
    todayRevenue: fromMinorUnits(todayRevenueMinor),
    todayDiscountTotal: fromMinorUnits(todayDiscountMinor),
    cancelCount,
    cancelAmount: fromMinorUnits(cancelMinor),
  };
}

function accumulatePaymentBreakdownMinor(
  target: {
    cash: number;
    creditCard: number;
    mealCard: number;
    multinet: number;
    ledger: number;
  },
  order: CompletedOrderEntity,
): void {
  const netMinor = toMinorUnits(order.netAmount || 0);
  if (order.paymentMethod === 'split' && Array.isArray(order.paymentSplit)) {
    for (const part of order.paymentSplit as Array<{ method?: string; amount?: number }>) {
      const amtMinor = toMinorUnits(part.amount || 0);
      if (part.method === 'cash') target.cash += amtMinor;
      else if (part.method === 'credit-card') target.creditCard += amtMinor;
      else if (part.method === 'meal-card') target.mealCard += amtMinor;
      else if (part.method === 'multinet') target.multinet += amtMinor;
      else if (part.method === 'ledger') target.ledger += amtMinor;
    }
    return;
  }
  if (order.paymentMethod === 'cash') target.cash += netMinor;
  else if (order.paymentMethod === 'credit-card') target.creditCard += netMinor;
  else if (order.paymentMethod === 'meal-card') target.mealCard += netMinor;
  else if (order.paymentMethod === 'multinet') target.multinet += netMinor;
  else if (order.paymentMethod === 'ledger') target.ledger += netMinor;
}
