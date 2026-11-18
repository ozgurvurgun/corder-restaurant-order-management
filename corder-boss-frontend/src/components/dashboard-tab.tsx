import { useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import type { BossTabId, BranchLivePulse } from "@/lib/types"
import { formatMoney, sumMoney, toMinorUnits } from "@/lib/format"
import {
  BranchPerformanceList,
  type BranchTypeFilter,
} from "./branch-performance-list"
import {
  DollarSign,
  Utensils,
  Wallet,
  AlertTriangle,
  Percent,
  Ban,
  Users,
  ShieldCheck,
  ChevronRight,
  Banknote,
  CreditCard,
  BookUser,
  LayoutGrid,
  Calendar,
} from "lucide-react"

function aggregateBranches(branches: BranchLivePulse[]) {
  return {
    todayRevenue: sumMoney(...branches.map((b) => b.todayRevenue)),
    weekRevenue: sumMoney(...branches.map((b) => b.weekRevenue)),
    monthRevenue: sumMoney(...branches.map((b) => b.monthRevenue)),
    todayOrderCount: branches.reduce((acc, b) => acc + b.todayOrderCount, 0),
    todayDiscountTotal: sumMoney(...branches.map((b) => b.todayDiscountTotal)),
    todayCancelCount: branches.reduce((acc, b) => acc + b.todayCancelCount, 0),
    todayCancelAmount: sumMoney(...branches.map((b) => b.todayCancelAmount)),
    occupiedTableCount: branches.reduce((acc, b) => acc + b.occupiedTableCount, 0),
    totalTableCount: branches.reduce((acc, b) => acc + b.totalTableCount, 0),
    openChecksTotal: sumMoney(...branches.map((b) => b.openChecksTotal)),
    openOrderCount: branches.reduce((acc, b) => acc + b.openOrderCount, 0),
    criticalStockCount: branches.reduce((acc, b) => acc + b.criticalStockCount, 0),
    staffCount: branches.reduce((acc, b) => acc + b.staffCount, 0),
    openLedgerBalance: sumMoney(...branches.map((b) => b.openLedgerBalance)),
    monthEstimatedRoyalty: sumMoney(
      ...branches.map((b) => b.estimatedMonthRoyalty ?? 0)
    ),
    paymentBreakdown: {
      cash: sumMoney(...branches.map((b) => b.paymentBreakdown.cash)),
      creditCard: sumMoney(...branches.map((b) => b.paymentBreakdown.creditCard)),
      mealCard: sumMoney(...branches.map((b) => b.paymentBreakdown.mealCard)),
      multinet: sumMoney(...branches.map((b) => b.paymentBreakdown.multinet)),
      ledger: sumMoney(...branches.map((b) => b.paymentBreakdown.ledger)),
    },
  }
}

export function DashboardTab({ onNavigate }: { onNavigate: (tab: BossTabId) => void }) {
  const {
    overview,
    branches,
    selectedBranchId,
    effectiveBranch,
  } = useBossStore()
  const [branchTypeFilter, setBranchTypeFilter] = useState<BranchTypeFilter>("ALL")

  const filteredBranches = useMemo(() => {
    const list = overview?.branches ?? []
    if (branchTypeFilter === "ALL") return list
    if (branchTypeFilter === "franchise") {
      return list.filter((br) => br.branchType === "franchise")
    }
    return list.filter((br) => br.branchType !== "franchise")
  }, [overview?.branches, branchTypeFilter])

  const metrics = useMemo(() => {
    if (selectedBranchId === "ALL" && branchTypeFilter !== "ALL") {
      return aggregateBranches(filteredBranches)
    }
    if (overview?.consolidated) {
      return overview.consolidated
    }
    return aggregateBranches([])
  }, [selectedBranchId, branchTypeFilter, filteredBranches, overview?.consolidated])

  const totalPayments = sumMoney(
    metrics.paymentBreakdown.cash,
    metrics.paymentBreakdown.creditCard,
    metrics.paymentBreakdown.mealCard,
    metrics.paymentBreakdown.multinet,
    metrics.paymentBreakdown.ledger
  )
  const totalPaymentsMinorUnits = toMinorUnits(totalPayments)

  const pct = (val: number) => {
    if (totalPaymentsMinorUnits <= 0) return 0
    return Math.round((toMinorUnits(val) / totalPaymentsMinorUnits) * 100)
  }

  const mealAndMultinet = sumMoney(
    metrics.paymentBreakdown.mealCard,
    metrics.paymentBreakdown.multinet
  )

  const scopeBadgeText =
    selectedBranchId !== "ALL"
      ? `${effectiveBranch?.name ?? "Şube"} Canlı Özeti`
      : branchTypeFilter === "franchise"
        ? `${filteredBranches.length} Franchise Şube`
        : branchTypeFilter === "company_owned"
          ? `${filteredBranches.length} Merkez Şube`
          : `${branches.length} Şube Konsolide`

  const topStats = [
    {
      label: "Bugünkü Net Ciro",
      value: `₺${formatMoney(metrics.todayRevenue)}`,
      sub: `${metrics.todayOrderCount} kapanan adisyon`,
      icon: DollarSign,
      color: "#34c759",
    },
    {
      label: "Açık Masalardaki Tutar",
      value: `₺${formatMoney(metrics.openChecksTotal)}`,
      sub: `${metrics.occupiedTableCount} / ${metrics.totalTableCount} masa dolu`,
      icon: LayoutGrid,
      color: "#ff9500",
    },
    {
      label: "Son 7 Gün (Haftalık)",
      value: `₺${formatMoney(metrics.weekRevenue)}`,
      sub: scopeBadgeText,
      icon: Calendar,
      color: "#007aff",
    },
    {
      label: "Bu Ay (Aylık Ciro)",
      value: `₺${formatMoney(metrics.monthRevenue)}`,
      sub: scopeBadgeText,
      icon: Wallet,
      color: "#e63462",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Top 4 KPI Cards matching Merchant Panel DashboardView */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-4 border border-[#e5e5ea]"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon
                    className="w-[18px] h-[18px]"
                    style={{ color: stat.color }}
                  />
                </div>
                <span className="text-[11px] font-medium text-[#86868b]">
                  {stat.sub}
                </span>
              </div>
              <p className="text-[22px] font-bold text-[#1d1d1f] leading-tight tabular-nums">
                {stat.value}
              </p>
              <p className="text-[12px] text-[#86868b] mt-0.5">
                {stat.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Quick Boss Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigate("permissions")}
          className="flex items-center justify-between rounded-2xl border border-[#e5e5ea] bg-white p-4 text-left hover:border-[#d1d1d6] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1d1d1f]">Rol &amp; Yetkiler</p>
              <p className="text-[12px] text-[#86868b]">İskonto limitleri ve 48 granüler aksiyon yetkisi</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#86868b]" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("staff")}
          className="flex items-center justify-between rounded-2xl border border-[#e5e5ea] bg-white p-4 text-left hover:border-[#d1d1d6] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007aff]/10 text-[#007aff]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1d1d1f]">
                Kullanıcı &amp; Şube Yöneticileri
              </p>
              <p className="text-[12px] text-[#86868b]">
                {metrics.staffCount} aktif personel ve şube yetkilileri
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#86868b]" />
        </button>
      </div>

      {/* Operational & Security Pulse Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#86868b]">
              İskonto / İkram
            </span>
            <Percent className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">
            ₺{formatMoney(metrics.todayDiscountTotal)}
          </p>
          <p className="text-[11px] text-[#86868b]">Bugün uygulanan indirim</p>
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#86868b]">
              İptal / Zayi
            </span>
            <Ban className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-red-600 tabular-nums">
            {metrics.todayCancelCount} Adet
          </p>
          <p className="text-[11px] text-[#86868b]">
            ₺{formatMoney(metrics.todayCancelAmount)} tutarında
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#86868b]">
              Cari Alacaklar
            </span>
            <BookUser className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">
            ₺{formatMoney(metrics.openLedgerBalance)}
          </p>
          <p className="text-[11px] text-[#86868b]">Açık veresiye bakiyesi</p>
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#86868b]">
              Kritik Stok
            </span>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">
            {metrics.criticalStockCount} Kalem
          </p>
          <p className="text-[11px] text-[#86868b]">Min. seviye altında</p>
        </div>
      </div>

      {/* Payment Breakdown Card */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Bugünkü Kasa &amp; Ödeme Dağılımı
            </h3>
          </div>
          <span className="text-[12px] font-medium text-[#86868b]">
            Toplam: ₺{formatMoney(totalPayments)}
          </span>
        </div>

        <div className="space-y-2.5">
          {[
            {
              label: "Nakit Tahsilat",
              amount: metrics.paymentBreakdown.cash,
              color: "bg-[#34c759]",
              icon: Banknote,
            },
            {
              label: "Kredi / Banka Kartı",
              amount: metrics.paymentBreakdown.creditCard,
              color: "bg-[#007aff]",
              icon: CreditCard,
            },
            {
              label: "Yemek Kartı & Multinet",
              amount: mealAndMultinet,
              color: "bg-[#ff9500]",
              icon: Utensils,
            },
            {
              label: "Cari / Veresiye",
              amount: metrics.paymentBreakdown.ledger,
              color: "bg-[#af52de]",
              icon: BookUser,
            },
          ].map((item) => {
            const Icon = item.icon
            const share = pct(item.amount)
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                    <Icon className="h-3.5 w-3.5 text-[#86868b]" />
                    {item.label}
                  </span>
                  <span className="font-semibold text-[#1d1d1f] tabular-nums">
                    ₺{formatMoney(item.amount)}{" "}
                    <span className="text-[11px] font-normal text-[#86868b]">
                      (%{share})
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#f5f5f7]">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-300`}
                    style={{ width: `${Math.max(share, toMinorUnits(item.amount) > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BranchPerformanceList
        branchTypeFilter={branchTypeFilter}
        onChangeBranchTypeFilter={setBranchTypeFilter}
        filteredBranches={filteredBranches}
        monthEstimatedRoyalty={metrics.monthEstimatedRoyalty ?? 0}
      />
    </div>
  )
}
