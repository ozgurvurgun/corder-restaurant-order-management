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
    <div className="rounded-2xl border border-[#e5e5ea] bg-white overflow-hidden">
      <div className="p-4 border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusFilterChange(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                statusFilter === tab.id
                  ? "bg-[#e63462] text-white"
                  : "bg-[#f5f5f7] text-[#636366] hover:text-[#1d1d1f]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Mekan veya marka ara..."
              className="h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] pl-8 pr-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
          <button
            type="button"
            onClick={onStartCycle}
            disabled={bulkBusy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-[12px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            <Clock className="h-3.5 w-3.5" />
            25-30 Tahsilat Dönemi Başlat
          </button>
          <button
            type="button"
            onClick={onBulkSuspendUnpaid}
            disabled={bulkBusy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Ödeme Yapmayanları Durdur
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              <th className="px-4 py-3">Mekan / Şube</th>
              <th className="px-4 py-3">Marka / Model</th>
              <th className="px-4 py-3">Aylık Ücret (₺)</th>
              <th className="px-4 py-3">Tahsilat &amp; Erişim Durumu</th>
              <th className="px-4 py-3">Son Ödeme</th>
              <th className="px-4 py-3 text-right">Ödeme &amp; Erişim Kontrolü</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {filteredRestaurants.map((r) => {
              const isSusp = Boolean(
                r.isAccessSuspended || r.billingStatus === "suspended"
              )
              const isBusy = busyRestId === r.id
              return (
                <tr
                  key={r.id}
                  className={`transition-colors ${
                    isSusp ? "bg-red-50/50" : "hover:bg-[#f9f9fb]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/dashboard/restaurants/${r.id}`}
                      className="font-semibold text-[#1d1d1f] hover:text-[#e63462] block"
                    >
                      {r.name}
                    </Link>
                    <span className="text-[11px] font-mono text-[#86868b]">{r.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.brandName ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1d1d1f] block">
                        <Building2 className="h-3 w-3 text-[#e63462]" />
                        {r.brandName}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#86868b]">Bağımsız Mekan</span>
                    )}
                    <span className="text-[11px] text-[#86868b]">
                      {r.branchType === "franchise"
                        ? "Franchise Şubesi"
                        : r.branchType === "company_owned"
                          ? "Merkez / Özmal Şube"
                          : "Tekil İşletme"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={feeDrafts[r.id] ?? String(r.monthlyFee ?? 0)}
                        onChange={(e) => onFeeDraftChange(r.id, e.target.value)}
                        className="h-8 w-28 rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 text-[12px] font-semibold text-[#1d1d1f] outline-none focus:border-[#e63462]"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onSaveMonthlyFee(r)}
                        className="h-8 rounded-lg border border-[#d1d1d6] bg-white px-2.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                        title="Aylık Ücreti Kaydet"
                      >
                        Kaydet
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isSusp ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                        <Ban className="h-3.5 w-3.5" />
                        Ödeme Alınmadı • Erişim Durduruldu
                      </span>
                    ) : r.billingStatus === "pending" || r.billingStatus === "overdue" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {r.billingStatus === "overdue"
                          ? "Ödeme Gecikti"
                          : "Ödeme Bekleniyor (25-30)"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ödeme Alındı • Erişim Açık
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#636366]">
                    {r.lastPaymentDate ? (
                      <div>
                        <p className="text-[#1d1d1f] font-medium">
                          {formatIstanbulDate(r.lastPaymentDate)}
                        </p>
                        {r.lastPaidPeriod && (
                          <p className="text-[11px] text-[#86868b]">
                            Dönem: {r.lastPaidPeriod}
                          </p>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onMarkPaid(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#34c759] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isSusp ? "Ödeme Alındı (Erişimi Aç)" : "Ödeme Alındı"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openPaymentDialog(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:opacity-50"
                        title="Detaylı Tahsilat Kaydı & Geçmiş"
                      >
                        <ReceiptText className="h-3.5 w-3.5 text-[#34c759]" />
                        Geçmiş ({r.paymentHistory?.length ?? 0})
                      </button>
                      {!isSusp && r.billingStatus !== "pending" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onMarkPending(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Bekliyor
                        </button>
                      )}
                      {!isSusp && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onSuspendUnpaid(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
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
                <td colSpan={6} className="p-8 text-center text-[13px] text-[#86868b]">
                  Kriterlere uygun mekan bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailRestaurant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setDetailRestaurantId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {detailRestaurant.name} — Tahsilat Kaydı &amp; Geçmiş
                </h3>
                <p className="text-[12px] text-[#86868b]">
                  Aylık Ücret: {formatMoney(detailRestaurant.monthlyFee ?? 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRestaurantId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed]"
              >
                <X className="h-4 w-4 text-[#86868b]" />
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
              className="mt-4 space-y-3 border-b border-[#f0f0f0] pb-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                Yeni Tahsilat İşle
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                    Tahsilat Tutarı (₺) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[13px] font-semibold text-[#1d1d1f] outline-none focus:border-[#e63462]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                    Dönem (YYYY-AA) *
                  </label>
                  <input
                    type="text"
                    value={payPeriod}
                    onChange={(e) => setPayPeriod(e.target.value)}
                    placeholder="2026-11"
                    className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 font-mono text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Dekont / Açıklama Notu
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Örn: Havale / EFT dekontu onaylandı"
                  className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyRestId === detailRestaurant.id}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#34c759] px-4 text-[12px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Ödemeyi Kaydet &amp; Erişimi Aç
                </button>
              </div>
            </form>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-2">
                Tahsilat Geçmişi ({detailRestaurant.paymentHistory?.length ?? 0})
              </p>
              {!detailRestaurant.paymentHistory ||
              detailRestaurant.paymentHistory.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-[#86868b]">
                  Henüz kayıtlı tahsilat geçmişi bulunmuyor.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-[#f0f0f0] rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] px-3">
                  {detailRestaurant.paymentHistory.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-[12px]"
                    >
                      <div>
                        <p className="font-semibold text-[#1d1d1f]">
                          Dönem: <span className="font-mono">{item.period}</span>
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          {formatIstanbulDateTime(item.paidAt)}
                          {item.recordedBy ? ` • ${item.recordedBy}` : ""}
                        </p>
                        {item.note && (
                          <p className="text-[11px] text-[#636366] mt-0.5">{item.note}</p>
                        )}
                      </div>
                      <span className="font-semibold text-emerald-700 shrink-0 tabular-nums">
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
