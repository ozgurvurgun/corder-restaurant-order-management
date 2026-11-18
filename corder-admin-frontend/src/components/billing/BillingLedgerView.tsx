import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import type {
  Restaurant,
  RestaurantPaymentRecord,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import {
  PAYMENT_METHOD_LABELS,
  formatIstanbulDate,
  formatMoney,
  formatPeriodShort,
  formatPeriodsSummary,
  sumMoneyMajor,
} from "@/lib/money"
import { Pencil, ReceiptText, Search, Trash2 } from "lucide-react"
import { CustomSelect } from "@/components/ui/custom-inputs"

interface BillingLedgerViewProps {
  restaurants: Restaurant[]
  onEditPayment: (restaurant: Restaurant, payment: RestaurantPaymentRecord) => void
  onDeletePayment: (
    restaurant: Restaurant,
    payment: RestaurantPaymentRecord
  ) => Promise<void>
}

interface FlattenedLedgerEntry {
  restaurant: Restaurant
  payment: RestaurantPaymentRecord
  paidYear: string
}

export function BillingLedgerView({
  restaurants,
  onEditPayment,
  onDeletePayment,
}: BillingLedgerViewProps) {
  const [yearFilter, setYearFilter] = useState<string>("ALL")
  const [methodFilter, setMethodFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const allEntries = useMemo<FlattenedLedgerEntry[]>(() => {
    const rows: FlattenedLedgerEntry[] = []
    for (const r of restaurants) {
      for (const p of r.paymentHistory ?? []) {
        const d = new Date(p.paidAt)
        const y = Number.isNaN(d.getTime())
          ? String(new Date().getFullYear())
          : String(d.getFullYear())
        rows.push({ restaurant: r, payment: p, paidYear: y })
      }
    }
    rows.sort(
      (a, b) =>
        new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime()
    )
    return rows
  }, [restaurants])

  const availableYears = useMemo(() => {
    const set = new Set<string>()
    for (const row of allEntries) set.add(row.paidYear)
    return Array.from(set).sort().reverse()
  }, [allEntries])

  const filtered = useMemo(() => {
    return allEntries.filter((row) => {
      if (yearFilter !== "ALL" && row.paidYear !== yearFilter) return false
      if (methodFilter !== "ALL" && row.payment.paymentMethod !== methodFilter)
        return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchRest =
          row.restaurant.name.toLowerCase().includes(q) ||
          (row.restaurant.brandName ?? "").toLowerCase().includes(q)
        const matchNote = (row.payment.note ?? "").toLowerCase().includes(q)
        const matchPeriod = (row.payment.periods ?? []).some((p) =>
          p.toLowerCase().includes(q)
        )
        return matchRest || matchNote || matchPeriod
      }
      return true
    })
  }, [allEntries, yearFilter, methodFilter, searchQuery])

  const filteredSum = useMemo(
    () => sumMoneyMajor(filtered.map((x) => x.payment.amount)),
    [filtered]
  )

  const handleDelete = async (
    restaurant: Restaurant,
    payment: RestaurantPaymentRecord
  ) => {
    if (
      !confirm(
        `${restaurant.name} — ${formatPeriodsSummary(payment.periods, payment.period)} (${formatMoney(payment.amount)}) tahsilat kaydını silmek istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setDeletingId(payment.id)
    try {
      await onDeletePayment(restaurant, payment)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white overflow-hidden">
      <div className="p-4 border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptText className="h-4 w-4 text-[#e63462]" />
          <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
            Tarih Bazlı Tahsilat Defteri ({filtered.length} işlem)
          </h3>
          <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 tabular-nums">
            Toplam: {formatMoney(filteredSum, true)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomSelect
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] font-medium text-[#1d1d1f]"
          >
            <option value="ALL">Tüm Yıllar</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y} Yılı Tahsilatları
              </option>
            ))}
          </CustomSelect>

          <CustomSelect
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] font-medium text-[#1d1d1f]"
          >
            <option value="ALL">Tüm Yöntemler</option>
            {(
              Object.entries(PAYMENT_METHOD_LABELS) as Array<
                [SubscriptionPaymentMethod, string]
              >
            ).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </CustomSelect>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mekan, dönem veya not ara..."
              className="h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] pl-8 pr-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-[#86868b]">
          Seçilen kriterlere uygun tahsilat kaydı bulunmuyor.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                <th className="px-4 py-3">Tahsilat Tarihi</th>
                <th className="px-4 py-3">Mekan / Şube</th>
                <th className="px-4 py-3">Kapsanan Dönem(ler)</th>
                <th className="px-4 py-3">Yöntem</th>
                <th className="px-4 py-3">Tutar</th>
                <th className="px-4 py-3">Açıklama &amp; Kaydeden</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filtered.map(({ restaurant, payment }) => (
                <tr key={payment.id} className="hover:bg-[#f9f9fb]">
                  <td className="px-4 py-3 font-semibold text-[#1d1d1f] tabular-nums whitespace-nowrap">
                    {formatIstanbulDate(payment.paidAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/dashboard/restaurants/${restaurant.id}`}
                      className="font-semibold text-[#1d1d1f] hover:text-[#e63462]"
                    >
                      {restaurant.name}
                    </Link>
                    {restaurant.brandName && (
                      <span className="block text-[11px] text-[#86868b]">
                        {restaurant.brandName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#1d1d1f] block">
                      {formatPeriodsSummary(payment.periods, payment.period)}
                    </span>
                    {(payment.periods?.length ?? 0) > 1 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {payment.periods.map((per) => (
                          <span
                            key={per}
                            className="rounded-md bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                          >
                            {formatPeriodShort(per)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-[#f5f5f7] px-2 py-1 text-[11px] font-medium text-[#1d1d1f]">
                      {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? "Havale / EFT"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                    {formatMoney(payment.amount, true)}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#636366]">
                    {payment.note ? (
                      <p className="text-[#1d1d1f]">{payment.note}</p>
                    ) : (
                      <span className="text-[#aeaeb2]">—</span>
                    )}
                    {payment.recordedBy && (
                      <span className="block text-[11px] text-[#86868b]">
                        {payment.recordedBy}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEditPayment(restaurant, payment)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-white text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === payment.id}
                        onClick={() => void handleDelete(restaurant, payment)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

