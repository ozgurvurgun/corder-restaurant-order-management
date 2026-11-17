import { useEffect, useRef, useState } from "react"
import { X, Users, ShoppingBag, Loader2 } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { itemCountsTowardBill } from "@/lib/panel-types"
import { formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { usePanelToast } from "./panel-toast"

interface SplitBillModalProps {
  tableId: string
  total: number
  onClose: () => void
  onPayItemsNow?: (
    lines: { itemId: string; quantity: number }[],
    selectedTotal: number,
  ) => void
}

export default function SplitBillModal({
  tableId,
  total,
  onClose,
  onPayItemsNow,
}: SplitBillModalProps) {
  const { getTableOrders, tables, splitBillByPerson, splitBillByItems } =
    usePanelStore()
  const { showToast } = usePanelToast()
  const [mode, setMode] = useState<"select" | "person" | "items">("select")
  const [personCount, setPersonCount] = useState(2)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
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
  const tableOrders = getTableOrders(tableId)
  const allItems = tableOrders.flatMap((o) =>
    o.items.filter(itemCountsTowardBill),
  )

  const safePersonCount = Math.max(2, Math.min(20, Math.floor(personCount) || 2))
  const totalMinorUnits = toMinorUnits(total)
  const perPersonAmount = fromMinorUnits(Math.round(totalMinorUnits / safePersonCount))

  const selectedMinorUnits = Object.entries(selectedItems).reduce(
    (sum, [itemId, qty]) => {
      const item = allItems.find((i) => i.id === itemId)
      return sum + (item ? toMinorUnits(item.price) * qty : 0)
    },
    0,
  )
  const selectedTotal = fromMinorUnits(selectedMinorUnits)

  const toggleItem = (itemId: string, maxQty: number, delta: number) => {
    if (isSubmitting || submittingRef.current) return
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0
      const newQty = Math.max(0, Math.min(maxQty, current + delta))
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQty }
    })
  }

  const handleSplitByPerson = async () => {
    if (isSubmitting || submittingRef.current || safePersonCount < 2) return
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const ok = await splitBillByPerson(tableId, safePersonCount)
      if (!ok) return
      showToast(
        `${table?.name}: Hesap ${safePersonCount} kişiye bölündü. Kişi başı: ${formatCurrency(perPersonAmount)} TL`,
        "success",
      )
      onClose()
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleSplitByItemsOnly = async () => {
    if (isSubmitting || submittingRef.current || selectedTotal <= 0) return
    const itemIds = Object.keys(selectedItems)
    if (itemIds.length === 0) return
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const ok = await splitBillByItems(tableId, itemIds, selectedItems)
      if (!ok) return
      showToast(
        `${table?.name}: ${itemIds.length} ürün ayrı hesaba ayrıldı. Tutar: ${formatCurrency(selectedTotal)} TL`,
        "success",
      )
      onClose()
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleSplitByItemsAndPay = async () => {
    if (isSubmitting || submittingRef.current || selectedTotal <= 0) return
    const lines = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }))
    if (lines.length === 0) return
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const ok = await splitBillByItems(
        tableId,
        lines.map((l) => l.itemId),
        selectedItems,
      )
      if (!ok) return
      if (onPayItemsNow) {
        onPayItemsNow(lines, selectedTotal)
      } else {
        showToast(
          `${table?.name}: ${lines.length} ürün ayrı hesaba ayrıldı. Tutar: ${formatCurrency(selectedTotal)} TL`,
          "success",
        )
        onClose()
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
            Hesap Böl - {table?.name}
          </h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        <div className="p-5">
          {mode === "select" && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setMode("person")}
                className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-xl hover:bg-[#e8e8ed] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-[#e63462]/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-[#e63462]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">
                    Kişi Başına Böl
                  </p>
                  <p className="text-[13px] text-[#86868b]">
                    Toplam tutarı eşit parçalara böl
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("items")}
                className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-xl hover:bg-[#e8e8ed] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-[#007aff]/10 flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-[#007aff]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">
                    Ürün Bazında Böl
                  </p>
                  <p className="text-[13px] text-[#86868b]">
                    Belirli ürünleri ayrı hesaba taşı
                  </p>
                </div>
              </button>
            </div>
          )}

          {mode === "person" && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-[13px] text-[#86868b] mb-3">Kişi Sayısı</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPersonCount(Math.max(2, safePersonCount - 1))}
                    className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[20px] font-semibold hover:bg-[#e8e8ed] transition-colors disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="text-[40px] font-bold text-[#e63462] w-16 text-center">
                    {safePersonCount}
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPersonCount(Math.min(20, safePersonCount + 1))}
                    className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[20px] font-semibold hover:bg-[#e8e8ed] transition-colors disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="bg-[#f5f5f7] rounded-xl p-4">
                <div className="flex justify-between text-[13px] text-[#86868b] mb-1">
                  <span>Toplam</span>
                  <span>{formatCurrency(total)} TL</span>
                </div>
                <div className="flex justify-between text-[17px] font-semibold text-[#1d1d1f]">
                  <span>Kişi Başı</span>
                  <span className="text-[#e63462]">
                    {formatCurrency(perPersonAmount)} TL
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setMode("select")}
                  className="flex-1 h-[44px] rounded-xl bg-[#f5f5f7] text-[15px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors disabled:opacity-50"
                >
                  Geri
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSplitByPerson()}
                  className="flex-1 h-[44px] rounded-xl bg-[#e63462] text-[15px] font-semibold text-white hover:bg-[#d42d58] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Onayla"
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === "items" && (
            <div className="flex flex-col gap-4">
              <div className="max-h-[300px] overflow-auto space-y-2">
                {allItems.map((item) => {
                  const selected = selectedItems[item.id] || 0
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl"
                    >
                      <div className="flex-1">
                        <p className="text-[14px] font-medium text-[#1d1d1f]">
                          {item.productName}
                        </p>
                        <p className="text-[12px] text-[#86868b]">
                          {formatCurrency(item.price)} TL x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => toggleItem(item.id, item.quantity, -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-[#e5e5ea] text-[14px] font-semibold disabled:opacity-50"
                        >
                          -
                        </button>
                        <span
                          className={`w-8 text-center text-[14px] font-semibold ${
                            selected > 0 ? "text-[#e63462]" : "text-[#86868b]"
                          }`}
                        >
                          {selected}
                        </span>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => toggleItem(item.id, item.quantity, 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-[#e5e5ea] text-[14px] font-semibold disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="bg-[#f5f5f7] rounded-xl p-4">
                <div className="flex justify-between text-[15px] font-semibold text-[#1d1d1f]">
                  <span>Seçilen Tutar</span>
                  <span className="text-[#e63462]">
                    {formatCurrency(selectedTotal)} TL
                  </span>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setMode("select")}
                  className="px-4 h-[44px] rounded-xl bg-[#f5f5f7] text-[14px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors disabled:opacity-50"
                >
                  Geri
                </button>
                <button
                  type="button"
                  onClick={() => void handleSplitByItemsOnly()}
                  disabled={isSubmitting || selectedTotal === 0}
                  className="flex-1 h-[44px] rounded-xl bg-[#007aff]/10 text-[14px] font-semibold text-[#007aff] hover:bg-[#007aff]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Masada Ayır
                </button>
                <button
                  type="button"
                  onClick={() => void handleSplitByItemsAndPay()}
                  disabled={isSubmitting || selectedTotal === 0}
                  className="flex-1 h-[44px] rounded-xl bg-[#e63462] text-[14px] font-semibold text-white hover:bg-[#d42d58] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ayır ve Öde
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
