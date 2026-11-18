import { Link } from "react-router-dom"
import type { Restaurant } from "@/lib/types"
import {
  PAYMENT_METHOD_LABELS,
  evaluateRestaurantPeriod,
  formatIstanbulDate,
  formatMoney,
  formatPeriodLong,
  formatPeriodShort,
} from "@/lib/money"
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  CreditCard,
  Search,
  ShieldAlert,
  Unlock,
} from "lucide-react"

export type BillingStatusFilter = "ALL" | "paid" | "unpaid" | "overdue" | "suspended"

interface PeriodRestaurantsTableProps {
  selectedPeriod: string
  currentPeriod: string
  collectionEndDay: number
  allCount: number
  paidCount: number
  unpaidCount: number
  overdueCount: number
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
  onOpenNewPayment: (restaurant: Restaurant, period?: string) => void
  onOpenHistory: (restaurant: Restaurant) => void
  onSuspendUnpaid: (restaurant: Restaurant) => void
  onUnsuspendAccess: (restaurant: Restaurant) => void
  onBulkSuspendUnpaid: () => void
}

export function RecordPaymentModal({
  selectedPeriod,
  currentPeriod,
  collectionEndDay,
  allCount,
  paidCount,
  unpaidCount,
  overdueCount,
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
  onOpenNewPayment,
  onOpenHistory,
  onSuspendUnpaid,
  onUnsuspendAccess,
  onBulkSuspendUnpaid,
}: PeriodRestaurantsTableProps) {
  const selectedLabel = formatPeriodLong(selectedPeriod)

  const filterTabs: { id: BillingStatusFilter; label: string }[] = [
    { id: "ALL", label: `Tümü (${allCount})` },
    { id: "paid", label: `${formatPeriodShort(selectedPeriod)} Ödendi (${paidCount})` },
    {
      id: "unpaid",
      label: `${formatPeriodShort(selectedPeriod)} Bekleyen (${unpaidCount})`,
    },
    { id: "overdue", label: `Geçmiş Borçlu (${overdueCount})` },
    { id: "suspended", label: `Erişimi Askıda (${suspendedCount})` },
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
              <th className="px-4 py-3">Aylık Ücret (₺)</th>
              <th className="px-4 py-3">{selectedLabel} Durumu</th>
              <th className="px-4 py-3">Kapsam &amp; Geriye Dönük Bakiye</th>
              <th className="px-4 py-3 text-right">Tahsilat &amp; Erişim İşlemleri</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {filteredRestaurants.map((r) => {
              const isSusp = Boolean(
                r.isAccessSuspended || r.billingStatus === "suspended"
              )
              const isBusy = busyRestId === r.id
              const periodCell = evaluateRestaurantPeriod(
                r,
                selectedPeriod,
                currentPeriod,
                collectionEndDay
              )
              const overduePeriods = r.overduePeriods ?? []
              const hasPrepaidFuture = (r.prepaidFuturePeriods?.length ?? 0) > 0

              const preferredTargetPeriod =
                periodCell.state === "overdue" ||
                periodCell.state === "pending" ||
                periodCell.state === "future"
                  ? selectedPeriod
                  : undefined

              return (
                <tr
                  key={r.id}
                  className={`transition-colors ${
                    isSusp ? "bg-red-50/40" : "hover:bg-[#f9f9fb]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/dashboard/restaurants/${r.id}`}
                        className="font-semibold text-[#1d1d1f] hover:text-[#e63462]"
                      >
                        {r.name}
                      </Link>
                      {r.brandName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#e63462]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#e63462]">
                          <Building2 className="h-2.5 w-2.5" />
                          {r.brandName}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#86868b] block">
                      Başlangıç: {formatPeriodLong(r.billingStartPeriod)} •{" "}
                      {r.branchType === "franchise"
                        ? "Franchise"
                        : r.branchType === "company_owned"
                          ? "Merkez Şube"
                          : "Bağımsız"}
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
                        className="h-8 w-24 rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 text-[12px] font-semibold text-[#1d1d1f] outline-none focus:border-[#e63462] tabular-nums"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onSaveMonthlyFee(r)}
                        className="h-8 rounded-lg border border-[#d1d1d6] bg-white px-2.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {(periodCell.state === "paid" || periodCell.state === "prepaid") && (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {periodCell.state === "prepaid"
                              ? "Peşin Ödendi"
                              : "Ödendi"}
                          </span>
                          {periodCell.payment && (
                            <span className="text-[11px] text-[#636366]">
                              Tarih: {formatIstanbulDate(periodCell.payment.paidAt)} •{" "}
                              {PAYMENT_METHOD_LABELS[periodCell.payment.paymentMethod] ??
                                "Havale / EFT"}
                            </span>
                          )}
                        </>
                      )}

                      {periodCell.state === "overdue" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Ödeme Gecikti ({formatPeriodShort(selectedPeriod)})
                        </span>
                      )}

                      {periodCell.state === "pending" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          <Clock className="h-3.5 w-3.5" />
                          Tahsilat Bekliyor ({formatPeriodShort(selectedPeriod)})
                        </span>
                      )}

                      {periodCell.state === "future" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-medium text-[#636366]">
                          <Clock className="h-3.5 w-3.5" />
                          Gelecek Dönem (Henüz Ödenmedi)
                        </span>
                      )}

                      {(periodCell.state === "before_start" ||
                        periodCell.state === "exempt") && (
                        <span className="inline-flex items-center rounded-md bg-[#f5f5f7] px-2.5 py-1 text-[11px] text-[#86868b]">
                          {periodCell.state === "exempt"
                            ? "Ücretsiz / Pasif"
                            : "Abonelik Öncesi"}
                        </span>
                      )}

                      {isSusp && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          <Ban className="h-3 w-3" />
                          Sistem Erişimi Durduruldu
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[12px]">
                    {overduePeriods.length > 0 ? (
                      <div className="text-red-700">
                        <p className="font-semibold">
                          {overduePeriods.length} Geçmiş Dönem Ödenmedi
                        </p>
                        <p className="text-[11px] text-red-600">
                          {overduePeriods.map(formatPeriodShort).join(", ")}
                        </p>
                      </div>
                    ) : r.paidThroughPeriod && r.paidThroughPeriod >= currentPeriod ? (
                      <div>
                        <p className="font-semibold text-emerald-700">
                          {formatPeriodLong(r.paidThroughPeriod)} sonuna kadar ödendi
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          {hasPrepaidFuture
                            ? `+${r.prepaidFuturePeriods?.length} ileri ay peşin kapandı`
                            : `Son tahsilat: ${formatIstanbulDate(r.lastPaymentDate)}`}
                        </p>
                      </div>
                    ) : r.lastPaymentDate ? (
                      <div>
                        <p className="font-medium text-[#1d1d1f]">
                          Son Ödenen: {formatPeriodLong(r.paidThroughPeriod)}
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          Son tahsilat: {formatIstanbulDate(r.lastPaymentDate)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#86868b]">
                        Henüz tahsilat kaydı yok
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenNewPayment(r, preferredTargetPeriod)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#34c759] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Tahsilat Al
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenHistory(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:opacity-50"
                        title="Ay-Ay Çizelge & Geçmiş Tahsilatlar"
                      >
                        <CalendarRange className="h-3.5 w-3.5 text-[#e63462]" />
                        Dönemler ({r.paymentHistory?.length ?? 0})
                      </button>

                      {isSusp ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onUnsuspendAccess(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Erişimi Aç
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onSuspendUnpaid(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Durdur
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredRestaurants.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[13px] text-[#86868b]">
                  Seçilen filtreye uygun mekan bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
