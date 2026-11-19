import { Link } from "react-router-dom"
import type { Restaurant } from "@/lib/types"
import {
  TURKISH_MONTHS_SHORT,
  evaluateRestaurantPeriod,
  formatIstanbulDate,
  formatIstanbulShortDayMonth,
  formatMoney,
  formatPeriodLong,
} from "@/lib/money"
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Search,
} from "lucide-react"

interface BillingMatrixViewProps {
  restaurants: Restaurant[]
  selectedYear: number
  onYearChange: (year: number) => void
  currentPeriod: string
  collectionEndDay: number
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onOpenNewPayment: (restaurant: Restaurant, period?: string) => void
  onOpenHistory: (restaurant: Restaurant) => void
}

export function BillingMatrixView({
  restaurants,
  selectedYear,
  onYearChange,
  currentPeriod,
  collectionEndDay,
  searchQuery,
  onSearchQueryChange,
  onOpenNewPayment,
  onOpenHistory,
}: BillingMatrixViewProps) {
  const filtered = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.brandName ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white overflow-hidden">
      <div className="p-4 border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] p-1">
            <button
              type="button"
              onClick={() => onYearChange(selectedYear - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#1d1d1f] shadow-2xs hover:bg-[#ebebf0]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-[13px] font-semibold text-[#1d1d1f] tabular-nums">
              {selectedYear} Yılı Ay-Ay Takvim Matrisi
            </span>
            <button
              type="button"
              onClick={() => onYearChange(selectedYear + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#1d1d1f] shadow-2xs hover:bg-[#ebebf0]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#636366]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Ödendi (Tarihli)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Peşin İleri Dönem
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Bu Ay Bekliyor
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Geçmiş Ödenmedi
            </span>
          </div>
        </div>

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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[11px] font-semibold text-[#86868b]">
              <th className="sticky left-0 z-10 bg-[#fafafa] px-4 py-3 min-w-[180px]">
                Mekan &amp; Aylık Ücret
              </th>
              {TURKISH_MONTHS_SHORT.map((mLabel, idx) => {
                const per = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`
                const isCur = per === currentPeriod
                return (
                  <th
                    key={per}
                    className={`px-1.5 py-3 text-center min-w-[62px] ${
                      isCur ? "bg-[#fef3f5] text-[#e63462]" : ""
                    }`}
                  >
                    {mLabel}
                  </th>
                )
              })}
              <th className="px-3 py-3 text-right min-w-[110px]">Toplam Tahsilat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {filtered.map((r) => {
              const isSusp = Boolean(
                r.isAccessSuspended || r.billingStatus === "suspended"
              )
              return (
                <tr key={r.id} className="hover:bg-[#f9f9fb]">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-[#f0f0f0]">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/dashboard/restaurants/${r.id}`}
                        className="font-semibold text-[#1d1d1f] hover:text-[#e63462] truncate"
                      >
                        {r.name}
                      </Link>
                      {isSusp && (
                        <span title="Erişim Durduruldu">
                          <Ban className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#86868b] tabular-nums">
                      {formatMoney(r.monthlyFee ?? 0)} / ay
                    </span>
                  </td>

                  {TURKISH_MONTHS_SHORT.map((_, idx) => {
                    const period = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`
                    const cell = evaluateRestaurantPeriod(
                      r,
                      period,
                      currentPeriod,
                      collectionEndDay
                    )
                    const isCur = period === currentPeriod

                    if (cell.state === "paid" || cell.state === "prepaid") {
                      return (
                        <td
                          key={period}
                          className={`p-1 text-center ${isCur ? "bg-[#fef3f5]/40" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenHistory(r)}
                            title={`${formatPeriodLong(period)} • Tahsilat Tarihi: ${formatIstanbulDate(cell.payment?.paidAt)} • Tutar: ${formatMoney(cell.payment?.amount ?? 0)}`}
                            className={`w-full rounded-lg py-1.5 px-1 flex flex-col items-center justify-center transition-colors ${
                              cell.state === "prepaid"
                                ? "bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-semibold tabular-nums leading-tight mt-0.5">
                              {formatIstanbulShortDayMonth(cell.payment?.paidAt) || "Ödendi"}
                            </span>
                          </button>
                        </td>
                      )
                    }

                    if (cell.state === "overdue") {
                      return (
                        <td
                          key={period}
                          className={`p-1 text-center ${isCur ? "bg-[#fef3f5]/40" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenNewPayment(r, period)}
                            title={`${formatPeriodLong(period)} ödenmedi! Tahsilat girmek için tıklayın.`}
                            className="w-full rounded-lg py-1.5 px-1 flex flex-col items-center justify-center bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-semibold leading-tight mt-0.5">
                              Gecikti
                            </span>
                          </button>
                        </td>
                      )
                    }

                    if (cell.state === "pending") {
                      return (
                        <td
                          key={period}
                          className={`p-1 text-center ${isCur ? "bg-[#fef3f5]/40" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenNewPayment(r, period)}
                            title={`${formatPeriodLong(period)} tahsilatı bekliyor. İşlemek için tıklayın.`}
                            className="w-full rounded-lg py-1.5 px-1 flex flex-col items-center justify-center bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-semibold leading-tight mt-0.5">
                              Bekliyor
                            </span>
                          </button>
                        </td>
                      )
                    }

                    if (cell.state === "future") {
                      return (
                        <td key={period} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => onOpenNewPayment(r, period)}
                            title={`${formatPeriodLong(period)} için peşin tahsilat işle`}
                            className="group w-full rounded-lg py-2 px-1 flex flex-col items-center justify-center border border-dashed border-[#e5e5ea] text-[#aeaeb2] hover:border-[#e63462]/50 hover:text-[#e63462] hover:bg-[#fef3f5]/40 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                            <span className="text-[9px] font-medium leading-tight mt-0.5">
                              Peşin
                            </span>
                          </button>
                        </td>
                      )
                    }

                    return (
                      <td key={period} className="p-1 text-center">
                        <div
                          title={
                            cell.state === "exempt"
                              ? "Pasif veya ücretsiz mekan"
                              : `Abonelik başlangıcı (${formatPeriodLong(r.billingStartPeriod)}) öncesi`
                          }
                          className="w-full rounded-lg py-2.5 text-center text-[11px] text-[#d1d1d6] select-none"
                        >
                          -
                        </div>
                      </td>
                    )
                  })}

                  <td className="px-3 py-2.5 text-right border-l border-[#f0f0f0]">
                    <button
                      type="button"
                      onClick={() => onOpenHistory(r)}
                      className="font-semibold text-emerald-700 hover:underline tabular-nums block ml-auto"
                    >
                      {formatMoney(r.totalCollectedAmount ?? 0)}
                    </button>
                    <span className="text-[10px] text-[#86868b]">
                      {r.paidPeriods?.length ?? 0} ay ödendi
                    </span>
                  </td>
                </tr>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="p-8 text-center text-[13px] text-[#86868b]">
                  Arama kriterine uygun mekan bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

