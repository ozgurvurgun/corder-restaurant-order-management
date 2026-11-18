import { useEffect, useMemo, useState } from "react"
import type {
  Restaurant,
  RestaurantPaymentRecord,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import {
  PAYMENT_METHOD_LABELS,
  addMonthsToPeriod,
  buildConsecutivePeriods,
  enumeratePeriodsInclusive,
  formatMoney,
  formatPeriodLong,
  formatPeriodShort,
  fromMinorUnits,
  getIstanbulBillingPeriod,
  getIstanbulTodayIsoDate,
  isValidPeriod,
  toIsoDateInputValue,
  toMinorUnits,
} from "@/lib/money"
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  RotateCcw,
  X,
} from "lucide-react"

type PackagePreset = 1 | 3 | 6 | 12 | "custom"

interface PaymentFormModalProps {
  restaurant: Restaurant | null
  /** Optional pre-selected starting period when user clicks a specific unpaid month cell. */
  initialPeriod?: string | null
  /** Optional existing payment record when editing. */
  editingPayment?: RestaurantPaymentRecord | null
  onClose: () => void
  onSubmitNew: (
    restaurant: Restaurant,
    payload: {
      amount: number
      periods: string[]
      paidAt: string
      paymentMethod: SubscriptionPaymentMethod
      note: string | null
      reopenAccess: boolean
    }
  ) => Promise<void>
  onSubmitEdit?: (
    restaurant: Restaurant,
    paymentId: string,
    payload: {
      amount: number
      periods: string[]
      paidAt: string
      paymentMethod: SubscriptionPaymentMethod
      note: string | null
    }
  ) => Promise<void>
}

export function PaymentFormModal({
  restaurant,
  initialPeriod,
  editingPayment,
  onClose,
  onSubmitNew,
  onSubmitEdit,
}: PaymentFormModalProps) {
  const currentPeriod = getIstanbulBillingPeriod()

  const alreadyPaidSet = useMemo(() => {
    const set = new Set<string>()
    if (!restaurant?.paymentHistory) return set
    for (const p of restaurant.paymentHistory) {
      if (editingPayment && p.id === editingPayment.id) continue
      const list = Array.isArray(p.periods) && p.periods.length > 0 ? p.periods : [p.period]
      for (const per of list) {
        if (isValidPeriod(per)) set.add(per)
      }
    }
    return set
  }, [restaurant, editingPayment])

  const defaultStartPeriod = useMemo(() => {
    if (editingPayment) {
      return editingPayment.periodStart || editingPayment.periods?.[0] || currentPeriod
    }
    if (initialPeriod && isValidPeriod(initialPeriod) && !alreadyPaidSet.has(initialPeriod)) {
      return initialPeriod
    }
    if (restaurant?.nextUnpaidPeriod && isValidPeriod(restaurant.nextUnpaidPeriod)) {
      return restaurant.nextUnpaidPeriod
    }
    return currentPeriod
  }, [editingPayment, initialPeriod, alreadyPaidSet, restaurant, currentPeriod])

  const [preset, setPreset] = useState<PackagePreset>(1)
  const [startPeriod, setStartPeriod] = useState(defaultStartPeriod)
  const [customPeriods, setCustomPeriods] = useState<string[]>([defaultStartPeriod])
  const [paidAtDate, setPaidAtDate] = useState(getIstanbulTodayIsoDate)
  const [amountInput, setAmountInput] = useState("0")
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false)
  const [paymentMethod, setPaymentMethod] =
    useState<SubscriptionPaymentMethod>("bank_transfer")
  const [note, setNote] = useState("")
  const [reopenAccess, setReopenAccess] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!restaurant) return
    setError("")
    if (editingPayment) {
      const pList =
        Array.isArray(editingPayment.periods) && editingPayment.periods.length > 0
          ? [...editingPayment.periods].sort()
          : [editingPayment.period]
      let isConsecutive = true
      for (let i = 1; i < pList.length; i += 1) {
        if (addMonthsToPeriod(pList[i - 1], 1) !== pList[i]) {
          isConsecutive = false
          break
        }
      }
      if (
        isConsecutive &&
        (pList.length === 1 ||
          pList.length === 3 ||
          pList.length === 6 ||
          pList.length === 12)
      ) {
        setPreset(pList.length as 1 | 3 | 6 | 12)
        setStartPeriod(pList[0])
      } else {
        setPreset("custom")
        setStartPeriod(pList[0] ?? defaultStartPeriod)
      }
      setCustomPeriods(pList)
      setPaidAtDate(toIsoDateInputValue(editingPayment.paidAt))
      setAmountInput(String(editingPayment.amount))
      setIsAmountManuallyEdited(true)
      setPaymentMethod(editingPayment.paymentMethod || "bank_transfer")
      setNote(editingPayment.note ?? "")
      setReopenAccess(true)
    } else {
      setPreset(1)
      setStartPeriod(defaultStartPeriod)
      setCustomPeriods([defaultStartPeriod])
      setPaidAtDate(getIstanbulTodayIsoDate())
      setAmountInput(String(restaurant.monthlyFee ?? 0))
      setIsAmountManuallyEdited(false)
      setPaymentMethod("bank_transfer")
      setNote("")
      setReopenAccess(true)
    }
  }, [restaurant, editingPayment, defaultStartPeriod])

  useEffect(() => {
    if (!restaurant) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [restaurant, onClose])

  const selectedPeriods = useMemo(() => {
    if (preset === "custom") {
      return [...customPeriods].filter(isValidPeriod).sort()
    }
    return buildConsecutivePeriods(startPeriod, preset)
  }, [preset, startPeriod, customPeriods])

  const standardTotal = useMemo(() => {
    const fee = restaurant?.monthlyFee ?? 0
    return fromMinorUnits(toMinorUnits(fee) * selectedPeriods.length)
  }, [restaurant?.monthlyFee, selectedPeriods.length])

  useEffect(() => {
    if (!isAmountManuallyEdited) {
      setAmountInput(String(standardTotal))
    }
  }, [standardTotal, isAmountManuallyEdited])

  const overlappingPeriods = useMemo(
    () => selectedPeriods.filter((p) => alreadyPaidSet.has(p)),
    [selectedPeriods, alreadyPaidSet]
  )

  const customPickerRange = useMemo(() => {
    if (!restaurant) return []
    const earliestCandidate = isValidPeriod(restaurant.billingStartPeriod)
      ? restaurant.billingStartPeriod
      : addMonthsToPeriod(currentPeriod, -6)
    const minBound = addMonthsToPeriod(currentPeriod, -12)
    const gridStart = earliestCandidate < minBound ? minBound : earliestCandidate
    const gridEnd = addMonthsToPeriod(currentPeriod, 14)
    return enumeratePeriodsInclusive(gridStart, gridEnd)
  }, [restaurant, currentPeriod])

  if (!restaurant) return null

  const overdueList = restaurant.overduePeriods ?? []
  const isSuspended = Boolean(
    restaurant.isAccessSuspended || restaurant.billingStatus === "suspended"
  )

  const toggleCustomPeriod = (per: string) => {
    if (alreadyPaidSet.has(per)) return
    setCustomPeriods((prev) =>
      prev.includes(per) ? prev.filter((x) => x !== per) : [...prev, per].sort()
    )
  }

  const handleSelectPreset = (nextPreset: PackagePreset) => {
    setPreset(nextPreset)
    if (nextPreset === "custom") {
      const seed = selectedPeriods.filter((p) => !alreadyPaidSet.has(p))
      setCustomPeriods(seed.length > 0 ? seed : [defaultStartPeriod])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (selectedPeriods.length === 0) {
      setError("Lütfen en az bir abonelik dönemi (ay) seçin.")
      return
    }
    if (overlappingPeriods.length > 0) {
      setError(
        `${overlappingPeriods.map(formatPeriodLong).join(", ")} dönemi için zaten ödeme kaydı mevcut. Lütfen başlangıç dönemini değiştirin veya Özel Dönem Seçimi kullanın.`
      )
      return
    }
    if (!paidAtDate) {
      setError("Lütfen ödemenin alındığı tahsilat tarihini seçin.")
      return
    }

    const cleanAmount = Math.max(0, fromMinorUnits(toMinorUnits(amountInput)))
    setSubmitting(true)
    try {
      if (editingPayment && onSubmitEdit) {
        await onSubmitEdit(restaurant, editingPayment.id, {
          amount: cleanAmount,
          periods: selectedPeriods,
          paidAt: paidAtDate,
          paymentMethod,
          note: note.trim() || null,
        })
      } else {
        await onSubmitNew(restaurant, {
          amount: cleanAmount,
          periods: selectedPeriods,
          paidAt: paidAtDate,
          paymentMethod,
          note: note.trim() || null,
          reopenAccess,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tahsilat kaydedilemedi")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-all"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0f0f0] pb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
              {editingPayment ? "Tahsilat Kaydını Düzenle" : "Tahsilat Al & Dönem İşle"}
            </h3>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              <span className="font-semibold text-[#1d1d1f]">{restaurant.name}</span> • Aylık
              Birim Ücret:{" "}
              <span className="font-semibold text-[#1d1d1f]">
                {formatMoney(restaurant.monthlyFee ?? 0)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!editingPayment && overdueList.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-2.5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-[12px] text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Ödenmemiş geçmiş dönem bulundu ({overdueList.length} ay):
                </p>
                <p className="text-[11px] text-red-700 mt-0.5">
                  {overdueList.map(formatPeriodLong).join(", ")}
                </p>
              </div>
            </div>
            {(restaurant.duePeriods?.length ?? 0) > 1 && (
              <button
                type="button"
                onClick={() => {
                  setPreset("custom")
                  setCustomPeriods([...(restaurant.duePeriods ?? overdueList)])
                }}
                className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
              >
                Tüm Açık Ayları Seç ({restaurant.duePeriods?.length})
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Package / Duration Selector */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">
              1. Ödeme Kapsamı / Dönem Paketi Seçin
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(
                [
                  { id: 1, label: "1 Aylık" },
                  { id: 3, label: "3 Aylık" },
                  { id: 6, label: "6 Aylık" },
                  { id: 12, label: "12 Aylık" },
                  { id: "custom", label: "Özel Seçim" },
                ] as const
              ).map((opt) => {
                const active = preset === opt.id
                return (
                  <button
                    key={String(opt.id)}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`h-9 rounded-xl border text-[12px] font-semibold transition-all ${
                      active
                        ? "border-[#e63462] bg-[#e63462] text-white shadow-xs"
                        : "border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebf0]"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Starting Month or Custom Multi-Month Grid */}
          {preset !== "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Başlangıç Dönemi (Ay / Yıl) *
                </label>
                <input
                  type="month"
                  value={startPeriod}
                  onChange={(e) => {
                    if (e.target.value) setStartPeriod(e.target.value)
                  }}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                   Tahsilatın Alındığı Tarih *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={paidAtDate}
                    onChange={(e) => setPaidAtDate(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-medium text-[#1d1d1f]">
                    Kapsanacak Ayları Tek Tek Seçin ({customPeriods.length} ay seçili)
                  </label>
                  <span className="text-[11px] text-[#86868b]">
                    Yeşil aylar daha önce ödenmiştir
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-2.5 max-h-48 overflow-y-auto">
                  {customPickerRange.map((per) => {
                    const isPaidAlready = alreadyPaidSet.has(per)
                    const isSelected = customPeriods.includes(per)
                    const isOverdue = overdueList.includes(per)
                    return (
                      <button
                        key={per}
                        type="button"
                        disabled={isPaidAlready}
                        onClick={() => toggleCustomPeriod(per)}
                        className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${
                          isPaidAlready
                            ? "bg-emerald-50 text-emerald-600/70 border border-emerald-200/60 cursor-not-allowed"
                            : isSelected
                              ? "bg-[#e63462] text-white border border-[#e63462]"
                              : isOverdue
                                ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                : "bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:border-[#86868b]"
                        }`}
                      >
                        {isPaidAlready && <Check className="h-3 w-3 shrink-0" />}
                        <span>{formatPeriodShort(per)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                  Tahsilatın Alındığı Tarih *
                </label>
                <input
                  type="date"
                  value={paidAtDate}
                  onChange={(e) => setPaidAtDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>
          )}

          {/* Covered Periods Preview Strip */}
          <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#636366]">
                <Calendar className="h-3.5 w-3.5 text-[#e63462]" />
                Bu Ödemenin Kapsayacağı Dönemler ({selectedPeriods.length} Ay)
              </span>
              {overlappingPeriods.length > 0 && defaultStartPeriod !== startPeriod && (
                <button
                  type="button"
                  onClick={() => setStartPeriod(defaultStartPeriod)}
                  className="text-[11px] font-semibold text-[#e63462] hover:underline"
                >
                  İlk Açık Döneme Al ({formatPeriodShort(defaultStartPeriod)})
                </button>
              )}
            </div>
            {selectedPeriods.length === 0 ? (
              <p className="text-[12px] text-[#86868b]">Henüz dönem seçilmedi.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedPeriods.map((per) => {
                  const conflict = alreadyPaidSet.has(per)
                  return (
                    <span
                      key={per}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        conflict
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {conflict ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {formatPeriodLong(per)}
                      {conflict ? " (Zaten Ödendi)" : ""}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Amount & Payment Method */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[12px] font-medium text-[#1d1d1f]">
                  Toplam Tahsilat Tutarı (₺) *
                </label>
                {isAmountManuallyEdited &&
                  toMinorUnits(amountInput) !== toMinorUnits(standardTotal) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAmountManuallyEdited(false)
                        setAmountInput(String(standardTotal))
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#e63462] hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Standart ({formatMoney(standardTotal)})
                    </button>
                  )}
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountInput}
                onChange={(e) => {
                  setIsAmountManuallyEdited(true)
                  setAmountInput(e.target.value)
                }}
                className={`${inputCls} font-semibold`}
                required
              />
              {selectedPeriods.length > 1 && (
                <p className="mt-1 text-[11px] text-[#86868b]">
                  Aylık ortalama karşılığı:{" "}
                  <span className="font-semibold text-[#1d1d1f]">
                    {formatMoney(
                      fromMinorUnits(
                        Math.round(toMinorUnits(amountInput) / selectedPeriods.length)
                      )
                    )}{" "}
                    / ay
                  </span>{" "}
                  (Peşin indirim varsa toplam tutarı düzenleyebilirsiniz)
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Ödeme Yöntemi *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as SubscriptionPaymentMethod)
                }
                className={inputCls}
              >
                {(
                  Object.entries(PAYMENT_METHOD_LABELS) as Array<
                    [SubscriptionPaymentMethod, string]
                  >
                ).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Dekont No / Tahsilat Açıklaması
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn: Yapı Kredi EFT dekontu onaylandı / 3 aylık peşin anlaşma"
              className={inputCls}
            />
          </div>

          {/* Reopen Access Checkbox if currently suspended */}
          {!editingPayment && isSuspended && (
            <label className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reopenAccess}
                onChange={(e) => setReopenAccess(e.target.checked)}
                className="h-4 w-4 accent-[#34c759]"
              />
              <span className="text-[12px] font-medium text-emerald-900">
                Bu ödeme kaydedildiğinde mekanın askıdaki sistem erişimini otomatik aç
              </span>
            </label>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[#f0f0f0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#d1d1d6] bg-white px-4 text-[13px] font-medium text-[#636366] hover:bg-[#f5f5f7]"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting || overlappingPeriods.length > 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#34c759] px-5 text-[13px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              {submitting
                ? "Kaydediliyor…"
                : editingPayment
                  ? "Değişiklikleri Kaydet"
                  : `Tahsilatı Kaydet (${selectedPeriods.length} Ay)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

