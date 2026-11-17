import { useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import type { BossTabId, BranchLivePulse } from "@/lib/types"
import { formatMoney, sumMoney, toMinorUnits } from "@/lib/format"
import {
  BranchPerformanceList,
  type BranchTypeFilter,
} from "./branch-performance-list"
import {
  TrendingUp,
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

  const heroBadgeText =
    selectedBranchId !== "ALL"
      ? `${effectiveBranch?.name ?? "Şube"} Canlı Ciro`
      : branchTypeFilter === "franchise"
        ? `${filteredBranches.length} Franchise Şube Ciro`
        : branchTypeFilter === "company_owned"
          ? `${filteredBranches.length} Merkez Şube Ciro`
          : `${branches.length} Şube Konsolide Ciro`

  return (
    <div className="space-y-4 pb-6">
      {/* Live Revenue Hero Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#e63462] via-[#c62a6b] to-[#7b2d8e] p-5 text-white shadow-xl shadow-[#e63462]/20">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#34c759] animate-pulse" />
              {heroBadgeText}
            </span>
            <p className="mt-3 text-[12px] font-medium text-white/80">
              Bugünkü Net Ciro ({metrics.todayOrderCount} Kapanan Adisyon)
            </p>
            <h2 className="mt-0.5 text-[34px] font-extrabold tracking-tight tabular-nums leading-none">
              ₺{formatMoney(metrics.todayRevenue)}
            </h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Period Comparisons */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-white/20 pt-4">
          <div className="rounded-2xl bg-white/10 p-2.5 backdrop-blur-xs">
            <p className="text-[10px] font-semibold uppercase text-white/70">
              Açık Masalardaki
            </p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums">
              ₺{formatMoney(metrics.openChecksTotal)}
            </p>
            <p className="text-[10px] text-white/75">
              {metrics.occupiedTableCount}/{metrics.totalTableCount} Masa Dolu
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-2.5 backdrop-blur-xs">
            <p className="text-[10px] font-semibold uppercase text-white/70">
              Son 7 Gün
            </p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums">
              ₺{formatMoney(metrics.weekRevenue)}
            </p>
            <p className="text-[10px] text-white/75">Haftalık Ciro</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-2.5 backdrop-blur-xs">
            <p className="text-[10px] font-semibold uppercase text-white/70">
              Bu Ay
            </p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums">
              ₺{formatMoney(metrics.monthRevenue)}
            </p>
            <p className="text-[10px] text-white/75">Aylık Ciro</p>
          </div>
        </div>
      </div>

      {/* Quick Boss Action Shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("permissions")}
          className="flex items-center justify-between rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5 text-left shadow-xs active:scale-[0.99] hover:border-[#e63462]/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1d1d1f]">Rol &amp; Yetkiler</p>
              <p className="text-[11px] text-[#86868b]">İskonto &amp; aksiyon kısıtları</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#86868b]" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("staff")}
          className="flex items-center justify-between rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5 text-left shadow-xs active:scale-[0.99] hover:border-[#e63462]/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1d1d1f]">
                Kullanıcı Oluştur
              </p>
              <p className="text-[11px] text-[#86868b]">
                {metrics.staffCount} Aktif Personel
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#86868b]" />
        </button>
      </div>

      {/* Operational & Security Pulse Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#86868b]">
              İskonto / İkram
            </span>
            <Percent className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">
            ₺{formatMoney(metrics.todayDiscountTotal)}
          </p>
          <p className="text-[11px] text-[#86868b]">Bugün uygulanan indirim</p>
        </div>

        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#86868b]">
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

        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#86868b]">
              Cari Alacaklar
            </span>
            <BookUser className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">
            ₺{formatMoney(metrics.openLedgerBalance)}
          </p>
          <p className="text-[11px] text-[#86868b]">Açık veresiye bakiyesi</p>
        </div>

        <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#86868b]">
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
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-bold text-[#1d1d1f]">
              Bugünkü Kasa &amp; Ödeme Dağılımı
            </h3>
          </div>
          <span className="text-[12px] font-semibold text-[#86868b]">
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
