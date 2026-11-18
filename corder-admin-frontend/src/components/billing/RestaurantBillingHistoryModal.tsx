import { useEffect, useState } from "react"
import type { Restaurant, RestaurantPaymentRecord } from "@/lib/types"
import {
  PAYMENT_METHOD_LABELS,
  TURKISH_MONTHS_SHORT,
  evaluateRestaurantPeriod,
  formatIstanbulDate,
  formatMoney,
  formatPeriodLong,
  formatPeriodsSummary,
  getIstanbulBillingPeriod,
} from "@/lib/money"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react"

interface RestaurantBillingHistoryModalProps {
  restaurant: Restaurant | null
  collectionEndDay?: number
  onClose: () => void
  onOpenNewPayment: (restaurant: Restaurant, period?: string) => void
  onEditPayment: (restaurant: Restaurant, payment: RestaurantPaymentRecord) => void
  onDeletePayment: (restaurant: Restaurant, payment: RestaurantPaymentRecord) => Promise<void>
}

export function RestaurantBillingHistoryModal({
  restaurant,
  collectionEndDay = 30,
  onClose,
  onOpenNewPayment,
  onEditPayment,
  onDeletePayment,
}: RestaurantBillingHistoryModalProps) {
  const currentPeriod = getIstanbulBillingPeriod()
  const currentYear = Number(currentPeriod.split("-")[0]) || new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedYear(currentYear)
  }, [restaurant?.id, currentYear])

  useEffect(() => {
    if (!restaurant) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [restaurant, onClose])

  if (!restaurant) return null

  const history = restaurant.paymentHistory ?? []

  const handleDelete = async (payment: RestaurantPaymentRecord) => {
    if (
      !confirm(
        `${formatPeriodsSummary(payment.periods, payment.period)} (${formatMoney(payment.amount)}) tahsilat kaydını silmek istediğinize emin misiniz? Bu işlem ilgili dönem(ler)i tekrar ödenmemiş durumuna döndürür.`
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f0] pb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
              {restaurant.name} — Dönem Çizelgesi &amp; Tahsilat Geçmişi
            </h3>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              Abonelik Başlangıcı:{" "}
              <span className="font-semibold text-[#1d1d1f]">
                {formatPeriodLong(restaurant.billingStartPeriod)}
              </span>{" "}
              • Aylık Ücret:{" "}
              <span className="font-semibold text-[#1d1d1f]">
                {formatMoney(restaurant.monthlyFee ?? 0)}
              </span>{" "}
              • Toplam Tahsilat:{" "}
              <span className="font-semibold text-emerald-700">
                {formatMoney(restaurant.totalCollectedAmount ?? 0)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenNewPayment(restaurant)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#34c759] px-3 text-[12px] font-semibold text-white hover:bg-[#2db84e]"
            >
              <Plus className="h-3.5 w-3.5" />
              Yeni Tahsilat İşle
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 12-Month Retroactive & Future Calendar Strip for this Venue */}
        <div className="mt-4 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-semibold text-[#1d1d1f]">
              {selectedYear} Yılı Ay-Ay Abonelik Durumu
            </span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5ea] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#636366] hover:bg-[#f5f5f7]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-[12px] font-semibold tabular-nums text-[#1d1d1f]">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#636366] hover:bg-[#f5f5f7]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {TURKISH_MONTHS_SHORT.map((monthLabel, idx) => {
              const period = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`
              const cell = evaluateRestaurantPeriod(
                restaurant,
                period,
                currentPeriod,
                collectionEndDay
              )
              const isCurrent = period === currentPeriod

              if (cell.state === "paid" || cell.state === "prepaid") {
                return (
                  <div
                    key={period}
                    title={`${formatPeriodLong(period)}: ${formatIstanbulDate(cell.payment?.paidAt)} tarihinde ödendi`}
                    className={`rounded-xl border p-2 text-center ${
                      cell.state === "prepaid"
                        ? "border-teal-200 bg-teal-50/80 text-teal-800"
                        : "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                    } ${isCurrent ? "ring-2 ring-[#e63462]/30" : ""}`}
                  >
                    <p className="text-[11px] font-semibold">{monthLabel}</p>
                    <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      {cell.state === "prepaid" ? "Peşin" : "Ödendi"}
                    </p>
                    <p className="text-[10px] opacity-80 tabular-nums">
                      {formatIstanbulDate(cell.payment?.paidAt)}
                    </p>
                  </div>
                )
              }

              if (cell.state === "overdue") {
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenNewPayment(restaurant, period)
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 p-2 text-center text-red-700 hover:bg-red-100 transition-colors"
                  >
                    <p className="text-[11px] font-semibold">{monthLabel}</p>
                    <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold">
                      <AlertCircle className="h-3 w-3" /> Gecikti
                    </p>
                    <p className="text-[10px] underline">Tahsil Et</p>
                  </button>
                )
              }

              if (cell.state === "pending") {
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenNewPayment(restaurant, period)
                    }}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-amber-800 hover:bg-amber-100 transition-colors ring-2 ring-[#e63462]/30"
                  >
                    <p className="text-[11px] font-semibold">{monthLabel}</p>
                    <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold">
                      <Clock className="h-3 w-3" /> Bekliyor
                    </p>
                    <p className="text-[10px] underline">Tahsil Et</p>
                  </button>
                )
              }

              if (cell.state === "future") {
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenNewPayment(restaurant, period)
                    }}
                    className="rounded-xl border border-[#e5e5ea] bg-white p-2 text-center text-[#636366] hover:border-[#d1d1d6] transition-colors"
                  >
                    <p className="text-[11px] font-semibold text-[#1d1d1f]">{monthLabel}</p>
                    <p className="mt-0.5 text-[10px] text-[#86868b]">Açık</p>
                    <p className="text-[10px] text-[#e63462]">Peşin İşle</p>
                  </button>
                )
              }

              return (
                <div
                  key={period}
                  className="rounded-xl border border-[#ececf0] bg-[#f4f4f6] p-2 text-center text-[#aeaeb2]"
                >
                  <p className="text-[11px] font-medium">{monthLabel}</p>
                  <p className="mt-0.5 text-[10px]">
                    {cell.state === "exempt" ? "Muaf" : "—"}
                  </p>
                  <p className="text-[10px]">Kaydı Yok</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Records Ledger for this Venue */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <ReceiptText className="h-4 w-4 text-[#e63462]" />
              <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
                Alınan Tahsilat Kayıtları ({history.length})
              </h4>
            </div>
            <span className="text-[11px] text-[#86868b]">
              Tahsilat tarihine göre yeniden eskiye sıralı
            </span>
          </div>

          {history.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] py-8 text-center text-[13px] text-[#86868b]">
              Bu mekan için henüz işlenmiş bir tahsilat kaydı bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0] rounded-xl border border-[#e5e5ea] bg-white overflow-hidden">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#f9f9fb]"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#1d1d1f]">
                        {formatPeriodsSummary(item.periods, item.period)}
                      </span>
                      <span className="rounded-md bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-medium text-[#636366]">
                        {PAYMENT_METHOD_LABELS[item.paymentMethod] ?? "Havale / EFT"}
                      </span>
                      {(item.periods?.length ?? 1) > 1 && (
                        <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                          Çoklu Ay ({item.periods.length} Dönem)
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#86868b]">
                      Tahsilat Tarihi:{" "}
                      <span className="font-medium text-[#1d1d1f]">
                        {formatIstanbulDate(item.paidAt)}
                      </span>
                      {item.recordedBy ? ` • Kaydeden: ${item.recordedBy}` : ""}
                    </p>
                    {item.note && (
                      <p className="text-[12px] text-[#636366] bg-[#f5f5f7] rounded-lg px-2.5 py-1 inline-block">
                        {item.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[14px] font-bold text-emerald-700 tabular-nums mr-1">
                      {formatMoney(item.amount, true)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onEditPayment(restaurant, item)
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5ea] bg-white text-[#636366] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                      title="Tahsilatı Düzenle"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      title="Tahsilat Kaydını Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

