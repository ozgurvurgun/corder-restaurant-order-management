import { Link } from "react-router-dom"
import type { Restaurant } from "@/lib/types"
import {
  CheckCircle2,
  Ban,
  Clock,
  Search,
  ShieldAlert,
  Building2,
} from "lucide-react"

export type BillingStatusFilter = "ALL" | "paid" | "pending" | "suspended"

interface RecordPaymentModalProps {
  restaurantsCount: number
  paidCount: number
  pendingCount: number
  suspendedCount: number
  filteredRestaurants: Restaurant[]
  statusFilter: BillingStatusFilter
  onStatusFilterChange: (filter: BillingStatusFilter) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  feeDrafts: Record<string, string>
  onFeeDraftChange: (restaurantId: string, value: string) => void
  busyRestId: string | null
  bulkBusy: boolean
  onSaveMonthlyFee: (restaurant: Restaurant) => void
  onMarkPaid: (restaurant: Restaurant) => void
  onMarkPending: (restaurant: Restaurant) => void
  onSuspendUnpaid: (restaurant: Restaurant) => void
  onStartCycle: () => void
  onBulkSuspendUnpaid: () => void
}

export function RecordPaymentModal({
  restaurantsCount,
  paidCount,
  pendingCount,
  suspendedCount,
  filteredRestaurants,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  feeDrafts,
  onFeeDraftChange,
  busyRestId,
  bulkBusy,
  onSaveMonthlyFee,
  onMarkPaid,
  onMarkPending,
  onSuspendUnpaid,
  onStartCycle,
  onBulkSuspendUnpaid,
}: RecordPaymentModalProps) {
  const filterTabs: { id: BillingStatusFilter; label: string }[] = [
    { id: "ALL", label: `Tüm Mekanlar (${restaurantsCount})` },
    { id: "paid", label: `Ödeme Alındı (${paidCount})` },
    { id: "pending", label: `Tahsilat Bekleyen (${pendingCount})` },
    { id: "suspended", label: `Erişimi Durdurulan (${suspendedCount})` },
  ]

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
      <div className="p-5 border-b border-[#2a2a2a] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusFilterChange(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? "bg-[#e63462] text-white"
                  : "bg-[#0f0f0f] text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Mekan veya marka ara..."
              className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-[#e63462]"
            />
          </div>
          <button
            type="button"
            onClick={onStartCycle}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Clock className="h-3.5 w-3.5" />
            25-30 Tahsilat Dönemi Başlat
          </button>
          <button
            type="button"
            onClick={onBulkSuspendUnpaid}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Ödeme Yapmayanları Durdur
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-xs text-zinc-400 bg-[#141414]">
              <th className="p-4 font-medium">Mekan / Şube</th>
              <th className="p-4 font-medium">Marka / Model</th>
              <th className="p-4 font-medium">Aylık Ücret (₺)</th>
              <th className="p-4 font-medium">Tahsilat &amp; Erişim Durumu</th>
              <th className="p-4 font-medium">Son Ödeme</th>
              <th className="p-4 font-medium text-right">Ödeme &amp; Erişim Kontrolü</th>
            </tr>
          </thead>
          <tbody>
            {filteredRestaurants.map((r) => {
              const isSusp = Boolean(r.isAccessSuspended || r.billingStatus === "suspended")
              const isBusy = busyRestId === r.id
              return (
                <tr
                  key={r.id}
                  className={`border-b border-[#2a2a2a] last:border-0 ${
                    isSusp ? "bg-red-950/15" : "hover:bg-[#222]"
                  }`}
                >
                  <td className="p-4">
                    <Link
                      to={`/dashboard/restaurants/${r.id}`}
                      className="font-semibold text-white hover:underline block"
                    >
                      {r.name}
                    </Link>
                    <span className="text-xs font-mono text-zinc-500">{r.slug}</span>
                  </td>
                  <td className="p-4">
                    {r.brandName ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-200 block">
                        <Building2 className="h-3 w-3 text-[#e63462]" />
                        {r.brandName}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">Bağımsız Mekan</span>
                    )}
                    <span className="text-[11px] text-zinc-400">
                      {r.branchType === "franchise"
                        ? "Franchise Şubesi"
                        : r.branchType === "company_owned"
                          ? "Merkez / Özmal Şube"
                          : "Tekil İşletme"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="50"
                        value={feeDrafts[r.id] ?? String(r.monthlyFee ?? 0)}
                        onChange={(e) => onFeeDraftChange(r.id, e.target.value)}
                        className="w-28 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1.5 text-xs font-semibold text-white outline-none focus:border-[#e63462]"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onSaveMonthlyFee(r)}
                        className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-[#2a2a2a] hover:text-white disabled:opacity-50"
                        title="Aylık Ücreti Kaydet"
                      >
                        Kaydet
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    {isSusp ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400">
                        <Ban className="h-3.5 w-3.5" />
                        Ödeme Alınmadı • Erişim Durduruldu
                      </span>
                    ) : r.billingStatus === "pending" || r.billingStatus === "overdue" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                        <Clock className="h-3.5 w-3.5" />
                        Ödeme Bekleniyor (25-30 Tahsilat)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ödeme Alındı • Erişim Açık
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-zinc-400">
                    {r.lastPaymentDate ? (
                      <div>
                        <p className="text-zinc-200 font-medium">
                          {new Date(r.lastPaymentDate).toLocaleDateString("tr-TR")}
                        </p>
                        {r.lastPaidPeriod && (
                          <p className="text-[11px] text-zinc-500">Dönem: {r.lastPaidPeriod}</p>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onMarkPaid(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isSusp ? "Ödeme Alındı (Erişimi Aç)" : "Ödeme Alındı"}
                      </button>
                      {!isSusp && r.billingStatus !== "pending" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onMarkPending(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                        >
                          Bekliyor
                        </button>
                      )}
                      {!isSusp && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onSuspendUnpaid(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Erişimi Durdur
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredRestaurants.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  Kriterlere uygun mekan bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
