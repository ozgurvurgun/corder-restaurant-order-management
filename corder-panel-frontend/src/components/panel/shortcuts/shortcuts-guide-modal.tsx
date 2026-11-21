import { useEffect, useMemo, useState } from "react"
import { Keyboard, Search, X } from "lucide-react"
import {
  SHORTCUT_CATALOG,
  SHORTCUT_CATEGORIES,
  type ShortcutCategoryId,
} from "@/lib/shortcuts/shortcut-catalog.policy"

export function ShortcutsGuideModal(props: {
  open: boolean
  onClose: () => void
  onOpenCommandPalette?: () => void
}) {
  const { open, onClose, onOpenCommandPalette } = props
  const [activeCategory, setActiveCategory] = useState<ShortcutCategoryId | "all">("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SHORTCUT_CATEGORIES.map((cat) => {
      const items = SHORTCUT_CATALOG.filter((item) => {
        if (activeCategory !== "all" && item.category !== activeCategory) return false
        if (item.category !== cat.id) return false
        if (!q) return true
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.contextLabel.toLowerCase().includes(q) ||
          item.keys.some((k) => k.toLowerCase().includes(q))
        )
      })
      return { ...cat, items }
    }).filter((group) => group.items.length > 0)
  }, [activeCategory, query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 backdrop-blur-xs p-3.5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[780px] max-h-[88dvh] bg-white rounded-2xl shadow-2xl border border-[#d1d1d6]/70 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#e8e8ed] bg-[#fafafa]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-[#e63462]/10 text-[#e63462] flex items-center justify-center flex-shrink-0">
              <Keyboard className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] truncate">
                  Hızlı Tuşlama &amp; Klavye Kısayolları
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#e63462]/10 text-[#e63462]">
                  {SHORTCUT_CATALOG.length} Kısayol
                </span>
              </div>
              <p className="text-[11.5px] text-[#86868b] truncate">
                Fare kullanmadan klavye ile masa açma, sipariş girme, hesap kesme ve ekranlar arası geçiş
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenCommandPalette()
                }}
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#1d1d1f] text-white text-[11.5px] font-semibold hover:bg-[#3a3a3c] transition-colors"
              >
                <span>Hızlı Komut Paletini Aç</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-mono">
                  Ctrl+K
                </kbd>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] flex items-center justify-center flex-shrink-0"
            >
              <X className="w-4 h-4 text-[#86868b]" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-[#f0f0f0] bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`h-7 px-3 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-colors ${
                activeCategory === "all"
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed]"
              }`}
            >
              Tümü ({SHORTCUT_CATALOG.length})
            </button>
            {SHORTCUT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`h-7 px-3 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? "bg-[#e63462] text-white"
                    : "bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56 flex-shrink-0">
            <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kısayol ara (ör. F1, Hesap, Masa)..."
              className="w-full h-8 pl-8 pr-7 text-[12px] bg-[#f5f5f7] rounded-xl border border-[#d1d1d6]/70 focus:outline-none focus:border-[#e63462] focus:bg-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#86868b]">
              Aramanızla eşleşen kısayol bulunamadı.
            </div>
          ) : (
            filteredCategories.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#1d1d1f]">
                    {group.label}
                  </h4>
                  <span className="text-[11px] text-[#86868b]">{group.description}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] px-3.5 py-2.5 hover:border-[#d1d1d6] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12.5px] font-semibold text-[#1d1d1f] truncate">
                            {item.title}
                          </p>
                          <span className="px-1.5 py-0.5 rounded bg-[#e8e8ed] text-[#636366] text-[9.5px] font-semibold whitespace-nowrap">
                            {item.contextLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#86868b] leading-snug mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.keys.map((k, ki) => (
                          <span key={ki} className="inline-flex items-center gap-1">
                            {ki > 0 && (
                              <span className="text-[10px] font-bold text-[#86868b]">+</span>
                            )}
                            <kbd className="min-w-[26px] h-[26px] px-2 rounded-lg bg-white border border-[#d1d1d6] shadow-2xs text-[11px] font-mono font-bold text-[#1d1d1f] inline-flex items-center justify-center">
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e8e8ed] bg-[#fafafa] flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#636366]">
          <span>
            İpucu: Metin veya tutar kutularına yazı yazarken tek harfli kısayollar (<kbd className="px-1.5 py-0.5 rounded bg-white border border-[#d1d1d6] font-mono text-[10px]">N</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#d1d1d6] font-mono text-[10px]">H</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#d1d1d6] font-mono text-[10px]">P</kbd>) otomatik devre dışı kalır.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-xl bg-[#1d1d1f] text-white text-[12px] font-semibold hover:bg-[#3a3a3c]"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  )
}
