import { useState } from "react"
import { ChevronLeft, UtensilsCrossed, Wine, Hash, Merge, Lock } from "lucide-react"
import { useApp } from "@/lib/store"
import { useToast } from "@/components/ios-toast"
import { ConfirmDialog } from "./confirm-dialog"
import { formatCurrency } from "@/lib/format"
import type { TerminalTable, TerminalUser } from "@/lib/types"

const ALL_SECTIONS = "all"

interface MoveTableScreenProps {
  fromTableId: string
  onBack: () => void
  onMoved: () => void
}

type FilterMode = "all" | "open" | "number"

export function MoveTableScreen({ fromTableId, onBack, onMoved }: MoveTableScreenProps) {
  const { showToast } = useToast()
  const { tables, currentUser, moveTable, hasPermission } = useApp()
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<string>(ALL_SECTIONS)
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [tableNumber, setTableNumber] = useState("")

  const fromTable = tables.find((t) => t.id === fromTableId)
  const selectedTarget = tables.find((t) => t.id === selectedTargetId)
  const sectionNames = Array.from(new Set(tables.map((t) => t.section).filter(Boolean)))
  const sections = [ALL_SECTIONS, ...sectionNames]

  const isTargetOccupied = selectedTarget?.status === "occupied"

  const filteredTables = tables
    .filter((t) => t.id !== fromTableId)
    .filter((t) => {
      if (activeSection !== ALL_SECTIONS && t.section !== activeSection) return false
      if (filterMode === "open" && t.status === "empty") return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" }))

  const handleSelectTarget = (toTableId: string) => {
    if (isSubmitting) return
    const target = tables.find((t) => t.id === toTableId)
    if (!target) return
    if (target.status === "bill-requested") {
      showToast("Hedef masa şu an hesap kesiminde olduğu için taşınamaz.", "error")
      return
    }
    if (target.lockedByStaffId && (!currentUser || target.lockedByStaffId !== currentUser.id)) {
      showToast(
        `Hedef masa şu an ${target.lockedByStaffName || "başka bir garson"} tarafından kullanılıyor.`,
        "error"
      )
      return
    }
    setSelectedTargetId(toTableId)
    setShowConfirm(true)
  }

  const handleMoveConfirmed = async () => {
    if (!selectedTargetId || isSubmitting) return
    if (!hasPermission("table.move")) {
      showToast("Masa taşıma yetkiniz bulunmuyor", "error")
      return
    }
    setIsSubmitting(true)
    try {
      const ok = await moveTable(fromTableId, selectedTargetId)
      if (!ok) {
        showToast("Masa taşınamadı (açık kasa vardiyası veya masa durumunu kontrol edin)", "error")
        return
      }
      if (isTargetOccupied) {
        showToast(`${fromTable?.name} -> ${selectedTarget?.name} birleştirildi`)
      } else {
        showToast(`${fromTable?.name} -> ${selectedTarget?.name} taşındı`)
      }
      setShowConfirm(false)
      onMoved()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNumberSearch = () => {
    const q = tableNumber.trim().toLocaleLowerCase("tr-TR")
    if (!q) return
    const found =
      tables.find((t) => t.id !== fromTableId && t.name.toLocaleLowerCase("tr-TR") === q) ??
      tables.find((t) => t.id !== fromTableId && t.name.toLocaleLowerCase("tr-TR").includes(q))
    if (found) {
      handleSelectTarget(found.id)
    } else {
      showToast("Masa bulunamadı", "error")
    }
    setTableNumber("")
  }

  return (
    <div className="h-dvh flex flex-col bg-background relative overflow-hidden">
      {/* Fixed iOS Navigation Bar */}
      <header
        className="bg-[#e63462] text-white flex items-center gap-3 flex-shrink-0 safe-top relative"
        style={{ minHeight: 44 }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 pl-2 pr-3 py-2.5 active:opacity-60 z-10"
          aria-label="Geri"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
          <span className="text-[17px]">Geri</span>
        </button>
        <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2 truncate max-w-[200px]">
          {fromTable?.name} Taşı
        </h1>
      </header>

      {/* Fixed Segmented Control */}
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
          <div className="flex items-center justify-center py-20">
            <p className="text-[15px] text-muted-foreground">Uygun masa bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredTables.map((table) => (
              <MoveTableCard
                key={table.id}
                table={table}
                currentUser={currentUser}
                onClick={() => handleSelectTarget(table.id)}
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={isTargetOccupied ? "Masaları Birleştir" : "Masayı Taşı"}
        message={
          isTargetOccupied
            ? `${fromTable?.name} siparişleri ${selectedTarget?.name} masasıyla birleştirilecek. Adisyonlar birleşik görünecektir. Devam etmek istiyor musunuz?`
            : `${fromTable?.name} masasını ${selectedTarget?.name} masasına taşımak istediğinize emin misiniz?`
        }
        confirmText={isTargetOccupied ? "Birleştir" : "Taşı"}
        cancelText="Vazgeç"
        loading={isSubmitting}
        onConfirm={() => void handleMoveConfirmed()}
        onCancel={() => {
          if (isSubmitting) return
          setShowConfirm(false)
          setSelectedTargetId(null)
        }}
      />
    </div>
  )
}

function MoveTableCard({
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
          ? "bg-[#2563eb] text-white opacity-75"
          : isBillRequested
            ? "bg-[#0a84ff] text-white opacity-75"
            : isOccupied
              ? "bg-[#e63462] text-white shadow-md shadow-[#e63462]/20"
              : "bg-card text-card-foreground shadow-sm"
      }`}
    >
      <div className={`w-10 h-1 rounded-full mb-1.5 ${isOccupied || lockedByOther ? "bg-white/30" : "bg-muted"}`} />
      <span className="font-semibold text-[13px]">{table.name}</span>
      {lockedByOther ? (
        <>
          <Lock className="h-3.5 w-3.5 text-white/80 mt-1" />
          <span className="text-[11px] font-medium text-white/90 mt-auto truncate max-w-full">
            {table.lockedByStaffName || "Kilitli"}
          </span>
        </>
      ) : isBillRequested ? (
        <span className="text-[11px] font-semibold text-white/90 mt-auto">Hesap Kesiliyor</span>
      ) : isOccupied ? (
        <>
          <Merge className="h-3.5 w-3.5 text-white/60 mt-0.5" />
          <span className="text-[11px] font-medium text-white/80 mt-0.5">
            {"₺"}{formatCurrency(table.currentTotal)}
          </span>
          <div className="flex items-center justify-between w-full text-[11px] text-white/60 mt-auto pt-0.5">
            <span className="capitalize truncate">{table.activeWaiter}</span>
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
