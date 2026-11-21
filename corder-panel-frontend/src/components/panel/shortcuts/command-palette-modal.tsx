import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  Command,
  Keyboard,
  LayoutGrid,
  MapPin,
  Search,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { formatCurrency } from "@/lib/format"
import type { PanelViewId } from "@/lib/panel-types"
import { VIEW_SHORTCUT_BADGES } from "@/lib/shortcuts/shortcut-catalog.policy"
import { emitSelectTableCommand } from "@/lib/shortcuts/panel-shortcut-bus"

interface PaletteCommandItem {
  id: string
  kind: "table" | "screen" | "action"
  title: string
  subtitle: string
  badge?: string
  shortcutHint?: string
  isOccupied?: boolean
  execute: () => void
}

const SCREEN_ENTRIES: Array<{
  view: PanelViewId
  title: string
  subtitle: string
}> = [
  { view: "dashboard", title: "Ana Sayfa", subtitle: "Günlük özet ve canlı metrikler" },
  { view: "tables", title: "Masalar", subtitle: "Salon ve bölge masa planı" },
  { view: "quick-sale", title: "Hızlı Satış", subtitle: "Tezgah ve paket hızlı satış ekranı" },
  { view: "live-orders", title: "Tamamlanan Siparişler", subtitle: "Kapanmış adisyonlar ve geçmiş" },
  { view: "cash-register", title: "Kasa & Vardiya", subtitle: "Kasa özeti, gelir/gider, cariler ve X/Z" },
  { view: "products", title: "Ürün Yönetimi", subtitle: "Kategori ve menü ürünleri" },
  { view: "stock", title: "Stok & Reçete", subtitle: "Hammadde, reçete ve stok hareketleri" },
  { view: "reports", title: "Raporlar", subtitle: "Finansal ve operasyonel analiz" },
  { view: "settings", title: "Ayarlar", subtitle: "Restoran, masa, QR ve gün sonu ayarları" },
  { view: "users", title: "Personel & Yetkiler", subtitle: "Personel hesapları ve rol izinleri" },
  { view: "campaigns", title: "Kampanyalar", subtitle: "İndirim ve promosyon yönetimi" },
  { view: "technical", title: "Teknik & Yazıcılar", subtitle: "Termal yazıcılar ve denetim kayıtları" },
]

export function CommandPaletteModal(props: {
  open: boolean
  onClose: () => void
  onNavigate: (view: PanelViewId) => void
  isViewAllowed: (view: PanelViewId) => boolean
  onOpenShortcutsGuide: () => void
}) {
  const { open, onClose, onNavigate, isViewAllowed, onOpenShortcutsGuide } = props
  const { tables } = usePanelStore()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo<PaletteCommandItem[]>(() => {
    const q = query.trim().toLowerCase()
    const sortedTables = [...tables].sort((a, b) => {
      if (a.status !== "empty" && b.status === "empty") return -1
      if (a.status === "empty" && b.status !== "empty") return 1
      return a.name.localeCompare(b.name, "tr", { numeric: true, sensitivity: "base" })
    })

    const tableItems: PaletteCommandItem[] = sortedTables
      .filter((t) => {
        if (!q) return true
        return (
          t.name.toLowerCase().includes(q) ||
          t.section.toLowerCase().includes(q) ||
          (t.waiter || "").toLowerCase().includes(q)
        )
      })
      .slice(0, q ? 20 : 8)
      .map((t) => {
        const occupied = t.status !== "empty"
        return {
          id: `table:${t.id}`,
          kind: "table",
          title: `${t.name} (${t.section})`,
          subtitle: occupied
            ? `Dolu · ${t.orderCount} adisyon${t.waiter ? ` · Garson: ${t.waiter}` : ""}`
            : "Boş Masa · Sipariş girmek için aç",
          badge: occupied ? `₺${formatCurrency(t.totalAmount)}` : "Boş",
          isOccupied: occupied,
          execute: () => {
            onClose()
            onNavigate("tables")
            setTimeout(() => emitSelectTableCommand(t.id), 20)
          },
        }
      })

    const screenItems: PaletteCommandItem[] = SCREEN_ENTRIES.filter(
      (s) =>
        isViewAllowed(s.view) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.subtitle.toLowerCase().includes(q)),
    ).map((s) => ({
      id: `screen:${s.view}`,
      kind: "screen",
      title: `${s.title} Ekranına Git`,
      subtitle: s.subtitle,
      shortcutHint: VIEW_SHORTCUT_BADGES[s.view],
      execute: () => {
        onClose()
        onNavigate(s.view)
      },
    }))

    const actionItems: PaletteCommandItem[] = [
      {
        id: "action:shortcuts-guide",
        kind: "action" as const,
        title: "Klavye Kısayolları Rehberini Aç",
        subtitle: "Tüm hızlı tuşlama kombinasyonlarını görüntüle",
        shortcutHint: "?",
        execute: () => {
          onClose()
          onOpenShortcutsGuide()
        },
      },
    ].filter(
      (a) =>
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q),
    )

    return [...tableItems, ...screenItems, ...actionItems]
  }, [tables, query, isViewAllowed, onClose, onNavigate, onOpenShortcutsGuide])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          items.length > 0 ? (prev - 1 + items.length) % items.length : 0,
        )
      } else if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault()
        items[selectedIndex].execute()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, items, selectedIndex, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10030] flex items-start justify-center bg-black/45 backdrop-blur-xs pt-[10dvh] p-3.5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] bg-white rounded-2xl shadow-2xl border border-[#d1d1d6]/70 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#e8e8ed]">
          <Search className="w-4 h-4 text-[#e63462] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Masa adı (ör. B3, Salon 1) veya ekran adı yazıp Enter'a basın..."
            className="flex-1 text-[13.5px] text-[#1d1d1f] placeholder:text-[#86868b] bg-transparent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded-lg text-[#86868b] hover:text-[#1d1d1f]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-2 py-0.5 rounded-md bg-[#f5f5f7] border border-[#d1d1d6] text-[10.5px] font-mono text-[#636366]">
            Esc
          </kbd>
        </div>

        <div className="max-h-[58dvh] overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#86868b]">
              Eşleşen masa veya ekran bulunamadı.
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => item.execute()}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    active ? "bg-[#e63462]/10 text-[#1d1d1f]" : "hover:bg-[#f5f5f7]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.kind === "table"
                          ? item.isOccupied
                            ? "bg-[#e63462] text-white"
                            : "bg-[#f5f5f7] text-[#636366]"
                          : item.kind === "screen"
                            ? "bg-[#1d1d1f] text-white"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.kind === "table" ? (
                        <MapPin className="w-4 h-4" />
                      ) : item.kind === "screen" ? (
                        item.id.includes("cash") ? (
                          <Wallet className="w-4 h-4" />
                        ) : item.id.includes("quick") ? (
                          <ShoppingBag className="w-4 h-4" />
                        ) : (
                          <LayoutGrid className="w-4 h-4" />
                        )
                      ) : (
                        <Keyboard className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#86868b] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11.5px] font-bold ${
                          item.isOccupied
                            ? "bg-[#e63462]/15 text-[#e63462]"
                            : "bg-[#f5f5f7] text-[#86868b]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.shortcutHint && (
                      <kbd className="px-2 py-0.5 rounded-md bg-white border border-[#d1d1d6] text-[10.5px] font-mono font-semibold text-[#1d1d1f]">
                        {item.shortcutHint}
                      </kbd>
                    )}
                    <ArrowRight
                      className={`w-3.5 h-3.5 ${
                        active ? "text-[#e63462]" : "text-[#d1d1d6]"
                      }`}
                    />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[#e8e8ed] bg-[#fafafa] flex items-center justify-between text-[11px] text-[#86868b]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#d1d1d6] font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              Gezin
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#d1d1d6] font-mono text-[10px]">
                Enter
              </kbd>{" "}
              Seç / Aç
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <Command className="w-3 h-3 text-[#e63462]" />
            <span>Hızlı Komut Paleti</span>
          </span>
        </div>
      </div>
    </div>
  )
}
