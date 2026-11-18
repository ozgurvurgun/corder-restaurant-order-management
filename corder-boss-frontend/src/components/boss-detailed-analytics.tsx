import { useMemo } from "react"
import { useBossStore } from "@/lib/boss-store"
import type {
  BossTabId,
  BranchLivePulse,
  CategoryBreakdownDto,
  ShiftSummaryDto,
  WaiterPerformanceDto,
} from "@/lib/types"
import { formatMoney, sumMoney, toMinorUnits } from "@/lib/format"
import { BossAnalyticsSections } from "./boss-analytics-tables"
import {
  DollarSign,
  TrendingUp,
  Banknote,
  CreditCard,
  Percent,
  Ban,
  Receipt,
  LayoutGrid,
  Clock,
  BookUser,
  Users,
  ShieldAlert,
  Wallet,
  Utensils,
  Layers,
} from "lucide-react"

interface BossDetailedAnalyticsProps {
  filteredBranches: BranchLivePulse[]
  onNavigate?: (tab: BossTabId) => void
}

export function BossDetailedAnalytics({
  filteredBranches,
  onNavigate,
}: BossDetailedAnalyticsProps) {
  const { overview, products, categories, orders, fraudAlerts } = useBossStore()

  const metrics = useMemo(() => {
    const branches = filteredBranches
    const netRevenue = sumMoney(...branches.map((b) => b.todayRevenue))
    const todayOrderCount = branches.reduce((s, b) => s + b.todayOrderCount, 0)
    const discountTotal =
      overview?.discountTotal ??
      overview?.consolidated?.discountTotal ??
      sumMoney(...branches.map((b) => b.todayDiscountTotal))
    const cancelledCount =
      overview?.cancelledCount ??
      overview?.consolidated?.cancelledCount ??
      branches.reduce((s, b) => s + b.todayCancelCount, 0)
    const cancelAmount = sumMoney(...branches.map((b) => b.todayCancelAmount))
    const grossRevenue =
      overview?.grossRevenue ??
      overview?.consolidated?.grossRevenue ??
      sumMoney(netRevenue, discountTotal, cancelAmount)
    const discountRatePct =
      overview?.discountRatePct ??
      overview?.consolidated?.discountRatePct ??
      (grossRevenue > 0 ? Number(((discountTotal / grossRevenue) * 100).toFixed(1)) : 0)
    const cancelRatePct =
      overview?.cancelRatePct ??
      overview?.consolidated?.cancelRatePct ??
      (grossRevenue > 0 ? Number(((cancelAmount / grossRevenue) * 100).toFixed(1)) : 0)
    const occupiedTables = branches.reduce((s, b) => s + b.occupiedTableCount, 0)
    const totalTables = branches.reduce((s, b) => s + b.totalTableCount, 0)
    const openChecksTotal = sumMoney(...branches.map((b) => b.openChecksTotal))
    const openLedgerTotal =
      overview?.openLedgerTotal ??
      overview?.consolidated?.openLedgerTotal ??
      sumMoney(...branches.map((b) => b.openLedgerBalance))
    const averageOrderValue =
      overview?.averageOrderValue ??
      overview?.consolidated?.averageOrderValue ??
      (todayOrderCount > 0 ? Number((netRevenue / todayOrderCount).toFixed(2)) : 0)
    const revenuePerTable =
      overview?.revenuePerTable ??
      overview?.consolidated?.revenuePerTable ??
      (totalTables > 0 ? Number((netRevenue / totalTables).toFixed(2)) : 0)
    const occupancyPct =
      totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0

    const paymentBreakdown = {
      cash: sumMoney(...branches.map((b) => b.paymentBreakdown.cash)),
      creditCard: sumMoney(...branches.map((b) => b.paymentBreakdown.creditCard)),
      mealCard: sumMoney(...branches.map((b) => b.paymentBreakdown.mealCard)),
      multinet: sumMoney(...branches.map((b) => b.paymentBreakdown.multinet)),
      ledger: sumMoney(...branches.map((b) => b.paymentBreakdown.ledger)),
    }

    const openAlerts = fraudAlerts.filter(
      (a) => a.status === "open" || a.status === "investigating"
    )
    const fraudOpenCount = overview?.fraudSummary?.openCount ?? openAlerts.length
    const fraudCriticalCount =
      overview?.fraudSummary?.criticalCount ??
      openAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length
    const fraudImpact =
      overview?.fraudSummary?.totalAmountImpact ??
      openAlerts.reduce((s, a) => sumMoney(s, a.amountImpact), 0)

    return {
      netRevenue,
      grossRevenue,
      todayOrderCount,
      discountTotal,
      discountRatePct,
      cancelledCount,
      cancelAmount,
      cancelRatePct,
      averageOrderValue,
      revenuePerTable,
      occupiedTables,
      totalTables,
      occupancyPct,
      openChecksTotal,
      openLedgerTotal,
      paymentBreakdown,
      fraudOpenCount,
      fraudCriticalCount,
      fraudImpact,
    }
  }, [filteredBranches, overview, fraudAlerts])

  const totalPayments = sumMoney(
    metrics.paymentBreakdown.cash,
    metrics.paymentBreakdown.creditCard,
    metrics.paymentBreakdown.mealCard,
    metrics.paymentBreakdown.multinet,
    metrics.paymentBreakdown.ledger
  )
  const totalPaymentsMinor = toMinorUnits(totalPayments)
  const payPct = (val: number) =>
    totalPaymentsMinor <= 0 ? 0 : Math.round((toMinorUnits(val) / totalPaymentsMinor) * 100)

  const cardAndMealTotal = sumMoney(
    metrics.paymentBreakdown.creditCard,
    metrics.paymentBreakdown.mealCard,
    metrics.paymentBreakdown.multinet
  )

  const hourlySales = useMemo(
    () =>
      (overview?.hourlySales ?? []).map((h) => ({
        hour: h.hour,
        revenue: h.revenue,
        ordersCount: h.ordersCount ?? h.orders ?? 0,
      })),
    [overview?.hourlySales]
  )

  const topProducts = useMemo(
    () =>
      (overview?.topProducts ?? []).map((p) => ({
        productName: p.productName || p.name || "Ürün",
        quantity: p.quantity,
        revenue: p.revenue,
      })),
    [overview?.topProducts]
  )

  const categoryBreakdown: CategoryBreakdownDto[] = useMemo(() => {
    if (overview?.categoryBreakdown && overview.categoryBreakdown.length > 0) {
      return overview.categoryBreakdown
    }
    const catById = new Map(categories.map((c) => [c.id, c.name]))
    const prodCatByName = new Map(
      products.map((p) => [p.name.toLowerCase(), catById.get(p.categoryId) || "Genel Menü"])
    )
    const agg = new Map<string, { categoryName: string; revenue: number; quantity: number }>()
    for (const tp of topProducts) {
      const cName = prodCatByName.get(tp.productName.toLowerCase()) || "Ana Menü"
      const cur = agg.get(cName) ?? { categoryName: cName, revenue: 0, quantity: 0 }
      cur.revenue = sumMoney(cur.revenue, tp.revenue)
      cur.quantity += tp.quantity
      agg.set(cName, cur)
    }
    return Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue)
  }, [overview?.categoryBreakdown, categories, products, topProducts])

  const waiterPerformance: WaiterPerformanceDto[] = useMemo(() => {
    if (overview?.waiterPerformance && overview.waiterPerformance.length > 0) {
      return overview.waiterPerformance
    }
    const cancelByWaiter = new Map<string, { count: number; amount: number }>()
    for (const ord of orders) {
      const wName = (ord.userName || "Personel").trim()
      for (const item of ord.items ?? []) {
        if (item.status === "cancelled") {
          const cur = cancelByWaiter.get(wName) ?? { count: 0, amount: 0 }
          cur.count += item.quantity
          cur.amount = sumMoney(cur.amount, item.price * item.quantity)
          cancelByWaiter.set(wName, cur)
        }
      }
    }
    return (overview?.staffPerformance ?? []).map((s) => {
      const c = cancelByWaiter.get(s.name)
      return {
        waiterName: s.name,
        ordersCount: s.ordersCount,
        revenue: s.revenue,
        cancelledCount: s.cancelledCount ?? c?.count ?? 0,
        cancelledAmount: s.cancelledAmount ?? c?.amount ?? 0,
        discountGiven: s.discountGiven,
      }
    })
  }, [overview?.waiterPerformance, overview?.staffPerformance, orders])

  const shiftSummaries: ShiftSummaryDto[] = useMemo(() => {
    if (overview?.shiftSummaries && overview.shiftSummaries.length > 0) {
      return overview.shiftSummaries
    }
    return filteredBranches
      .filter((b) => b.activeShift !== null)
      .map((b) => {
        const sh = b.activeShift!
        return {
          id: sh.id,
          branchName: b.name,
          openedBy: sh.openedBy,
          closedBy: null,
          status: "open",
          openingBalance: sh.openingBalance,
          closingBalance: null,
          expectedCash: sumMoney(sh.openingBalance, sh.totalCash),
          difference: 0,
          openedAt: sh.openedAt,
          closedAt: null,
        }
      })
  }, [overview?.shiftSummaries, filteredBranches])

  const kpiCards = [
    { label: "1. Net Ciro (Bugün)", value: `₺${formatMoney(metrics.netRevenue)}`, sub: `${metrics.todayOrderCount} kapanan adisyon`, icon: DollarSign, color: "#34c759" },
    { label: "2. Brüt Ciro", value: `₺${formatMoney(metrics.grossRevenue)}`, sub: "İskonto & iptal öncesi", icon: TrendingUp, color: "#007aff" },
    { label: "3. Nakit Satış", value: `₺${formatMoney(metrics.paymentBreakdown.cash)}`, sub: `Tahsilatın %${payPct(metrics.paymentBreakdown.cash)}'i`, icon: Banknote, color: "#30b0c7" },
    { label: "4. Kart & Yemek Kartı", value: `₺${formatMoney(cardAndMealTotal)}`, sub: "Kredi + Yemek Kartı + Multinet", icon: CreditCard, color: "#5856d6" },
    { label: "5. İndirim & İkram", value: `₺${formatMoney(metrics.discountTotal)}`, sub: `Brüt cironun %${metrics.discountRatePct} oranı`, icon: Percent, color: "#ff9500" },
    { label: "6. İptal / Zayi Tutarı", value: `₺${formatMoney(metrics.cancelAmount)}`, sub: `${metrics.cancelledCount} adet (%${metrics.cancelRatePct})`, icon: Ban, color: "#ff3b30" },
    { label: "7. Ortalama Adisyon (AOV)", value: `₺${formatMoney(metrics.averageOrderValue)}`, sub: "Adisyon başı net harcama", icon: Receipt, color: "#e63462" },
    { label: "8. Masa Başı Ortalama Ciro", value: `₺${formatMoney(metrics.revenuePerTable)}`, sub: `${metrics.totalTables} toplam masa kapasitesi`, icon: LayoutGrid, color: "#00c7be" },
    { label: "9. Açık Masalardaki Tutar", value: `₺${formatMoney(metrics.openChecksTotal)}`, sub: `${metrics.occupiedTables} aktif masada canlı hesap`, icon: Clock, color: "#ff9500" },
    { label: "10. Açık Cari Alacak", value: `₺${formatMoney(metrics.openLedgerTotal)}`, sub: "Tahsil bekleyen veresiye", icon: BookUser, color: "#af52de" },
    { label: "11. Masa Doluluk Oranı", value: `%${metrics.occupancyPct}`, sub: `${metrics.occupiedTables} / ${metrics.totalTables} masa dolu`, icon: Users, color: "#34c759" },
    {
      label: "12. Açık Güvenlik / Kaçak",
      value: `${metrics.fraudOpenCount} Uyarı`,
      sub: `${metrics.fraudCriticalCount} kritik/yüksek • ₺${formatMoney(metrics.fraudImpact)}`,
      icon: ShieldAlert,
      color: metrics.fraudCriticalCount > 0 ? "#ff3b30" : "#8e8e93",
      onClick: () => onNavigate?.("security"),
    },
  ]

  return (
    <div className="space-y-4">
      {/* 12 Comprehensive Patron KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              onClick={card.onClick}
              className={`rounded-2xl border border-[#e5e5ea] bg-white p-3.5 transition-all ${
                card.onClick ? "cursor-pointer hover:border-[#e63462]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-semibold text-[#86868b] truncate">{card.label}</span>
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f] tabular-nums leading-tight">
                {card.value}
              </p>
              <p className="mt-1 text-[10.5px] text-[#86868b] truncate">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* 5-Channel Payment Method Breakdown Bars */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Ödeme Yöntemi Kırılımı (5 Kanal Kasa Analizi)
            </h3>
          </div>
          <span className="text-[12px] font-semibold text-[#1d1d1f] tabular-nums">
            Toplam: ₺{formatMoney(totalPayments)}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { label: "Nakit", amount: metrics.paymentBreakdown.cash, color: "bg-[#34c759]", icon: Banknote },
            { label: "Kredi Kartı", amount: metrics.paymentBreakdown.creditCard, color: "bg-[#007aff]", icon: CreditCard },
            { label: "Yemek Kartı", amount: metrics.paymentBreakdown.mealCard, color: "bg-[#ff9500]", icon: Utensils },
            { label: "Multinet", amount: metrics.paymentBreakdown.multinet, color: "bg-[#5856d6]", icon: Layers },
            { label: "Cari (Veresiye)", amount: metrics.paymentBreakdown.ledger, color: "bg-[#af52de]", icon: BookUser },
          ].map((pm) => {
            const Icon = pm.icon
            const share = payPct(pm.amount)
            return (
              <div key={pm.label} className="rounded-xl bg-[#f9f9fb] p-3 border border-[#e5e5ea]">
                <div className="flex items-center justify-between text-[11px] text-[#86868b]">
                  <span className="flex items-center gap-1 font-medium text-[#1d1d1f]">
                    <Icon className="h-3.5 w-3.5 text-[#86868b]" />
                    {pm.label}
                  </span>
                  <span className="font-semibold text-[#1d1d1f]">%{share}</span>
                </div>
                <p className="mt-1 text-[14px] font-bold text-[#1d1d1f] tabular-nums">
                  ₺{formatMoney(pm.amount)}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e5ea]">
                  <div
                    className={`h-full rounded-full ${pm.color}`}
                    style={{ width: `${Math.max(share, toMinorUnits(pm.amount) > 0 ? 5 : 0)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BossAnalyticsSections
        hourlySales={hourlySales}
        categoryBreakdown={categoryBreakdown}
        topProducts={topProducts}
        waiterPerformance={waiterPerformance}
        shiftSummaries={shiftSummaries}
      />
    </div>
  )
}
