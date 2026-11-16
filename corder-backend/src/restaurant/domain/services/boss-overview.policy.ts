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
  paymentBreakdown: PaymentMethodBreakdownDto;
}

export interface BranchLivePulseDto extends ConsolidatedOverviewMetricsDto {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: string;
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
  ledgerEntries: LedgerEntryEntity[];
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
    const bLedger = input.ledgerEntries.filter((l) => l.restaurantId === branch.id);

    const activeStats = summarizeActiveOrders(bActiveOrders, itemsByOrderId, startOfToday);
    const todayStats = summarizeCompletedToday(bCompletedToday);

    return {
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      address: branch.address ?? null,
      phone: branch.phone ?? null,
      status: branch.status,
      todayRevenue: todayStats.todayRevenue,
      weekRevenue: sumNetAmount(bCompletedWeek),
      monthRevenue: sumNetAmount(bCompletedMonth),
      todayOrderCount: bCompletedToday.length,
      todayDiscountTotal: todayStats.todayDiscountTotal,
      todayCancelCount: activeStats.cancelCount + todayStats.cancelCount,
      todayCancelAmount: activeStats.cancelAmount + todayStats.cancelAmount,
      occupiedTableCount: activeStats.occupiedTableIds.size,
      totalTableCount: bTables.length,
      openChecksTotal: activeStats.openChecksTotal,
      openOrderCount: bActiveOrders.length,
      criticalStockCount: bMaterials.filter((m) => Number(m.currentStock) <= Number(m.minStock)).length,
      staffCount: bStaff.length,
      panelStaffCount: bStaff.filter((s) => s.canAccessPanel || Boolean(s.email)).length,
      terminalStaffCount: bStaff.filter((s) => s.canAccessTerminal !== false).length,
      openLedgerBalance: computeOpenLedgerBalance(bLedger),
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
    return branchPulses.reduce((acc, b) => {
      acc.todayRevenue += b.todayRevenue;
      acc.weekRevenue += b.weekRevenue;
      acc.monthRevenue += b.monthRevenue;
      acc.todayOrderCount += b.todayOrderCount;
      acc.todayDiscountTotal += b.todayDiscountTotal;
      acc.todayCancelCount += b.todayCancelCount;
      acc.todayCancelAmount += b.todayCancelAmount;
      acc.occupiedTableCount += b.occupiedTableCount;
      acc.totalTableCount += b.totalTableCount;
      acc.openChecksTotal += b.openChecksTotal;
      acc.openOrderCount += b.openOrderCount;
      acc.criticalStockCount += b.criticalStockCount;
      acc.staffCount += b.staffCount;
      acc.openLedgerBalance += b.openLedgerBalance;
      acc.paymentBreakdown.cash += b.paymentBreakdown.cash;
      acc.paymentBreakdown.creditCard += b.paymentBreakdown.creditCard;
      acc.paymentBreakdown.mealCard += b.paymentBreakdown.mealCard;
      acc.paymentBreakdown.multinet += b.paymentBreakdown.multinet;
      acc.paymentBreakdown.ledger += b.paymentBreakdown.ledger;
      return acc;
    }, BossOverviewPolicy.emptyConsolidated());
  }

  static buildHourlySales(completedMonth: CompletedOrderEntity[], startOfToday: Date) {
    const hourlyMap = new Map<number, { hour: string; revenue: number; orders: number }>();
    for (let h = 8; h <= 23; h++) {
      hourlyMap.set(h, { hour: `${String(h).padStart(2, '0')}:00`, revenue: 0, orders: 0 });
    }
    for (const c of completedMonth) {
      if (c.closedAt < startOfToday) continue;
      const h = new Date(c.closedAt).getHours();
      const bucket = hourlyMap.get(h) ?? { hour: `${String(h).padStart(2, '0')}:00`, revenue: 0, orders: 0 };
      bucket.revenue += Number(c.netAmount || 0);
      bucket.orders += 1;
      hourlyMap.set(h, bucket);
    }
    return Array.from(hourlyMap.values());
  }

  static buildTopProductsAndStaffPerformance(completedMonth: CompletedOrderEntity[]) {
    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    const staffStats = new Map<string, { name: string; ordersCount: number; revenue: number; discountGiven: number }>();

    for (const c of completedMonth) {
      const waiterName = (c.waiter || c.closedBy || 'Staff').trim();
      const st = staffStats.get(waiterName) ?? { name: waiterName, ordersCount: 0, revenue: 0, discountGiven: 0 };
      st.ordersCount += 1;
      st.revenue += Number(c.netAmount || 0);
      st.discountGiven += Number(c.discountAmount || 0);
      staffStats.set(waiterName, st);

      for (const so of Array.isArray(c.ordersSnapshot) ? c.ordersSnapshot : []) {
        const sItems = (so as { items?: Array<{ productName?: string; price?: number; quantity?: number; status?: string }> }).items ?? [];
        for (const item of sItems) {
          if (item.status === 'cancelled') continue;
          const pName = (item.productName || 'Product').trim();
          const qty = Number(item.quantity || 1);
          const cur = productStats.get(pName) ?? { name: pName, quantity: 0, revenue: 0 };
          cur.quantity += qty;
          cur.revenue += Number(item.price || 0) * qty;
          productStats.set(pName, cur);
        }
      }
    }

    return {
      topProducts: Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      staffPerformance: Array.from(staffStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 12),
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
  return orders.reduce((s, c) => s + Number(c.netAmount || 0), 0);
}

function computeOpenLedgerBalance(entries: LedgerEntryEntity[]): number {
  return Math.max(
    0,
    entries.reduce((sum, e) => sum + (e.entryType === 'debt' ? Number(e.amount || 0) : -Number(e.amount || 0)), 0),
  );
}

function summarizeActiveOrders(activeOrders: OrderEntity[], itemsByOrderId: Map<string, OrderItemEntity[]>, startOfToday: Date) {
  let openChecksTotal = 0;
  let cancelCount = 0;
  let cancelAmount = 0;
  const occupiedTableIds = new Set<string>();

  for (const ord of activeOrders) {
    for (const item of itemsByOrderId.get(ord.id) ?? []) {
      const lineTotal = Number(item.price) * item.quantity;
      if (item.status === 'cancelled') {
        if (!item.cancelledAt || item.cancelledAt >= startOfToday) {
          cancelCount += item.quantity;
          cancelAmount += lineTotal;
        }
      } else if (item.status !== 'ledger') {
        openChecksTotal += lineTotal;
        occupiedTableIds.add(ord.tableId);
      }
    }
  }
  return { openChecksTotal, cancelCount, cancelAmount, occupiedTableIds };
}

function summarizeCompletedToday(completedToday: CompletedOrderEntity[]) {
  const paymentBreakdown: PaymentMethodBreakdownDto = { cash: 0, creditCard: 0, mealCard: 0, multinet: 0, ledger: 0 };
  let todayRevenue = 0;
  let todayDiscountTotal = 0;
  let cancelCount = 0;
  let cancelAmount = 0;

  for (const co of completedToday) {
    todayRevenue += Number(co.netAmount || 0);
    todayDiscountTotal += Number(co.discountAmount || 0);
    accumulatePaymentBreakdown(paymentBreakdown, co);
    for (const so of Array.isArray(co.ordersSnapshot) ? co.ordersSnapshot : []) {
      const sItems = (so as { items?: Array<{ status?: string; price?: number; quantity?: number }> }).items ?? [];
      for (const si of sItems) {
        if (si.status === 'cancelled') {
          cancelCount += Number(si.quantity || 1);
          cancelAmount += Number(si.price || 0) * Number(si.quantity || 1);
        }
      }
    }
  }
  return { paymentBreakdown, todayRevenue, todayDiscountTotal, cancelCount, cancelAmount };
}

function accumulatePaymentBreakdown(target: PaymentMethodBreakdownDto, order: CompletedOrderEntity): void {
  const net = Number(order.netAmount || 0);
  if (order.paymentMethod === 'split' && Array.isArray(order.paymentSplit)) {
    for (const part of order.paymentSplit) {
      const amt = Number(part.amount || 0);
      if (part.method === 'cash') target.cash += amt;
      else if (part.method === 'credit-card') target.creditCard += amt;
      else if (part.method === 'meal-card') target.mealCard += amt;
      else if (part.method === 'multinet') target.multinet += amt;
    }
    return;
  }
  if (order.paymentMethod === 'cash') target.cash += net;
  else if (order.paymentMethod === 'credit-card') target.creditCard += net;
  else if (order.paymentMethod === 'meal-card') target.mealCard += net;
  else if (order.paymentMethod === 'multinet') target.multinet += net;
  else if (order.paymentMethod === 'ledger') target.ledger += net;
}
