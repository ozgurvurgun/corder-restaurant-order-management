import { useState } from "react"
import { X, Users, ShoppingBag } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { itemCountsTowardBill } from "@/lib/panel-types"
import { usePanelToast } from "./panel-toast"

interface SplitBillModalProps {
  tableId: string
  total: number
  onClose: () => void
}

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

export default function SplitBillModal({ tableId, total, onClose }: SplitBillModalProps) {
  const { getTableOrders, tables, splitBillByPerson, splitBillByItems } = usePanelStore()
  const { showToast } = usePanelToast()
  const [mode, setMode] = useState<"select" | "person" | "items">("select")
  const [personCount, setPersonCount] = useState(2)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})

  const table = tables.find((t) => t.id === tableId)
  const tableOrders = getTableOrders(tableId)
  const allItems = tableOrders.flatMap((o) => o.items.filter(itemCountsTowardBill))

  const perPersonAmount = Math.ceil(total / personCount)

  const selectedTotal = Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
    const item = allItems.find((i) => i.id === itemId)
    return sum + (item ? item.price * qty : 0)
  }, 0)

  const toggleItem = (itemId: string, maxQty: number, delta: number) => {
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

  const handleSplitByPerson = () => {
    splitBillByPerson(tableId, personCount)
    showToast(`${table?.name}: Hesap ${personCount} kisiye bolundu. Kisi basi: ${formatCurrency(perPersonAmount)} TL`, "success")
    onClose()
  }

  const handleSplitByItems = () => {
    const itemIds = Object.keys(selectedItems)
    splitBillByItems(tableId, itemIds, selectedItems)
    showToast(`${table?.name}: ${itemIds.length} urun ayri hesaba ayrildi. Tutar: ${formatCurrency(selectedTotal)} TL`, "success")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Hesap Bol - {table?.name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors">
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {mode === "select" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode("person")}
                className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-xl hover:bg-[#e8e8ed] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-[#e63462]/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-[#e63462]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">Kisi Basina Bol</p>
                  <p className="text-[13px] text-[#86868b]">Toplam tutari esit parcalara bol</p>
                </div>
              </button>
              <button
                onClick={() => setMode("items")}
                className="flex items-center gap-4 p-4 bg-[#f5f5f7] rounded-xl hover:bg-[#e8e8ed] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-[#007aff]/10 flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-[#007aff]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">Urun Bazinda Bol</p>
                  <p className="text-[13px] text-[#86868b]">Belirli urunleri ayri hesaba tasi</p>
                </div>
              </button>
            </div>
          )}

          {mode === "person" && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-[13px] text-[#86868b] mb-3">Kisi Sayisi</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPersonCount(Math.max(2, personCount - 1))}
                    className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[20px] font-semibold hover:bg-[#e8e8ed] transition-colors"
                  >
                    -
                  </button>
                  <span className="text-[40px] font-bold text-[#e63462] w-16 text-center">{personCount}</span>
                  <button
                    onClick={() => setPersonCount(Math.min(20, personCount + 1))}
                    className="w-12 h-12 rounded-full bg-[#f5f5f7] text-[20px] font-semibold hover:bg-[#e8e8ed] transition-colors"
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
                  <span>Kisi Basi</span>
                  <span className="text-[#e63462]">{formatCurrency(perPersonAmount)} TL</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setMode("select")} className="flex-1 h-[44px] rounded-xl bg-[#f5f5f7] text-[15px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors">
                  Geri
                </button>
                <button onClick={handleSplitByPerson} className="flex-1 h-[44px] rounded-xl bg-[#e63462] text-[15px] font-semibold text-white hover:bg-[#d42d58] transition-colors">
                  Onayla
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
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                      <div className="flex-1">
                        <p className="text-[14px] font-medium text-[#1d1d1f]">{item.productName}</p>
                        <p className="text-[12px] text-[#86868b]">{formatCurrency(item.price)} TL x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleItem(item.id, item.quantity, -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-[#e5e5ea] text-[14px] font-semibold"
                        >
                          -
                        </button>
                        <span className={`w-8 text-center text-[14px] font-semibold ${selected > 0 ? "text-[#e63462]" : "text-[#86868b]"}`}>
                          {selected}
                        </span>
                        <button
                          onClick={() => toggleItem(item.id, item.quantity, 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-[#e5e5ea] text-[14px] font-semibold"
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
                  <span>Secilen Tutar</span>
                  <span className="text-[#e63462]">{formatCurrency(selectedTotal)} TL</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setMode("select")} className="flex-1 h-[44px] rounded-xl bg-[#f5f5f7] text-[15px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors">
                  Geri
                </button>
                <button
                  onClick={handleSplitByItems}
                  disabled={selectedTotal === 0}
                  className="flex-1 h-[44px] rounded-xl bg-[#e63462] text-[15px] font-semibold text-white hover:bg-[#d42d58] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ayir ve Ode
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
