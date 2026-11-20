import { useEffect, useRef, useState } from "react"
import { X, ArrowRightLeft, Merge, Loader2 } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import { formatCurrency } from "@/lib/format"

interface MoveTableModalProps {
  tableId: string
  onClose: () => void
}

export default function MoveTableModal({ tableId, onClose }: MoveTableModalProps) {
  const { tables, sections, moveTable } = usePanelStore()
  const { showToast } = usePanelToast()
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [moving, setMoving] = useState(false)
  const movingRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || moving || movingRef.current) return
      if (showConfirm) setShowConfirm(false)
      else onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [moving, showConfirm, onClose])

  const currentTable = tables.find((t) => t.id === tableId)
  const targetTable = tables.find((t) => t.id === selectedTable)
  const isTargetOccupied = targetTable?.status === "occupied"
  
  const tableSort = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" })

  const emptyTables = tables
    .filter((t) => t.id !== tableId && t.status === "empty" && (selectedSection === "all" || t.section === selectedSection))
    .sort(tableSort)

  const occupiedTables = tables
    .filter((t) => t.id !== tableId && t.status === "occupied" && (selectedSection === "all" || t.section === selectedSection))
    .sort(tableSort)

  const handleSelectTable = (id: string) => {
    if (moving || movingRef.current) return
    setSelectedTable(id)
  }

  const handleMoveClick = () => {
    if (!selectedTable || !currentTable || moving || movingRef.current) return
    setShowConfirm(true)
  }

  const handleConfirmMove = async () => {
    if (!selectedTable || !currentTable || !targetTable || moving || movingRef.current) return
    movingRef.current = true
    setMoving(true)
    try {
      const ok = await moveTable(tableId, selectedTable)
      if (!ok) return
      if (isTargetOccupied) {
        showToast(`${currentTable.name} siparişleri ${targetTable.name} ile birleştirildi`, "success")
      } else {
        showToast(`${currentTable.name} siparişleri ${targetTable.name} masasına taşındı`, "success")
      }
      setShowConfirm(false)
      onClose()
    } finally {
      movingRef.current = false
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Masa Taşı</h2>
            <p className="text-[13px] text-[#86868b]">{currentTable?.name} siparişlerini başka masaya taşı</p>
          </div>
          <button type="button" disabled={moving} onClick={onClose} className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors disabled:opacity-50">
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedSection("all")}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                selectedSection === "all" ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
              }`}
            >
              Tümü
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSection(section.name)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                  selectedSection === section.name ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto px-1.5 py-1.5 -mx-1.5">
            {emptyTables.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Boş Masalar</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {emptyTables.map((table) => {
                    const isSelected = selectedTable === table.id
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => handleSelectTable(table.id)}
                        className={`p-3 rounded-xl text-center transition-all ${
                          isSelected
                            ? "bg-[#e63462] text-white ring-2 ring-[#e63462] ring-offset-2"
                            : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                        }`}
                      >
                        <p className="text-[14px] font-semibold">{table.name}</p>
                        <p className={`text-[11px] ${isSelected ? "text-white/85" : "opacity-70"}`}>{table.section}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {occupiedTables.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Dolu Masalar (Birleştir)</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {occupiedTables.map((table) => {
                    const isSelected = selectedTable === table.id
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => handleSelectTable(table.id)}
                        className={`p-3 rounded-xl text-center transition-all border ${
                          isSelected
                            ? "bg-[#e63462] text-white border-[#e63462] ring-2 ring-[#e63462] ring-offset-2"
                            : "bg-orange-50 text-[#1d1d1f] hover:bg-orange-100 border-orange-200"
                        }`}
                      >
                        <p className="text-[14px] font-semibold">{table.name}</p>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <Merge className={`w-3 h-3 ${isSelected ? "text-white/90" : "text-orange-500"}`} />
                          <p className={`text-[11px] font-semibold ${isSelected ? "text-white" : "text-orange-600"}`}>
                            {"₺"}{formatCurrency(table.totalAmount)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {emptyTables.length === 0 && occupiedTables.length === 0 && (
              <div className="py-8 text-center text-[13px] text-[#86868b] bg-[#f5f5f7] rounded-xl">
                Bu bölgede uygun masa bulunmuyor
              </div>
            )}
          </div>

          {selectedTable && (
            <div className="bg-[#f5f5f7] rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-[12px] text-[#86868b]">Kaynak</p>
                <p className="text-[15px] font-semibold text-[#1d1d1f]">{currentTable?.name}</p>
              </div>
              <ArrowRightLeft className="w-5 h-5 text-[#e63462]" />
              <div className="flex-1 text-center">
                <p className="text-[12px] text-[#86868b]">Hedef</p>
                <p className="text-[15px] font-semibold text-[#e63462]">
                  {tables.find((t) => t.id === selectedTable)?.name}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[#e5e5ea]">
          <button
            type="button"
            disabled={moving}
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleMoveClick}
            disabled={!selectedTable || moving}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#e63462] text-white hover:bg-[#d42d58] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Taşı
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-5 text-center">
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${isTargetOccupied ? "bg-orange-100" : "bg-blue-100"}`}>
                {isTargetOccupied ? (
                  <Merge className="w-6 h-6 text-orange-600" />
                ) : (
                  <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2">
                {isTargetOccupied ? "Masaları Birleştir" : "Masayı Taşı"}
              </h3>
              <p className="text-[14px] text-[#86868b]">
                {isTargetOccupied 
                  ? `${currentTable?.name} siparişleri ${targetTable?.name} masasıyla birleştirilecek. Tüm ürünler tek adisyonda görünecektir.`
                  : `${currentTable?.name} masasını ${targetTable?.name} masasına taşımak istediğinize emin misiniz?`
                }
              </p>
            </div>
            <div className="flex border-t border-[#e5e5ea]">
              <button
                type="button"
                disabled={moving}
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 text-[15px] font-medium text-[#007aff] border-r border-[#e5e5ea] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmMove()}
                disabled={moving}
                className={`flex-1 py-3.5 text-[15px] font-semibold hover:bg-[#f5f5f7] transition-colors disabled:opacity-60 ${isTargetOccupied ? "text-orange-600" : "text-[#e63462]"}`}
              >
                {moving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isTargetOccupied ? "Birleştir" : "Taşı")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
