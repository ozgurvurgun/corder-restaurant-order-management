import { useState } from "react"
import { Menu, UtensilsCrossed, Wine, Hash, Wifi, WifiOff, LogOut } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import type { TerminalTable, TerminalUser } from "@/lib/types"

const ALL_SECTIONS = "all"

/** On the tables grid, show only the first word of the name (e.g. "Selma Elden" -> "Selma"). */
function waiterDisplayName(waiter: string | undefined): string {
  const trimmed = waiter?.trim()
  if (!trimmed) return ""
  return trimmed.split(/\s+/)[0] ?? ""
}

interface TablesScreenProps {
  onTableSelect: (tableId: string) => void
  onLogout: () => void
}

type FilterMode = "all" | "open" | "number"

export function TablesScreen({ onTableSelect, onLogout }: TablesScreenProps) {
  const { tables, currentUser, isOffline, toggleOffline } = useApp()
  const [activeSection, setActiveSection] = useState<string>(ALL_SECTIONS)
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [menuOpen, setMenuOpen] = useState(false)
  const [tableNumber, setTableNumber] = useState("")

  const sectionNames = Array.from(new Set(tables.map((t) => t.section).filter(Boolean)))
  const sections = [ALL_SECTIONS, ...sectionNames]

  const filteredTables = tables
    .filter((t) => {
      if (activeSection !== ALL_SECTIONS && t.section !== activeSection) return false
      if (filterMode === "open" && t.status === "empty") return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" }))

  const openTableCount = tables.filter((t) => t.status !== "empty").length

  const handleNumberSearch = () => {
    if (!tableNumber) return
    const found = tables.find((t) => t.name.toLowerCase().includes(tableNumber.toLowerCase()))
    if (found) onTableSelect(found.id)
    setTableNumber("")
  }

  return (
    <div className="h-dvh flex flex-col bg-background relative overflow-hidden">
      {/* Fixed Header */}
      <header
        className="bg-[#e63462] text-white px-4 flex items-center justify-between flex-shrink-0 safe-top"
        style={{ minHeight: 44 }}
      >
        <div className="flex items-center gap-2.5 py-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <h1 className="text-[17px] font-semibold tracking-tight">Corder</h1>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 -mr-2 active:opacity-60"
          aria-label="Menü"
        >
          <Menu className="h-[22px] w-[22px]" />
        </button>
      </header>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          <div className="absolute inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute left-3 right-3 z-50 bg-card rounded-2xl shadow-xl border border-border overflow-hidden"
            style={{ top: 56 }}
          >
            <div className="p-4 flex flex-col">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border">
                <div className="h-10 w-10 rounded-full bg-[#e63462]/10 flex items-center justify-center">
                  <span className="text-[15px] font-semibold text-[#e63462] capitalize">
                    {currentUser?.name?.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-card-foreground capitalize">
                    {currentUser?.name}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {"Açık: "}
                    {openTableCount}
                    {" / "}
                    {tables.length}
                    {" masa"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  toggleOffline()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-3 py-3 active:bg-muted/50 -mx-1 px-1 rounded-lg"
              >
                {isOffline ? (
                  <WifiOff className="h-[20px] w-[20px] text-orange-500" />
                ) : (
                  <Wifi className="h-[20px] w-[20px] text-muted-foreground" />
                )}
                <span className="text-[15px] text-card-foreground">
                  {isOffline ? "Çevrimdışı Mod (Aktif)" : "Çevrimdışı Mod"}
                </span>
              </button>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={() => {
                    onLogout()
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-3 py-3 active:bg-muted/50 -mx-1 px-1 rounded-lg w-full"
                >
                  <LogOut className="h-[20px] w-[20px] text-destructive" />
                  <span className="text-[15px] text-destructive">Çıkış Yap</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fixed Segmented Control */}
      <div className="px-4 py-3 bg-background flex-shrink-0 border-b border-border">
        <div className="bg-muted rounded-lg p-0.5 flex">
          {sections.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`flex-1 py-[7px] text-[13px] font-semibold rounded-md transition-all ${
                activeSection === section
                  ? "bg-card text-[#e63462] shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {section === ALL_SECTIONS ? "Tümü" : section}
            </button>
          ))}
        </div>
      </div>

      {/* Number Search */}
      {filterMode === "number" && (
        <div className="px-4 py-3 flex gap-2 flex-shrink-0 border-b border-border bg-background">
          <input
            type="text"
            placeholder="Masa adı veya numarası..."
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNumberSearch()}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-[15px] text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#e63462]/40"
            autoFocus
          />
          <button
            onClick={handleNumberSearch}
            className="bg-[#e63462] text-white px-5 py-2.5 rounded-xl text-[15px] font-semibold active:opacity-80"
          >
            Bul
          </button>
        </div>
      )}

      {/* Scrollable Tables Grid */}
      <div className="flex-1 overflow-auto px-4 py-3 ios-scroll">
        <div className="grid grid-cols-3 gap-2.5">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              currentUser={currentUser}
              onClick={() => onTableSelect(table.id)}
            />
          ))}
        </div>
      </div>

      {/* Fixed Tab Bar */}
      <nav
        className="flex-shrink-0 border-t border-border safe-bottom"
        style={{
          backgroundColor: "rgba(249,249,249,0.94)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
        }}
      >
        <div className="flex">
          <TabBarButton
            icon={<UtensilsCrossed className="h-[22px] w-[22px]" />}
            label="Tüm Masalar"
            active={filterMode === "all"}
            onClick={() => setFilterMode("all")}
          />
          <TabBarButton
            icon={<Wine className="h-[22px] w-[22px]" />}
            label="Açık Masalar"
            active={filterMode === "open"}
            onClick={() => setFilterMode("open")}
          />
          <TabBarButton
            icon={<Hash className="h-[22px] w-[22px]" />}
            label="Numara Gir"
            active={filterMode === "number"}
            onClick={() => setFilterMode(filterMode === "number" ? "all" : "number")}
          />
        </div>
      </nav>
    </div>
  )
}

function TableCard({
  table,
  currentUser,
  onClick,
}: {
  table: TerminalTable
  currentUser: TerminalUser | null
  onClick: () => void
}) {
  const isOccupied = table.status !== "empty"
  const isBillRequested = table.status === "bill-requested"
  const lockedByOther = Boolean(
    table.lockedByStaffId && currentUser && table.lockedByStaffId !== currentUser.id
  )

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl p-3 flex flex-col items-center gap-0.5 min-h-[110px] transition-all active:scale-[0.96] ${
        lockedByOther
          ? "bg-[#2563eb] text-white shadow-md shadow-[#2563eb]/25"
          : isBillRequested
            ? "bg-[#0a84ff] text-white shadow-md shadow-[#0a84ff]/25"
            : isOccupied
              ? "bg-[#e63462] text-white shadow-md shadow-[#e63462]/20"
              : "bg-card text-card-foreground shadow-sm"
      }`}
    >
      <div
        className={`w-10 h-1 rounded-full mb-1.5 ${
          lockedByOther || isOccupied || isBillRequested ? "bg-white/30" : "bg-muted"
        }`}
      />
      <span className="font-semibold text-[13px]">{table.name}</span>
      {lockedByOther ? (
        <>
          <span className="text-[15px] font-semibold text-white mt-auto pt-1 capitalize">
            {waiterDisplayName(table.lockedByStaffName) || "Garson"}
          </span>
          {isOccupied ? (
            <span className="text-[11px] text-white/65 mt-0.5">
              {"₺"}
              {formatCurrency(table.currentTotal)}
            </span>
          ) : null}
        </>
      ) : isOccupied ? (
        <>
          <span className="text-[12px] font-semibold text-white/90 mt-0.5">
            {"₺"}
            {formatCurrency(table.currentTotal)}
          </span>
          <div className="flex items-center justify-between w-full text-[11px] text-white/60 mt-auto pt-1">
            <span className="capitalize">{waiterDisplayName(table.activeWaiter)}</span>
            <span>
              {table.openedAt
                ? new Date(table.openedAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </span>
          </div>
        </>
      ) : (
        <span className="text-[12px] text-muted-foreground mt-0.5">Boş</span>
      )}
    </button>
  )
}

function TabBarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-3 min-h-[54px] transition-colors ${
        active ? "text-[#e63462]" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
