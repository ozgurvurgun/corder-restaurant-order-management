import { useEffect, useRef, useState } from "react"
import { X, ArrowRightLeft, Merge, Loader2, Minus, Plus } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import { formatCurrency } from "@/lib/format"

interface Props {
  sourceTableId: string
  itemIds: string[]
  productHint?: string
  maxQuantity?: number
  onClose: () => void
}

export default function MoveOrderItemModal({
  sourceTableId,
  itemIds,
  productHint,
  maxQuantity = 1,
  onClose,
}: Props) {
  const { tables, sections, moveOrderItems } = usePanelStore()
  const { showToast } = usePanelToast()
  const safeMax = Math.max(1, Math.floor(maxQuantity) || 1)
  const [moveQuantity, setMoveQuantity] = useState(safeMax)
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [moving, setMoving] = useState(false)
  const movingRef = useRef(false)
  const qty = Math.min(Math.max(1, moveQuantity), safeMax)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || moving || movingRef.current) return
      if (showConfirm) setShowConfirm(false)
      else onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [moving, showConfirm, onClose])

  const currentTable = tables.find((t) => t.id === sourceTableId)
  const targetTable = tables.find((t) => t.id === selectedTable)
  const isTargetOccupied = targetTable?.status === "occupied"

  const emptyTables = tables.filter(
    (t) =>
      t.id !== sourceTableId &&
      t.status === "empty" &&
      (selectedSection === "all" || t.section === selectedSection),
  )
  const occupiedTables = tables.filter(
    (t) =>
      t.id !== sourceTableId &&
      t.status === "occupied" &&
      (selectedSection === "all" || t.section === selectedSection),
  )

  const handleConfirm = async () => {
    if (!selectedTable || moving || movingRef.current) return
    movingRef.current = true
    setMoving(true)
    try {
      const ok = await moveOrderItems(sourceTableId, selectedTable, itemIds, qty)
      if (!ok) return
      showToast(
        qty < safeMax
          ? `${productHint ? `"${productHint}" (${qty} adet) ` : ""}${targetTable?.name} masasında yeni adisyon olarak açıldı`
          : `${productHint ? `"${productHint}" ` : ""}${targetTable?.name} masasında yeni adisyon olarak açıldı`,
        "success",
      )
      setShowConfirm(false)
      onClose()
    } finally {
      movingRef.current = false
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Ürünü Masaya Taşı</h2>
            <p className="text-[13px] text-[#86868b]">
              {currentTable?.name} - hedef masada <span className="font-medium">yeni adisyon</span> olarak açılır
              {productHint ? ` (${productHint})` : ""}
            </p>
          </div>
          <button type="button" disabled={moving} onClick={onClose} className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors disabled:opacity-50">
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[min(70vh,520px)] overflow-auto">
          {safeMax > 1 && itemIds.length === 1 && (
            <div>
              <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide mb-2">
                Taşınacak Adet
              </p>
              <div className="flex items-center justify-between rounded-xl border border-[#e5e5ea] px-3 py-2">
                <button
                  type="button"
                  disabled={moving || qty <= 1}
                  onClick={() => setMoveQuantity((q) => Math.max(1, q - 1))}
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
                  disabled={moving || qty >= safeMax}
                  onClick={() => setMoveQuantity((q) => Math.min(safeMax, q + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] disabled:opacity-40"
                  aria-label="Artır"
                >
                  <Plus className="h-4 w-4 text-[#1d1d1f]" />
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedSection("all")}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap ${
                selectedSection === "all" ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]"
              }`}
            >
              Tümü
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSection(section.name)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap ${
                  selectedSection === section.name ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]"
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>

          {emptyTables.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Boş Masalar</p>
              <div className="grid grid-cols-3 gap-2">
                {emptyTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    disabled={moving}
                    onClick={() => setSelectedTable(table.id)}
                    className={`p-3 rounded-xl text-center ${
                      selectedTable === table.id
                        ? "bg-[#e63462] text-white ring-2 ring-[#e63462] ring-offset-2"
                        : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                    }`}
                  >
                    <p className="text-[14px] font-semibold">{table.name}</p>
                    <p className="text-[11px] opacity-70">{table.section}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {occupiedTables.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Dolu Masalar</p>
              <div className="grid grid-cols-3 gap-2">
                {occupiedTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    disabled={moving}
                    onClick={() => setSelectedTable(table.id)}
                    className={`p-3 rounded-xl text-center ${
                      selectedTable === table.id
                        ? "bg-[#e63462] text-white ring-2 ring-[#e63462] ring-offset-2"
                        : "bg-orange-50 text-[#1d1d1f] border border-orange-200 hover:bg-orange-100"
                    }`}
                  >
                    <p className="text-[14px] font-semibold">{table.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Merge className="w-3 h-3 text-orange-500" />
                      <p className="text-[11px] text-orange-600 font-medium">{"₺"}{formatCurrency(table.totalAmount)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {emptyTables.length === 0 && occupiedTables.length === 0 && (
            <div className="py-8 text-center text-[13px] text-[#86868b] bg-[#f5f5f7] rounded-xl">Bu bölgede uygun masa yok</div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[#e5e5ea]">
          <button
            type="button"
            disabled={moving}
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => selectedTable && setShowConfirm(true)}
            disabled={!selectedTable || moving}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#e63462] text-white hover:bg-[#d42d58] disabled:opacity-50"
          >
            Devam
          </button>
        </div>
      </div>

      {showConfirm && selectedTable && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-5 text-center">
              <div
                className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                  isTargetOccupied ? "bg-orange-100" : "bg-blue-100"
                }`}
              >
                {isTargetOccupied ? (
                  <Merge className="w-6 h-6 text-orange-600" />
                ) : (
                  <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2">Yeni adisyon olarak taşı</h3>
              <p className="text-[14px] text-[#86868b]">
                {productHint ? (
                  <>
                    <span className="font-medium text-[#1d1d1f]">
                      {safeMax > 1 ? `${productHint} (${qty}/${safeMax} adet)` : productHint}
                    </span>
                    {" "}
                  </>
                ) : null}
                {currentTable?.name} masasından {targetTable?.name} masasına taşınacak. Hedefte ayrı bir adisyon
                satırı oluşur; kaynak masa adı etiket olarak görünür.
              </p>
            </div>
            <div className="flex border-t border-[#e5e5ea]">
              <button
                type="button"
                disabled={moving}
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 text-[15px] font-medium text-[#007aff] border-r border-[#e5e5ea] hover:bg-[#f5f5f7] disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={moving}
                className="flex-1 py-3.5 text-[15px] font-semibold text-[#e63462] hover:bg-[#f5f5f7] disabled:opacity-60"
              >
                {moving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Taşı"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
