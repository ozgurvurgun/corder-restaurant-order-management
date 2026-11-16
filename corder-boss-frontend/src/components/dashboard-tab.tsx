import { useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import type { BossTabId } from "@/lib/types"
import {
  TrendingUp,
  Utensils,
  Wallet,
  AlertTriangle,
  Percent,
  Ban,
  Building2,
  Users,
  ShieldCheck,
  ChevronRight,
  Banknote,
  CreditCard,
  BookUser,
  Clock,
} from "lucide-react"

function formatMoney(val: number): string {
  return Number(val || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function DashboardTab({ onNavigate }: { onNavigate: (tab: BossTabId) => void }) {
  const {
    overview,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    effectiveBranch,
  } = useBossStore()
  const [branchTypeFilter, setBranchTypeFilter] = useState<
    "ALL" | "company_owned" | "franchise"
  >("ALL")

  const metrics = overview?.consolidated ?? {
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    todayOrderCount: 0,
    todayDiscountTotal: 0,
    todayCancelCount: 0,
    todayCancelAmount: 0,
    occupiedTableCount: 0,
    totalTableCount: 0,
    openChecksTotal: 0,
    openOrderCount: 0,
    criticalStockCount: 0,
    staffCount: 0,
    openLedgerBalance: 0,
    paymentBreakdown: {
      cash: 0,
      creditCard: 0,
      mealCard: 0,
      multinet: 0,
      ledger: 0,
    },
  }

  const totalPayments =
    metrics.paymentBreakdown.cash +
    metrics.paymentBreakdown.creditCard +
    metrics.paymentBreakdown.mealCard +
    metrics.paymentBreakdown.multinet +
    metrics.paymentBreakdown.ledger

  const pct = (val: number) =>
    totalPayments > 0 ? Math.round((val / totalPayments) * 100) : 0

  return (
    <div className="space-y-4 pb-6">
      {/* Live Revenue Hero Card (Menulux Boss Style + Corder Gradient) */}
      <div className="rounded-3xl bg-gradient-to-br from-[#e63462] via-[#c62a6b] to-[#7b2d8e] p-5 text-white shadow-xl shadow-[#e63462]/20">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#34c759] animate-pulse" />
              {selectedBranchId === "ALL"
                ? `${branches.length} Şube Konsolide Ciro`
                : `${effectiveBranch?.name ?? "Şube"} Canlı Ciro`}
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
              amount:
                metrics.paymentBreakdown.mealCard + metrics.paymentBreakdown.multinet,
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
                    style={{ width: `${Math.max(share, item.amount > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Multi-Branch & Franchise Comparison List */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-bold text-[#1d1d1f]">
              Şubeler &amp; Franchise Performansı ({overview?.branches.length ?? 0})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(overview?.branches.length ?? 0) > 1 && (
              <div className="inline-flex rounded-lg bg-[#f5f5f7] p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setBranchTypeFilter("ALL")}
                  className={`rounded-md px-2 py-1 ${
                    branchTypeFilter === "ALL"
                      ? "bg-white text-[#1d1d1f] shadow-2xs"
                      : "text-[#86868b]"
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setBranchTypeFilter("company_owned")}
                  className={`rounded-md px-2 py-1 ${
                    branchTypeFilter === "company_owned"
                      ? "bg-white text-[#1d1d1f] shadow-2xs"
                      : "text-[#86868b]"
                  }`}
                >
                  Merkez
                </button>
                <button
                  type="button"
                  onClick={() => setBranchTypeFilter("franchise")}
                  className={`rounded-md px-2 py-1 ${
                    branchTypeFilter === "franchise"
                      ? "bg-white text-[#1d1d1f] shadow-2xs"
                      : "text-[#86868b]"
                  }`}
                >
                  Franchise
                </button>
              </div>
            )}
            {branches.length > 1 && selectedBranchId !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedBranchId("ALL")}
                className="text-[12px] font-semibold text-[#e63462] hover:underline"
              >
                Tümünü Göster
              </button>
            )}
          </div>
        </div>

        {(metrics.monthEstimatedRoyalty ?? 0) > 0 && (
          <div className="mb-3 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2.5 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-purple-900">
              Franchise Şubeleri Tahmini Royalty Payı (Bu Ay)
            </span>
            <span className="font-extrabold text-purple-700 tabular-nums">
              ₺{formatMoney(metrics.monthEstimatedRoyalty ?? 0)}
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          {(overview?.branches ?? [])
            .filter((br) => {
              if (branchTypeFilter === "ALL") return true
              if (branchTypeFilter === "franchise") return br.branchType === "franchise"
              return br.branchType !== "franchise"
            })
            .map((br) => (
            <div
              key={br.id}
              onClick={() => setSelectedBranchId(br.id)}
              className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                selectedBranchId === br.id
                  ? "border-[#e63462] bg-[#e63462]/[0.04]"
                  : "border-[#e5e5ea] bg-[#f9f9fb] hover:border-[#d1d1d6]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="text-[14px] font-bold text-[#1d1d1f]">
                      {br.name}
                    </h4>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        br.branchType === "franchise"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {br.branchType === "franchise" ? "Franchise" : "Merkez Şube"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        br.activeShift
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {br.activeShift ? "Vardiya Açık" : "Kasa Kapalı"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#86868b] mt-0.5">
                    {br.brandName ? `${br.brandName} • ` : ""}
                    {br.address || br.slug}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-extrabold text-[#e63462] tabular-nums">
                    ₺{formatMoney(br.todayRevenue)}
                  </p>
                  <p className="text-[10px] text-[#86868b]">
                    Bugün ({br.todayOrderCount} adisyon) • Bu Ay: ₺{formatMoney(br.monthRevenue)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[#e5e5ea] pt-2.5 text-center">
                <div>
                  <p className="text-[10px] text-[#86868b]">Dolu Masa</p>
                  <p className="text-[12px] font-bold text-[#1d1d1f]">
                    {br.occupiedTableCount}/{br.totalTableCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#86868b]">Açık Hesap</p>
                  <p className="text-[12px] font-bold text-[#1d1d1f]">
                    ₺{formatMoney(br.openChecksTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#86868b]">Personel</p>
                  <p className="text-[12px] font-bold text-[#1d1d1f]">
                    {br.staffCount} Kişi
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#86868b]">İptal/İskonto</p>
                  <p className="text-[12px] font-bold text-[#1d1d1f]">
                    {br.todayCancelCount} / ₺{formatMoney(br.todayDiscountTotal)}
                  </p>
                </div>
              </div>

              {br.activeShift && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-2.5 py-1.5 text-[11px] text-[#86868b]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-green-600" />
                    Kasa Sorumlusu: <strong className="text-[#1d1d1f]">{br.activeShift.openedBy}</strong>
                  </span>
                  <span>
                    Nakit: <strong className="text-[#1d1d1f]">₺{formatMoney(br.activeShift.totalCash)}</strong>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

