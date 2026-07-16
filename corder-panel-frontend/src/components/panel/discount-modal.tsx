import { useState } from "react"
import { X, Percent, DollarSign, Gift } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"

interface DiscountModalProps {
  tableId: string
  total: number
  onClose: () => void
}

const PRESET_PERCENTS = [5, 10, 15, 20, 25, 50]
const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500]
const REASONS = [
  { id: "patron", label: "Patron Ikrami" },
  { id: "sikayet", label: "Musteri Sikayeti" },
  { id: "hata", label: "Siparis Hatasi" },
  { id: "kampanya", label: "Kampanya" },
  { id: "sadakat", label: "Sadik Musteri" },
  { id: "diger", label: "Diger" },
]

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

export default function DiscountModal({ tableId, total, onClose }: DiscountModalProps) {
  const { tables, applyDiscount } = usePanelStore()
  const { showToast } = usePanelToast()
  const [discountType, setDiscountType] = useState<"percent" | "amount" | "ikram">("percent")
  const [value, setValue] = useState<number>(0)
  const [customValue, setCustomValue] = useState("")
  const [selectedReason, setSelectedReason] = useState("patron")
  const [customReason, setCustomReason] = useState("")

  const table = tables.find((t) => t.id === tableId)

  const calculatedDiscount = discountType === "percent" 
    ? (total * value) / 100 
    : discountType === "ikram" 
    ? total 
    : value

  const finalTotal = Math.max(0, total - calculatedDiscount)

  const handleApply = () => {
    const reason = selectedReason === "diger" ? customReason : REASONS.find(r => r.id === selectedReason)?.label || ""
    const discountValue = discountType === "ikram" ? 100 : value
    
    applyDiscount(tableId, { type: discountType, value: discountValue, reason })
    
    const discountText = discountType === "percent" 
      ? `%${value}` 
      : discountType === "ikram" 
      ? "Tam Ikram" 
      : `${formatCurrency(value)} TL`
    
    showToast(`${table?.name}: ${discountText} indirim uygulandi. Yeni toplam: ${formatCurrency(finalTotal)} TL`, "success")
    onClose()
  }

  const handlePresetClick = (preset: number) => {
    setValue(preset)
    setCustomValue("")
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCustomValue(val)
    setValue(parseFloat(val) || 0)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
            Indirim/Ikram - {table?.name}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors">
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Discount Type Tabs */}
          <div className="flex gap-2">
            {[
              { type: "percent" as const, icon: Percent, label: "Yuzde" },
              { type: "amount" as const, icon: DollarSign, label: "Tutar" },
              { type: "ikram" as const, icon: Gift, label: "Tam Ikram" },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => { setDiscountType(type); setValue(0); setCustomValue("") }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
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

          {/* Value Selection */}
          {discountType !== "ikram" && (
            <div className="space-y-3">
              <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wide">
                {discountType === "percent" ? "Indirim Orani" : "Indirim Tutari"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(discountType === "percent" ? PRESET_PERCENTS : PRESET_AMOUNTS).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={`py-2.5 rounded-lg text-[15px] font-medium transition-all ${
                      value === preset && !customValue
                        ? "bg-[#e63462] text-white"
                        : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                    }`}
                  >
                    {discountType === "percent" ? `%${preset}` : `${preset} TL`}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={customValue}
                onChange={handleCustomChange}
                placeholder="Ozel tutar girin..."
                className="w-full h-[44px] px-4 text-[15px] bg-[#f5f5f7] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#e63462]/50 text-[#1d1d1f]"
              />
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-3">
            <label className="text-[13px] font-medium text-[#86868b] uppercase tracking-wide">
              Indirim Nedeni
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((reason) => (
                <button
                  key={reason.id}
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
            {selectedReason === "diger" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Neden yazin..."
                className="w-full h-[44px] px-4 text-[15px] bg-[#f5f5f7] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#e63462]/50 text-[#1d1d1f]"
              />
            )}
          </div>

          {/* Summary */}
          <div className="bg-[#f5f5f7] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-[14px]">
              <span className="text-[#86868b]">Mevcut Toplam</span>
              <span className="text-[#1d1d1f] font-medium">{formatCurrency(total)} TL</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-[#86868b]">Indirim</span>
              <span className="text-[#e63462] font-medium">-{formatCurrency(calculatedDiscount)} TL</span>
            </div>
            <div className="border-t border-[#d1d1d6] pt-2 flex justify-between text-[17px]">
              <span className="font-semibold text-[#1d1d1f]">Yeni Toplam</span>
              <span className="font-bold text-[#34c759]">{formatCurrency(finalTotal)} TL</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#e5e5ea]">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={handleApply}
            disabled={discountType !== "ikram" && value === 0}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#e63462] text-white hover:bg-[#d42d58] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Indirimi Uygula
          </button>
        </div>
      </div>
    </div>
  )
}
