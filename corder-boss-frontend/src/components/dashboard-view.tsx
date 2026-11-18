import { useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import type { BossTabId } from "@/lib/types"
import {
  formatIstanbulDateTime,
  formatMoney,
  sumMoney,
} from "@/lib/format"
import { BossDetailedAnalytics } from "./boss-detailed-analytics"
import {
  BranchPerformanceList,
  type BranchTypeFilter,
} from "./branch-performance-list"
import { PaginationBar } from "./ui/pagination-bar"
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Receipt,
  Clock,
  Utensils,
} from "lucide-react"

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (tab: BossTabId) => void
}) {
  const {
    overview,
    tables,
    orders,
    effectiveBranch,
    openCriticalHighAlertCount,
  } = useBossStore()
  const [branchTypeFilter, setBranchTypeFilter] = useState<BranchTypeFilter>("ALL")
  const [liveOrderPage, setLiveOrderPage] = useState(1)
  const liveOrderPageSize = 6

  const filteredBranches = useMemo(() => {
    const list = overview?.branches ?? []
    if (branchTypeFilter === "ALL") return list
    if (branchTypeFilter === "franchise") {
      return list.filter((br) => br.branchType === "franchise")
    }
    return list.filter((br) => br.branchType !== "franchise")
  }, [overview?.branches, branchTypeFilter])

  const monthEstimatedRoyalty = useMemo(
    () =>
      sumMoney(
        ...filteredBranches.map((b) => b.estimatedMonthRoyalty ?? 0)
      ),
    [filteredBranches]
  )

  const totalStaffCount = useMemo(
    () => filteredBranches.reduce((s, b) => s + b.staffCount, 0),
    [filteredBranches]
  )

  const tableNameById = useMemo(
    () => new Map(tables.map((t) => [t.id, t.name])),
    [tables]
  )

  const liveOrdersFeed = useMemo(() => {
    const raw =
      overview?.liveOrders && overview.liveOrders.length > 0
        ? overview.liveOrders
        : orders
    return raw.map((ord) => {
      const items = ord.items ?? []
      const activeTotal = items
        .filter((i) => i.status !== "cancelled" && i.status !== "ledger")
        .reduce((s, i) => sumMoney(s, i.price * i.quantity), 0)
      const cancelledItemsCount = items
        .filter((i) => i.status === "cancelled")
        .reduce((s, i) => s + i.quantity, 0)
      const ext = ord as {
        branchName?: string
        tableName?: string
        totalAmount?: number
      }
      return {
        ...ord,
        branchName: ext.branchName || effectiveBranch?.name || "Şube",
        tableName: ext.tableName || tableNameById.get(ord.tableId) || "Masa",
        totalAmount: ext.totalAmount ?? activeTotal,
        cancelledItemsCount,
      }
    })
  }, [overview?.liveOrders, orders, effectiveBranch?.name, tableNameById])

  const pagedLiveOrders = useMemo(() => {
    const start = (liveOrderPage - 1) * liveOrderPageSize
    return liveOrdersFeed.slice(start, start + liveOrderPageSize)
  }, [liveOrdersFeed, liveOrderPage])

  return (
    <div className="space-y-4">
      {/* Quick Boss Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("permissions")}
          className="flex items-center justify-between rounded-2xl border border-[#e5e5ea] bg-white p-3.5 text-left hover:border-[#d1d1d6] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                Rol &amp; Yetkiler
              </p>
              <p className="text-[11px] text-[#86868b] truncate">
                İskonto limitleri &amp; 48 granüler yetki
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#86868b]" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("staff")}
          className="flex items-center justify-between rounded-2xl border border-[#e5e5ea] bg-white p-3.5 text-left hover:border-[#d1d1d6] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#007aff]/10 text-[#007aff]">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                Kullanıcı &amp; Şube Yöneticileri
              </p>
              <p className="text-[11px] text-[#86868b] truncate">
                {totalStaffCount} aktif personel ve şube yetkilileri
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#86868b]" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("security")}
          className="flex items-center justify-between rounded-2xl border border-[#e5e5ea] bg-white p-3.5 text-left hover:border-[#e63462] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                Güvenlik &amp; Kaçak Tespiti
              </p>
              <p className="text-[11px] text-[#86868b] truncate">
                {openCriticalHighAlertCount > 0
                  ? `${openCriticalHighAlertCount} kritik/yüksek açık uyarı`
                  : "7 gerçek zamanlı suistimal algoritması"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#86868b]" />
        </button>
      </div>

      {/* Ultra-Detailed Boss Metrics & Operational Analytics */}
      <BossDetailedAnalytics
        filteredBranches={filteredBranches}
        onNavigate={onNavigate}
      />

      {/* Paginated Branch & Franchise Performance Table */}
      <BranchPerformanceList
        branchTypeFilter={branchTypeFilter}
        onChangeBranchTypeFilter={setBranchTypeFilter}
        filteredBranches={filteredBranches}
        monthEstimatedRoyalty={monthEstimatedRoyalty}
      />

      {/* Paginated Live Orders Feed */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#e63462]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Canlı Adisyon &amp; Sipariş Akışı ({liveOrdersFeed.length})
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Açık masalardaki anlık adisyonlar, garson ve kalem detayları
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("operations")}
            className="text-[12px] font-semibold text-[#e63462] hover:underline"
          >
            Canlı Masalara Git →
          </button>
        </div>

        {liveOrdersFeed.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#86868b]">
            Şu anda açık adisyon veya aktif sipariş bulunmuyor.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {pagedLiveOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-[#1d1d1f]">
                          {ord.tableName}
                        </span>
                        <span className="rounded bg-white border border-[#e5e5ea] px-1.5 py-0.5 text-[10px] font-medium text-[#86868b]">
                          {ord.branchName}
                        </span>
                        {ord.userName && (
                          <span className="rounded bg-[#e63462]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#e63462]">
                            Garson: {ord.userName}
                          </span>
                        )}
                        {ord.cancelledItemsCount > 0 && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            {ord.cancelledItemsCount} İptal
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#86868b] line-clamp-1">
                        <Utensils className="inline h-3 w-3 mr-1 text-[#86868b]" />
                        {(ord.items ?? [])
                          .map((it) => `${it.quantity}x ${it.productName}`)
                          .join(", ") || "Kalem yok"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[14px] font-bold text-[#1d1d1f] tabular-nums">
                        ₺{formatMoney(ord.totalAmount)}
                      </p>
                      <p className="flex items-center justify-end gap-1 text-[10px] text-[#86868b]">
                        <Clock className="h-2.5 w-2.5" />
                        {formatIstanbulDateTime(ord.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <PaginationBar
              currentPage={liveOrderPage}
              totalItems={liveOrdersFeed.length}
              pageSize={liveOrderPageSize}
              onPageChange={setLiveOrderPage}
              itemLabel="canlı adisyon"
            />
          </>
        )}
      </div>
    </div>
  )
}
