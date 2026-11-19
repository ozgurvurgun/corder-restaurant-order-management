import { useEffect, useRef, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import { X, AlertTriangle, Loader2, Minus, Plus } from "lucide-react"

const REASONS = [
  "Müşteri vazgeçti",
  "Yanlış sipariş",
  "Ürün bitmiş",
  "Kalite sorunu",
]

interface Props {
  orderId: string
  itemId: string
  itemName: string
  maxQuantity?: number
  onClose: () => void
}

export default function OrderCancelModal({
  orderId,
  itemId,
  itemName,
  maxQuantity = 1,
  onClose,
}: Props) {
  const { cancelOrderItem } = usePanelStore()
  const { showToast } = usePanelToast()
  const safeMax = Math.max(1, Math.floor(maxQuantity) || 1)
  const [cancelQuantity, setCancelQuantity] = useState(safeMax)
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const qty = Math.min(Math.max(1, cancelQuantity), safeMax)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSubmitting, onClose])

  const finalReason = (reason === "other" ? customReason : reason).trim()

  const handleConfirm = async () => {
    if (!finalReason || isSubmitting || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const ok = await cancelOrderItem(orderId, itemId, finalReason, qty)
      if (!ok) return
      showToast(
        qty < safeMax ? `${itemName} - ${qty} adet iptal edildi` : `${itemName} iptal edildi`,
        "warning",
      )
      onClose()
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Ürün İptal</h3>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-[#86868b]" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[13px] text-[#1d1d1f]">
            <span className="font-semibold">{itemName}</span> ürününü iptal etmek istediğinizden emin misiniz?
          </p>

          {safeMax > 1 && (
            <div>
              <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">
                İptal Adedi
              </label>
              <div className="flex items-center justify-between rounded-xl border border-[#d1d1d6]/60 px-3 py-2">
                <button
                  type="button"
                  disabled={isSubmitting || qty <= 1}
                  onClick={() => setCancelQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-40"
                  aria-label="Azalt"
                >
                  <Minus className="h-4 w-4 text-[#1d1d1f]" />
                </button>
                <div className="text-center">
                  <p className="text-[18px] font-bold tabular-nums text-[#1d1d1f]">{qty}</p>
                  <p className="text-[11px] text-[#86868b]">/ {safeMax} adet</p>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting || qty >= safeMax}
                  onClick={() => setCancelQuantity((q) => Math.min(safeMax, q + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-40"
                  aria-label="Artır"
                >
                  <Plus className="h-4 w-4 text-[#1d1d1f]" />
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2 block">İptal Sebebi *</label>
            <div className="flex flex-col gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReason(r)}
                  className={`text-left px-3 py-2 rounded-lg border text-[13px] transition-colors ${
                    reason === r ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462] font-medium" : "border-[#d1d1d6]/60 text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setReason("other")}
                className={`text-left px-3 py-2 rounded-lg border text-[13px] transition-colors ${
                  reason === "other" ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462] font-medium" : "border-[#d1d1d6]/60 text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
              >
                Diğer...
              </button>
            </div>
            {reason === "other" && (
              <input
                type="text"
                disabled={isSubmitting}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Sebebi yazın..."
                className="w-full mt-2 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#f0f0f0] flex gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 h-[38px] rounded-xl border border-[#d1d1d6]/60 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!finalReason || isSubmitting}
            className="flex-1 h-[38px] rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : safeMax > 1 ? (
              `${qty} Adet İptal Et`
            ) : (
              "İptal Et"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
