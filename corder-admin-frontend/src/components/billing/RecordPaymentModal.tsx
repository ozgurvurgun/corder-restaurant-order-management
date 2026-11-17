import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { Restaurant } from "@/lib/types"
import {
  formatIstanbulDate,
  formatIstanbulDateTime,
  formatMoney,
  fromMinorUnits,
  getIstanbulBillingPeriod,
  toMinorUnits,
} from "@/lib/money"
import {
  CheckCircle2,
  Ban,
  Clock,
  Search,
  ShieldAlert,
  Building2,
  ReceiptText,
  X,
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
  onMarkPaid: (
    restaurant: Restaurant,
    details?: { amount?: number; period?: string; note?: string }
  ) => void
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
  const [detailRestaurantId, setDetailRestaurantId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payPeriod, setPayPeriod] = useState(getIstanbulBillingPeriod)
  const [payNote, setPayNote] = useState("")

  const detailRestaurant = detailRestaurantId
    ? filteredRestaurants.find((r) => r.id === detailRestaurantId) ?? null
    : null

  useEffect(() => {
    if (!detailRestaurantId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailRestaurantId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [detailRestaurantId])

  const openPaymentDialog = (r: Restaurant) => {
    setDetailRestaurantId(r.id)
    setPayAmount(feeDrafts[r.id] ?? String(r.monthlyFee ?? 0))
    setPayPeriod(getIstanbulBillingPeriod())
    setPayNote("")
  }

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
              const isSusp = Boolean(
                r.isAccessSuspended || r.billingStatus === "suspended"
              )
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
                        step="0.01"
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
                        {r.billingStatus === "overdue"
                          ? "Ödeme Gecikti"
                          : "Ödeme Bekleniyor (25-30)"}
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
                          {formatIstanbulDate(r.lastPaymentDate)}
                        </p>
                        {r.lastPaidPeriod && (
                          <p className="text-[11px] text-zinc-500">
                            Dönem: {r.lastPaidPeriod}
                          </p>
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
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openPaymentDialog(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-[#2a2a2a] hover:text-white disabled:opacity-50"
                        title="Detaylı Tahsilat Kaydı & Geçmiş"
                      >
                        <ReceiptText className="h-3.5 w-3.5 text-emerald-400" />
                        Geçmiş ({r.paymentHistory?.length ?? 0})
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

      {detailRestaurant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setDetailRestaurantId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {detailRestaurant.name} — Tahsilat Kaydı &amp; Geçmiş
                </h3>
                <p className="text-xs text-zinc-400">
                  Aylık Ücret: {formatMoney(detailRestaurant.monthlyFee ?? 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRestaurantId(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const amt = Math.max(0, fromMinorUnits(toMinorUnits(payAmount)))
                onMarkPaid(detailRestaurant, {
                  amount: amt,
                  period: payPeriod.trim() || undefined,
                  note: payNote.trim() || undefined,
                })
                setDetailRestaurantId(null)
              }}
              className="mt-4 space-y-3 border-b border-[#2a2a2a] pb-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Yeni Tahsilat İşle
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-300">
                    Tahsilat Tutarı (₺) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-300">
                    Dönem (YYYY-AA) *
                  </label>
                  <input
                    type="text"
                    value={payPeriod}
                    onChange={(e) => setPayPeriod(e.target.value)}
                    placeholder="2026-11"
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 font-mono text-sm text-white outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-300">
                  Dekont / Açıklama Notu
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Örn: Havale / EFT dekontu onaylandı"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyRestId === detailRestaurant.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Ödemeyi Kaydet &amp; Erişimi Aç
                </button>
              </div>
            </form>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Tahsilat Geçmişi ({detailRestaurant.paymentHistory?.length ?? 0})
              </p>
              {!detailRestaurant.paymentHistory ||
              detailRestaurant.paymentHistory.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">
                  Henüz kayıtlı tahsilat geçmişi bulunmuyor.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-[#2a2a2a] rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3">
                  {detailRestaurant.paymentHistory.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-medium text-white">
                          Dönem: <span className="font-mono">{item.period}</span>
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {formatIstanbulDateTime(item.paidAt)}
                          {item.recordedBy ? ` • ${item.recordedBy}` : ""}
                        </p>
                        {item.note && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">{item.note}</p>
                        )}
                      </div>
                      <span className="font-semibold text-emerald-400 shrink-0">
                        {formatMoney(item.amount, true)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
