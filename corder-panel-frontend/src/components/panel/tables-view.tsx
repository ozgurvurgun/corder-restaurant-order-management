import { useState, useMemo, useRef, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { formatCurrency, formatIstanbulTime } from "@/lib/format"
import { isEditableElement } from "@/lib/shortcuts/shortcut-catalog.policy"
import { useSelectTableCommandListener } from "@/lib/shortcuts/panel-shortcut-bus"
import TableDetailPanel from "./table-detail-panel"
import { Search, Lock } from "lucide-react"

export default function TablesView() {
  const { tables, sections, settings } = usePanelStore()
  const [activeSection, setActiveSection] = useState("Tumu")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useSelectTableCommandListener((tableId) => {
    setSelectedTableId(tableId)
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === "/" && !isEditableElement(e.target)) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const cardSize = settings.tableCardSize || "normal"
  const gridClass =
    cardSize === "compact"
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      : cardSize === "large"
        ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
  const cardPadding = cardSize === "compact" ? "p-3" : cardSize === "large" ? "p-5" : "p-4"

  const allSections = ["Tumu", ...sections.map((s) => s.name)]

  const filteredTables = useMemo(() => {
    let list = tables
    if (activeSection !== "Tumu") list = list.filter((t) => t.section === activeSection)
    if (search.trim()) list = list.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" }))
  }, [tables, activeSection, search])

  const selectedTable = tables.find((t) => t.id === selectedTableId)
  const occupiedCount = tables.filter((t) => t.status !== "empty").length
  const emptyCount = tables.filter((t) => t.status === "empty").length

  return (
    <div className="h-full flex">
      {/* Left: Table Grid */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-3.5 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex gap-1.5 overflow-x-auto max-w-full">
            {allSections.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap ${
                  activeSection === s
                    ? "bg-[#e63462] text-white"
                    : "text-[#86868b] hover:bg-black/[0.04]"
                }`}
              >
                {s === "Tumu" ? "Tümü" : s}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto flex-shrink-0">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Masa ara... (/)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("")
                    e.currentTarget.blur()
                  }
                }}
                className="h-[30px] w-full sm:w-[180px] pl-8 pr-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 focus:ring-1 focus:ring-[#e63462]/20"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#86868b] flex-shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#e63462]" />
              Dolu: {occupiedCount}
              <span className="inline-block w-2 h-2 rounded-full bg-[#d1d1d6] ml-2" />
              Boş: {emptyCount}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-3.5 sm:p-5">
          <div className={`grid ${gridClass} gap-3`}>
            {filteredTables.map((table) => {
              const isOccupied = table.status !== "empty"
              const isCheckout = table.status === "checkout"
              const isSelected = selectedTableId === table.id
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`relative rounded-xl border ${cardPadding} text-left transition-all hover:shadow-md ${
                    isSelected
                      ? "border-[#e63462] ring-2 ring-[#e63462]/20 bg-white shadow-md"
                      : isCheckout
                        ? "border-amber-400/70 bg-amber-50/40 hover:border-amber-500"
                        : isOccupied
                          ? "border-[#e63462]/30 bg-[#e63462]/[0.04] hover:border-[#e63462]/50"
                          : "border-[#d1d1d6]/60 bg-white hover:border-[#86868b]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[13px] font-semibold ${isOccupied ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
                      {table.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCheckout
                          ? "bg-amber-500"
                          : isOccupied
                            ? "bg-[#e63462]"
                            : "bg-[#d1d1d6]"
                      }`}
                    />
                  </div>
                  {isOccupied ? (
                    <>
                      <p className="text-[15px] font-bold text-[#e63462]">
                        {"₺"}
                        {formatCurrency(table.totalAmount)}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        <span className="text-[11px] text-[#86868b] capitalize truncate">
                          {table.waiter || "-"}
                        </span>
                        <span className="text-[11px] text-[#86868b] flex-shrink-0">
                          {table.orderCount} adisyon
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5 gap-1">
                        {table.lastUpdated ? (
                          <span className="text-[10px] text-[#86868b]/70">
                            {formatIstanbulTime(table.lastUpdated)}
                          </span>
                        ) : (
                          <span />
                        )}
                        {isCheckout ? (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            Hesap Kesimde
                          </span>
                        ) : table.lockedByStaffName ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded truncate max-w-[110px]">
                            <Lock className="w-2.5 h-2.5 flex-shrink-0" />
                            {table.lockedByStaffName}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[12px] text-[#86868b]">Boş</p>
                      {table.lockedByStaffName && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded truncate max-w-[110px]">
                          <Lock className="w-2.5 h-2.5 flex-shrink-0" />
                          {table.lockedByStaffName}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: Detail Panel */}
      {selectedTable && (
        <TableDetailPanel
          tableId={selectedTable.id}
          onClose={() => setSelectedTableId(null)}
        />
      )}
    </div>
  )
}
