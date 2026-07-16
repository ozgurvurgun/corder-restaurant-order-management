import { useState } from "react"
import { X, ArrowRightLeft, Merge, Loader2 } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import { formatCurrency } from "@/lib/services"

interface Props {
  sourceTableId: string
  itemIds: string[]
  productHint?: string
  onClose: () => void
}

export default function MoveOrderItemModal({ sourceTableId, itemIds, productHint, onClose }: Props) {
  const { tables, sections, moveOrderItems } = usePanelStore()
  const { showToast } = usePanelToast()
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [moving, setMoving] = useState(false)

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
    if (!selectedTable) return
    setMoving(true)
    const ok = await moveOrderItems(sourceTableId, selectedTable, itemIds)
    setMoving(false)
    if (!ok) {
      showToast("Urunler tasinamadi", "error")
      return
    }
    showToast(
      `${productHint ? `"${productHint}" ` : ""}${targetTable?.name} masasinda yeni adisyon olarak acildi`,
      "success",
    )
    setShowConfirm(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Urunu Masaya Tası</h2>
            <p className="text-[13px] text-[#86868b]">
              {currentTable?.name} — hedef masada <span className="font-medium">yeni adisyon</span> olarak acilir
              {productHint ? ` (${productHint})` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors">
            <X className="h-5 w-5 text-[#86868b]" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[min(70vh,520px)] overflow-auto">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedSection("all")}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap ${
                selectedSection === "all" ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]"
              }`}
            >
              Tumu
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
              <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Bos Masalar</p>
              <div className="grid grid-cols-3 gap-2">
                {emptyTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
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
            <div className="py-8 text-center text-[13px] text-[#86868b] bg-[#f5f5f7] rounded-xl">Bu bolgede uygun masa yok</div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-[#e5e5ea]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
          >
            Iptal
          </button>
          <button
            type="button"
            onClick={() => selectedTable && setShowConfirm(true)}
            disabled={!selectedTable}
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
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2">Yeni adisyon olarak tasi</h3>
              <p className="text-[14px] text-[#86868b]">
                {productHint ? (
                  <>
                    <span className="font-medium text-[#1d1d1f]">{productHint}</span>
                    {" "}
                  </>
                ) : null}
                {currentTable?.name} masasindan {targetTable?.name} masasina tasinacak. Hedefte ayri bir adisyon
                satiri olusur; kaynak masa adi etiket olarak gorunur.
              </p>
            </div>
            <div className="flex border-t border-[#e5e5ea]">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 text-[15px] font-medium text-[#007aff] border-r border-[#e5e5ea] hover:bg-[#f5f5f7]"
              >
                Vazgec
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={moving}
                className="flex-1 py-3.5 text-[15px] font-semibold text-[#e63462] hover:bg-[#f5f5f7] disabled:opacity-60"
              >
                {moving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Tasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
