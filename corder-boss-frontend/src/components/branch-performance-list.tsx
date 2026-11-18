import { useBossStore } from "@/lib/boss-store"
import type { BranchLivePulse } from "@/lib/types"
import { formatIstanbulTime, formatMoney } from "@/lib/format"
import {
  AlertTriangle,
  Building2,
  Clock,
} from "lucide-react"

export type BranchTypeFilter = "ALL" | "company_owned" | "franchise"

interface BranchPerformanceListProps {
  branchTypeFilter: BranchTypeFilter
  onChangeBranchTypeFilter: (filter: BranchTypeFilter) => void
  filteredBranches: BranchLivePulse[]
  monthEstimatedRoyalty: number
}

export function BranchPerformanceList({
  branchTypeFilter,
  onChangeBranchTypeFilter,
  filteredBranches,
  monthEstimatedRoyalty,
}: BranchPerformanceListProps) {
  const {
    overview,
    branches,
    selectedBranchId,
    setSelectedBranchId,
  } = useBossStore()

  const totalBranchesCount = overview?.branches.length ?? 0
  const suspendedBranches = (overview?.allOwnedBranches ?? []).filter(
    (b) => b.isAccessSuspended || b.billingStatus === "suspended"
  )

  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#e63462]" />
          <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
            Şubeler &amp; Franchise Performansı ({filteredBranches.length})
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {totalBranchesCount > 1 && (
            <div className="inline-flex rounded-lg bg-[#f5f5f7] p-0.5 text-[11px] font-medium border border-[#d1d1d6]/60">
              <button
                type="button"
                onClick={() => onChangeBranchTypeFilter("ALL")}
                className={`rounded-md px-2.5 py-1 ${
                  branchTypeFilter === "ALL"
                    ? "bg-white text-[#1d1d1f] shadow-2xs"
                    : "text-[#86868b]"
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => onChangeBranchTypeFilter("company_owned")}
                className={`rounded-md px-2.5 py-1 ${
                  branchTypeFilter === "company_owned"
                    ? "bg-white text-[#1d1d1f] shadow-2xs"
                    : "text-[#86868b]"
                }`}
              >
                Merkez
              </button>
              <button
                type="button"
                onClick={() => onChangeBranchTypeFilter("franchise")}
                className={`rounded-md px-2.5 py-1 ${
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
              className="text-[12px] font-medium text-[#e63462] hover:underline"
            >
              Tümünü Göster
            </button>
          )}
        </div>
      </div>

      {suspendedBranches.length > 0 && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-800">
          <div className="flex items-center gap-1.5 font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              Ödeme Gecikmesi Nedeniyle Askıya Alınan Şubeler ({suspendedBranches.length})
            </span>
          </div>
          <p className="mt-1 text-[11px] text-red-700/90">
            {suspendedBranches.map((b) => b.name).join(", ")} — Aylık abonelik ödemesi tamamlandığında erişim otomatik açılır.
          </p>
        </div>
      )}

      {monthEstimatedRoyalty > 0 && (
        <div className="mb-3 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2.5 flex items-center justify-between text-[12px]">
          <span className="font-medium text-purple-900">
            Franchise Şubeleri Tahmini Royalty Payı (Bu Ay)
          </span>
          <span className="font-bold text-purple-700 tabular-nums">
            ₺{formatMoney(monthEstimatedRoyalty)}
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {filteredBranches.map((br) => (
          <div
            key={br.id}
            onClick={() => setSelectedBranchId(br.id)}
            className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
              selectedBranchId === br.id
                ? "border-[#e63462] bg-[#e63462]/[0.04]"
                : "border-[#e5e5ea] bg-[#f9f9fb] hover:border-[#d1d1d6]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f]">
                    {br.name}
                  </h4>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                      br.branchType === "franchise"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {br.branchType === "franchise" ? "Franchise" : "Merkez Şube"}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                      br.activeShift
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {br.activeShift ? "Vardiya Açık" : "Kasa Kapalı"}
                  </span>
                  {br.billingStatus === "overdue" && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Ödeme Bekliyor
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                  {br.brandName ? `${br.brandName} • ` : ""}
                  {br.franchiseeCompanyName ? `${br.franchiseeCompanyName} • ` : ""}
                  {br.address || br.slug}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-bold text-[#e63462] tabular-nums">
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
                <p className="text-[12px] font-semibold text-[#1d1d1f]">
                  {br.occupiedTableCount}/{br.totalTableCount}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#86868b]">Açık Hesap</p>
                <p className="text-[12px] font-semibold text-[#1d1d1f]">
                  ₺{formatMoney(br.openChecksTotal)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#86868b]">Personel</p>
                <p className="text-[12px] font-semibold text-[#1d1d1f]">
                  {br.staffCount} Kişi
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#86868b]">İptal/İskonto</p>
                <p className="text-[12px] font-semibold text-[#1d1d1f]">
                  {br.todayCancelCount} / ₺{formatMoney(br.todayDiscountTotal)}
                </p>
              </div>
            </div>

            {br.activeShift && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-[#e5e5ea] px-2.5 py-1.5 text-[11px] text-[#86868b]">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-green-600" />
                  Kasa: <span className="font-medium text-[#1d1d1f]">{br.activeShift.openedBy}</span>
                  {br.activeShift.openedAt && (
                    <span>({formatIstanbulTime(br.activeShift.openedAt)})</span>
                  )}
                </span>
                <span>
                  Nakit: <span className="font-medium text-[#1d1d1f]">₺{formatMoney(br.activeShift.totalCash)}</span>
                  {" • "}
                  Kart: <span className="font-medium text-[#1d1d1f]">₺{formatMoney(br.activeShift.totalCard)}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
