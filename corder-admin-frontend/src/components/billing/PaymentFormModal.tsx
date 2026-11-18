import { useEffect, useState } from "react"
import type {
  Restaurant,
  RestaurantPaymentRecord,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import {
  PAYMENT_METHOD_LABELS,
  formatMoney,
  formatPeriodLong,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/money"
import { AlertCircle, CreditCard, RotateCcw, X } from "lucide-react"
import { usePaymentFormState } from "./use-payment-form"
import { PeriodPackageSelector } from "./PeriodPackageSelector"

interface PaymentFormModalProps {
  restaurant: Restaurant | null
  initialPeriod?: string | null
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
  const form = usePaymentFormState({ restaurant, initialPeriod, editingPayment })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setError("")
  }, [restaurant, editingPayment])

  useEffect(() => {
    if (!restaurant) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [restaurant, onClose])

  if (!restaurant) return null

  const overdueList = restaurant.overduePeriods ?? []
  const isSuspended = Boolean(
    restaurant.isAccessSuspended || restaurant.billingStatus === "suspended"
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (form.selectedPeriods.length === 0) {
      setError("Lütfen en az bir abonelik dönemi (ay) seçin.")
      return
    }
    if (form.overlappingPeriods.length > 0) {
      setError(
        `${form.overlappingPeriods.map(formatPeriodLong).join(", ")} dönemi için zaten ödeme kaydı mevcut.`
      )
      return
    }
    if (!form.paidAtDate) {
      setError("Lütfen ödemenin alındığı tahsilat tarihini seçin.")
      return
    }

    const cleanAmount = Math.max(0, fromMinorUnits(toMinorUnits(form.amountInput)))
    setSubmitting(true)
    try {
      if (editingPayment && onSubmitEdit) {
        await onSubmitEdit(restaurant, editingPayment.id, {
          amount: cleanAmount,
          periods: form.selectedPeriods,
          paidAt: form.paidAtDate,
          paymentMethod: form.paymentMethod,
          note: form.note.trim() || null,
        })
      } else {
        await onSubmitNew(restaurant, {
          amount: cleanAmount,
          periods: form.selectedPeriods,
          paidAt: form.paidAtDate,
          paymentMethod: form.paymentMethod,
          note: form.note.trim() || null,
          reopenAccess: form.reopenAccess,
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
                  form.selectPreset("custom")
                  form.setCustomPeriods([...(restaurant.duePeriods ?? overdueList)])
                }}
                className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
              >
                Tüm Açık Ayları Seç ({restaurant.duePeriods?.length})
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <PeriodPackageSelector
            preset={form.preset}
            onSelectPreset={form.selectPreset}
            startPeriod={form.startPeriod}
            onStartPeriodChange={form.setStartPeriod}
            defaultStartPeriod={form.defaultStartPeriod}
            paidAtDate={form.paidAtDate}
            onPaidAtDateChange={form.setPaidAtDate}
            customPeriods={form.customPeriods}
            customPickerRange={form.customPickerRange}
            alreadyPaidSet={form.alreadyPaidSet}
            overdueList={overdueList}
            onToggleCustomPeriod={form.toggleCustomPeriod}
            selectedPeriods={form.selectedPeriods}
            overlappingPeriods={form.overlappingPeriods}
            inputCls={inputCls}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[12px] font-medium text-[#1d1d1f]">
                  Toplam Tahsilat Tutarı (₺) *
                </label>
                {form.isAmountManuallyEdited &&
                  toMinorUnits(form.amountInput) !== toMinorUnits(form.standardTotal) && (
                    <button
                      type="button"
                      onClick={() => {
                        form.setIsAmountManuallyEdited(false)
                        form.setAmountInput(String(form.standardTotal))
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#e63462] hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Standart ({formatMoney(form.standardTotal)})
                    </button>
                  )}
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amountInput}
                onChange={(e) => {
                  form.setIsAmountManuallyEdited(true)
                  form.setAmountInput(e.target.value)
                }}
                className={`${inputCls} font-semibold`}
                required
              />
              {form.selectedPeriods.length > 1 && (
                <p className="mt-1 text-[11px] text-[#86868b]">
                  Aylık ortalama:{" "}
                  <span className="font-semibold text-[#1d1d1f]">
                    {formatMoney(
                      fromMinorUnits(
                        Math.round(
                          toMinorUnits(form.amountInput) / form.selectedPeriods.length
                        )
                      )
                    )}{" "}
                    / ay
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
                Ödeme Yöntemi *
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  form.setPaymentMethod(e.target.value as SubscriptionPaymentMethod)
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

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Dekont No / Tahsilat Açıklaması
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => form.setNote(e.target.value)}
              placeholder="Örn: Yapı Kredi EFT dekontu onaylandı / 3 aylık peşin anlaşma"
              className={inputCls}
            />
          </div>

          {!editingPayment && isSuspended && (
            <label className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.reopenAccess}
                onChange={(e) => form.setReopenAccess(e.target.checked)}
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
              disabled={submitting || form.overlappingPeriods.length > 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#34c759] px-5 text-[13px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              {submitting
                ? "Kaydediliyor…"
                : editingPayment
                  ? "Değişiklikleri Kaydet"
                  : `Tahsilatı Kaydet (${form.selectedPeriods.length} Ay)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
