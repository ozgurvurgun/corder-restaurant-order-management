import { useState, useEffect } from "react"
import { Menu, UtensilsCrossed, Wine, Hash, RefreshCw, LogOut, Bell } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { useToast } from "@/components/ios-toast"
import { TerminalNotificationSettingsModal } from "@/components/notification-settings-modal"
import {
  getTerminalPushPermissionStatus,
  requestTerminalPushPermission,
  syncTerminalWebPushSubscription,
} from "@/lib/terminal-notifications"
import type { TerminalTable, TerminalUser } from "@/lib/types"

const ALL_SECTIONS = "all"

/** On the tables grid, show only the first word of the name (e.g. "John Doe" -> "John"). */
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
  const { tables, currentUser, isLoading, refreshData } = useApp()
  const { showToast } = useToast()
  const [activeSection, setActiveSection] = useState<string>(ALL_SECTIONS)
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false)
  const [tableNumber, setTableNumber] = useState("")
  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">(() =>
    getTerminalPushPermissionStatus()
  )

  useEffect(() => {
    const syncPerm = () => setPushPerm(getTerminalPushPermissionStatus())
    window.addEventListener("corder:terminal-push-permission", syncPerm)
    if (getTerminalPushPermissionStatus() === "granted") {
      void syncTerminalWebPushSubscription()
    }
    return () => window.removeEventListener("corder:terminal-push-permission", syncPerm)
  }, [])

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
    const q = tableNumber.trim().toLocaleLowerCase("tr-TR")
    if (!q) return
    const found =
      tables.find((t) => t.name.toLocaleLowerCase("tr-TR") === q) ??
      tables.find((t) => t.name.toLocaleLowerCase("tr-TR").includes(q))
    if (found) {
      onTableSelect(found.id)
    } else {
      showToast("Masa bulunamadı", "error")
    }
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
          <img
            src="/corder-logo.png"
            alt="Corder"
            className="w-7 h-7 rounded-lg object-cover shadow-xs"
          />
          <h1 className="text-[17px] font-semibold tracking-tight">Corder</h1>
        </div>
        <div className="flex items-center gap-1 -mr-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 active:opacity-60"
            aria-label="Menü"
          >
            <Menu className="h-[22px] w-[22px]" />
          </button>
        </div>
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
                    {currentUser?.roleLabel ? `${currentUser.roleLabel} • ` : ""}
                    {"Açık: "}
                    {openTableCount}
                    {" / "}
                    {tables.length}
                    {" masa"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refreshData()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-3 py-3 active:bg-muted/50 -mx-1 px-1 rounded-lg"
              >
                <RefreshCw className={`h-[20px] w-[20px] text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
                <span className="text-[15px] text-card-foreground">Verileri Yenile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setNotifSettingsOpen(true)
                }}
                className="flex items-center gap-3 py-3 active:bg-muted/50 -mx-1 px-1 rounded-lg"
              >
                <Bell className="h-[20px] w-[20px] text-muted-foreground" />
                <span className="text-[15px] text-card-foreground">Bildirim & Ses Ayarları</span>
              </button>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onLogout()
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-3 py-3 active:bg-muted/50 -mx-1 px-1 rounded-lg w-full"
                >
                  <LogOut className="h-[20px] w-[20px] text-destructive" />
                  <span className="text-[15px] text-destructive">Personel Değiştir / Çıkış</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fixed Segmented Control */}
      {pushPerm === "default" && (
        <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 text-[#e63462] flex-shrink-0" />
            <span className="text-[12px] font-medium text-card-foreground truncate">
              Garson ve hesap çağrıları için Push bildirimlerini açın
            </span>
          </div>
          <button
            type="button"
            onClick={() => void requestTerminalPushPermission()}
            className="px-3 py-1 rounded-lg bg-[#e63462] text-white text-[12px] font-semibold flex-shrink-0 active:opacity-85"
          >
            İzin Ver
          </button>
        </div>
      )}
      <div className="px-4 py-3 bg-background flex-shrink-0 border-b border-border">
        <div className="bg-muted rounded-lg p-0.5 flex overflow-x-auto">
          {sections.map((section) => (
            <button
              type="button"
              key={section}
              onClick={() => setActiveSection(section)}
              className={`flex-1 min-w-[68px] py-[7px] px-2 text-[13px] font-semibold rounded-md transition-all truncate ${
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
            type="button"
            onClick={handleNumberSearch}
            className="bg-[#e63462] text-white px-5 py-2.5 rounded-xl text-[15px] font-semibold active:opacity-80"
          >
            Bul
          </button>
        </div>
      )}

      {/* Scrollable Tables Grid */}
      <div className="flex-1 overflow-auto px-4 py-3 ios-scroll">
        {filteredTables.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-[15px]">
            {filterMode === "open" ? "Açık masa bulunmuyor" : "Masa bulunamadı"}
          </div>
        ) : (
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
        )}
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
      <TerminalNotificationSettingsModal
        open={notifSettingsOpen}
        onClose={() => setNotifSettingsOpen(false)}
      />
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
      type="button"
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
          <span className="text-[14px] font-semibold text-white mt-auto pt-1 capitalize truncate max-w-full">
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
          {isBillRequested && (
            <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full text-white mt-0.5">
              Hesap Kesiliyor
            </span>
          )}
          <div className="flex items-center justify-between w-full text-[11px] text-white/60 mt-auto pt-1">
            <span className="capitalize truncate max-w-[55%]">{waiterDisplayName(table.activeWaiter)}</span>
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
      type="button"
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
