import { useEffect, useRef, useState } from "react"
import { X, Percent, DollarSign, Gift, ShieldAlert, Loader2 } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import type { PanelDiscountType } from "@/lib/panel-types"
import { computeDiscountMinorUnits, formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { usePanelToast } from "./panel-toast"

interface DiscountModalProps {
  tableId: string
  total: number
  onClose: () => void
}

const PRESET_PERCENTS = [5, 10, 15, 20, 25, 50]
const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500]
const REASONS = [
  { id: "owner", label: "Patron İkramı" },
  { id: "complaint", label: "Müşteri Şikayeti" },
  { id: "mistake", label: "Sipariş Hatası" },
  { id: "campaign", label: "Kampanya" },
  { id: "loyalty", label: "Sadık Müşteri" },
  { id: "other", label: "Diğer" },
]

export default function DiscountModal({
  tableId,
  total,
  onClose,
}: DiscountModalProps) {
  const { tables, applyDiscount } = usePanelStore()
  const { hasPermission, limits, isBoss } = usePanelAuth()
  const { showToast } = usePanelToast()

  const canPercent = hasPermission("discount.apply_percent")
  const canAmount = hasPermission("discount.apply_amount")
  const canComplimentary = hasPermission("discount.complimentary")

  const initialType: PanelDiscountType = canPercent
    ? "percent"
    : canAmount
      ? "amount"
      : "complimentary"

  const [discountType, setDiscountType] =
    useState<PanelDiscountType>(initialType)
  const [value, setValue] = useState<number>(0)
  const [customValue, setCustomValue] = useState("")
  const [selectedReason, setSelectedReason] = useState("owner")
  const [customReason, setCustomReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const table = tables.find((t) => t.id === tableId)

  const maxPct = isBoss ? 100 : limits.maxDiscountPercent
  const maxAmt = isBoss ? null : limits.maxDiscountAmount

  const isExceedingLimit =
    !isBoss &&
    ((discountType === "percent" && value > maxPct) ||
      (discountType === "amount" && maxAmt != null && value > maxAmt) ||
      (discountType === "complimentary" && !canComplimentary))

  const rawMinorUnits = toMinorUnits(total)
  const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, {
    type: discountType,
    value: discountType === "complimentary" ? 100 : value,
  })
  const calculatedDiscount = fromMinorUnits(discountMinorUnits)
  const finalTotal = fromMinorUnits(Math.max(0, rawMinorUnits - discountMinorUnits))

  const reasonText =
    selectedReason === "other"
      ? customReason.trim()
      : REASONS.find((r) => r.id === selectedReason)?.label || ""

  const isInvalidInput =
    isExceedingLimit ||
    !reasonText ||
    (discountType !== "complimentary" && (!Number.isFinite(value) || value <= 0)) ||
    (discountType === "percent" && value > 100)

  const handleApply = async () => {
    if (isSubmitting || submittingRef.current) return
    if (isExceedingLimit) {
      showToast("Girilen indirim yetki limitinizi aşıyor!", "error")
      return
    }
    if (!reasonText) {
      showToast("Lütfen geçerli bir indirim nedeni girin.", "error")
      return
    }
    if (discountType !== "complimentary" && (!Number.isFinite(value) || value <= 0)) {
      showToast("Lütfen geçerli bir indirim değeri girin.", "error")
      return
    }
    submittingRef.current = true
    setIsSubmitting(true)
    const discountValue = discountType === "complimentary" ? 100 : value

    try {
      const ok = await applyDiscount(tableId, {
        type: discountType,
        value: discountValue,
        reason: reasonText,
      })
      if (!ok) return

      const discountText =
        discountType === "percent"
          ? `%${value}`
          : discountType === "complimentary"
            ? "Tam İkram"
            : `${formatCurrency(value)} TL`

      showToast(
        `${table?.name}: ${discountText} indirim uygulandı. Yeni toplam: ${formatCurrency(finalTotal)} TL`,
        "success",
      )
      onClose()
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handlePresetClick = (preset: number) => {
    setValue(preset)
    setCustomValue("")
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "") {
      setCustomValue("")
      setValue(0)
      return
    }
    const parsed = parseFloat(val)
    if (!Number.isFinite(parsed) || parsed < 0) return
    setCustomValue(val)
    setValue(parsed)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              İndirim / İkram - {table?.name}
            </h2>
            <p className="text-[11px] text-[#86868b]">
              Yetki Limitiniz: Maks %{maxPct}
              {maxAmt != null ? ` • Maks ${maxAmt} TL` : " • Tutar Limitsiz"}
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex gap-2">
            {[
              { type: "percent" as const, icon: Percent, label: "Yüzde", allowed: canPercent },
              { type: "amount" as const, icon: DollarSign, label: "Tutar", allowed: canAmount },
              { type: "complimentary" as const, icon: Gift, label: "Tam İkram", allowed: canComplimentary },
            ].map(({ type, icon: Icon, label, allowed }) => (
              <button
                key={type}
                type="button"
                disabled={!allowed || isSubmitting}
                onClick={() => {
                  setDiscountType(type)
                  setValue(0)
                  setCustomValue("")
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-medium transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                  discountType === type
                    ? "bg-[#e63462] text-white"
                    : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {discountType !== "complimentary" && (
            <div className="space-y-3">
              <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wide">
                {discountType === "percent"
                  ? `İndirim Oranı (Maks %${maxPct})`
                  : `İndirim Tutarı ${maxAmt != null ? `(Maks ${maxAmt} TL)` : ""}`}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(discountType === "percent" ? PRESET_PERCENTS : PRESET_AMOUNTS).map((preset) => {
                  const disabledPreset =
                    !isBoss &&
                    ((discountType === "percent" && preset > maxPct) ||
                      (discountType === "amount" && maxAmt != null && preset > maxAmt))
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={disabledPreset || isSubmitting}
                      onClick={() => handlePresetClick(preset)}
                      className={`py-2.5 rounded-lg text-[15px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        value === preset && !customValue
                          ? "bg-[#e63462] text-white"
                          : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                      }`}
                    >
                      {discountType === "percent" ? `%${preset}` : `${preset} TL`}
                    </button>
                  )
                })}
              </div>
              <input
                type="number"
                min={0}
                max={discountType === "percent" ? 100 : undefined}
                disabled={isSubmitting}
                value={customValue}
                onChange={handleCustomChange}
                placeholder="Özel tutar girin..."
                className="w-full h-[44px] px-4 text-[15px] bg-[#f5f5f7] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#e63462]/50 text-[#1d1d1f]"
              />
              {isExceedingLimit && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Bu indirim oranı/tutarı tanımlanan yetki limitinizi aşıyor.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wide">
              İndirim Nedeni
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((reason) => (
                <button
                  key={reason.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedReason(reason.id)}
                  className={`py-2.5 px-3 rounded-lg text-[14px] font-medium transition-all text-left ${
                    selectedReason === reason.id
                      ? "bg-[#e63462] text-white"
                      : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
            {selectedReason === "other" && (
              <input
                type="text"
                disabled={isSubmitting}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Neden yazın..."
                className="w-full h-[44px] px-4 text-[15px] bg-[#f5f5f7] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#e63462]/50 text-[#1d1d1f]"
              />
            )}
          </div>

          <div className="bg-[#f5f5f7] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-[14px]">
              <span className="text-[#86868b]">Mevcut Toplam</span>
              <span className="text-[#1d1d1f] font-medium">{formatCurrency(total)} TL</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-[#86868b]">İndirim</span>
              <span className="text-[#e63462] font-medium">-{formatCurrency(calculatedDiscount)} TL</span>
            </div>
            <div className="border-t border-[#d1d1d6] pt-2 flex justify-between text-[17px]">
              <span className="font-semibold text-[#1d1d1f]">Yeni Toplam</span>
              <span className="font-bold text-[#34c759]">{formatCurrency(finalTotal)} TL</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[#e5e5ea]">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={isSubmitting || isInvalidInput}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#e63462] text-white hover:bg-[#d42d58] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "İndirimi Uygula"}
          </button>
        </div>
      </div>
    </div>
  )
}
