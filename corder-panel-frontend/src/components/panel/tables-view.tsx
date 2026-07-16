import { useState, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import TableDetailPanel from "./table-detail-panel"
import { Search } from "lucide-react"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

export default function TablesView() {
  const { tables, sections } = usePanelStore()
  const [activeSection, setActiveSection] = useState("Tumu")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const allSections = ["Tumu", ...sections.map((s) => s.name)]

  const filteredTables = useMemo(() => {
    let list = tables
    if (activeSection !== "Tumu") list = list.filter((t) => t.section === activeSection)
    if (search.trim()) list = list.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" }))
  }, [tables, activeSection, search])

  const selectedTable = tables.find((t) => t.id === selectedTableId)

  return (
    <div className="h-full flex">
      {/* Left: Table Grid */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Toolbar */}
        <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Masalar</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
              <input
                type="text"
                placeholder="Masa ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-[30px] w-[180px] pl-8 pr-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 focus:ring-1 focus:ring-[#e63462]/20"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#e63462]" />
              Dolu: {tables.filter((t) => t.status === "occupied").length}
              <span className="inline-block w-2 h-2 rounded-full bg-[#d1d1d6] ml-2" />
              Bos: {tables.filter((t) => t.status === "empty").length}
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5">
          {allSections.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors ${
                activeSection === s
                  ? "bg-[#e63462] text-white"
                  : "text-[#86868b] hover:bg-black/[0.04]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filteredTables.map((table) => {
              const isOccupied = table.status === "occupied"
              const isSelected = selectedTableId === table.id
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? "border-[#e63462] ring-2 ring-[#e63462]/20 bg-white shadow-md"
                      : isOccupied
                        ? "border-[#e63462]/30 bg-[#e63462]/[0.04] hover:border-[#e63462]/50"
                        : "border-[#d1d1d6]/60 bg-white hover:border-[#86868b]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[13px] font-semibold ${isOccupied ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
                      {table.name}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${isOccupied ? "bg-[#e63462]" : "bg-[#d1d1d6]"}`} />
                  </div>
                  {isOccupied ? (
                    <>
                      <p className="text-[15px] font-bold text-[#e63462]">{"₺"}{formatCurrency(table.totalAmount)}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-[#86868b] capitalize">{table.waiter}</span>
                        <span className="text-[11px] text-[#86868b]">{table.orderCount} adisyon</span>
                      </div>
                      {table.lastUpdated && (
                        <span className="text-[10px] text-[#86868b]/70 mt-0.5 block">
                          {new Date(table.lastUpdated).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-[12px] text-[#86868b] mt-0.5">Bos</p>
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
