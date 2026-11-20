import { useState } from "react"
import { MapPin, Phone, Search, X, Instagram, MessageCircle, Globe } from "lucide-react"
import { applyCfImageFallback, type MenuProduct, type MenuResponse } from "@/lib/api"
import type { MenuWidgetTheme } from "./waiter-call-modal"
import { ProductMetaTags } from "./menu-template-shared"

export { CampaignsModal } from "./campaigns-modal"

export type ProductDisplay = MenuProduct & { image?: string }

function sanitizeWhatsappNumber(raw: string): string {
  return raw.replace(/\D/g, "")
}

function sanitizeInstagramHandle(raw: string): string {
  const trimmed = raw.trim()
  const withoutUrl = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
  return withoutUrl.replace(/^@/, "").replace(/\/+$/, "")
}

function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  return `https://${trimmed}`
}

export function ContactPopover(props: {
  business: MenuResponse
  showContact: boolean
  onToggle: () => void
  onClose: () => void
  theme?: MenuWidgetTheme
  hasWaiterCall?: boolean
}) {
  const { business, showContact, onToggle, onClose, theme = "light", hasWaiterCall = false } = props
  const whatsappDigits = business.whatsapp ? sanitizeWhatsappNumber(business.whatsapp) : ""
  const instagramHandle = business.instagram ? sanitizeInstagramHandle(business.instagram) : ""
  const hasAnyContact = Boolean(
    business.phone || whatsappDigits || instagramHandle || business.facebook || business.website || business.address
  )

  if (!hasAnyContact) return null

  const isDark = theme === "dark"

  const closedFabClass =
    theme === "dark"
      ? "bg-[#16161D] text-amber-300 border border-amber-400/35 shadow-black/60 hover:border-amber-400/70 hover:scale-105"
      : theme === "editorial"
        ? "bg-[#8C2D19] text-[#F6F1E7] shadow-[#8C2D19]/35 hover:bg-[#732312] hover:scale-105"
        : "bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-rose-500/40 hover:shadow-rose-500/60 hover:scale-105"

  const openFabClass = isDark
    ? "bg-[#22222C] text-amber-300 border border-white/15 rotate-45 shadow-black/50"
    : "bg-stone-900 text-white rotate-45 shadow-stone-900/30"

  const itemHoverClass = isDark ? "hover:bg-white/[0.06]" : "hover:bg-stone-50"
  const itemTitleClass = isDark ? "text-[#F5F2EB]" : "text-stone-900"
  const itemSubClass = isDark ? "text-stone-400" : "text-stone-500"

  return (
    <>
      <div className={`fixed ${hasWaiterCall ? "bottom-24" : "bottom-6"} right-6 z-[70] transition-all duration-200`}>
        <div
          role="dialog"
          aria-label="İletişim Bilgileri"
          aria-hidden={!showContact}
          className={`absolute bottom-16 right-0 w-68 rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 origin-bottom-right ${
            isDark ? "bg-[#16161D] border-white/10" : "bg-white border-stone-100"
          } ${
            showContact
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4 pointer-events-none"
          }`}
        >
          <div
            className={`p-4 border-b ${
              isDark
                ? "border-white/10 bg-gradient-to-r from-amber-500/15 to-yellow-500/5"
                : "border-stone-100 bg-gradient-to-r from-rose-50 to-orange-50"
            }`}
          >
            <h3 className={`font-semibold ${itemTitleClass}`}>İletişim</h3>
            <p className={`text-xs mt-0.5 ${itemSubClass}`}>Bize ulaşın</p>
          </div>
          <div className="p-2 max-h-80 overflow-y-auto">
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${itemHoverClass}`}
              >
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center shadow-md shadow-green-500/25 flex-shrink-0">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium group-hover:text-green-500 transition-colors ${itemTitleClass}`}>Telefon</p>
                  <p className={`text-xs truncate ${itemSubClass}`}>{business.phone}</p>
                </div>
              </a>
            )}
            {whatsappDigits && (
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${itemHoverClass}`}
              >
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center shadow-md shadow-[#25D366]/25 flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium group-hover:text-[#25D366] transition-colors ${itemTitleClass}`}>WhatsApp</p>
                  <p className={`text-xs ${itemSubClass}`}>Mesaj gönder</p>
                </div>
              </a>
            )}
            {instagramHandle && (
              <a
                href={`https://instagram.com/${encodeURIComponent(instagramHandle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${itemHoverClass}`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-md shadow-pink-500/25 flex-shrink-0">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium group-hover:text-pink-500 transition-colors ${itemTitleClass}`}>Instagram</p>
                  <p className={`text-xs truncate ${itemSubClass}`}>@{instagramHandle}</p>
                </div>
              </a>
            )}
            {business.website && (
              <a
                href={normalizeExternalUrl(business.website)}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${itemHoverClass}`}
              >
                <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center shadow-md flex-shrink-0">
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${itemTitleClass}`}>Web Sitesi</p>
                  <p className={`text-xs truncate ${itemSubClass}`}>{business.website}</p>
                </div>
              </a>
            )}
            {business.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${itemHoverClass}`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/25 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium group-hover:text-blue-500 transition-colors ${itemTitleClass}`}>Konum</p>
                  <p className={`text-xs truncate ${itemSubClass}`}>{business.address.split(",")[0]}</p>
                </div>
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={showContact ? "İletişim menüsünü kapat" : "İletişim bilgileri"}
          aria-expanded={showContact}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
            showContact ? openFabClass : closedFabClass
          }`}
        >
          {showContact ? <X className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
        </button>
      </div>
      {showContact && (
        <div className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[3px]" onClick={onClose} />
      )}
    </>
  )
}

export function MenuSearchOverlay(props: {
  searchQuery: string
  filteredProducts: ProductDisplay[]
  formatCurrency: (n: number) => string
  onSearchQueryChange: (value: string) => void
  onSelectProduct: (product: ProductDisplay) => void
  onClose: () => void
  theme?: MenuWidgetTheme
}) {
  const {
    searchQuery,
    filteredProducts,
    formatCurrency,
    onSearchQueryChange,
    onSelectProduct,
    onClose,
    theme = "light",
  } = props

  const isDark = theme === "dark"
  const metaVariant = isDark ? "noir" : theme === "editorial" ? "editorial" : "classic"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ürün Arama"
      className={`fixed inset-0 z-[100] ${
        isDark
          ? "bg-[#0B0B0E] text-[#F5F2EB]"
          : theme === "editorial"
            ? "bg-[#F6F1E7] text-[#1C1917]"
            : "bg-white text-stone-900"
      }`}
    >
      <div className="flex flex-col h-full max-w-2xl mx-auto">
        <div className={`flex items-center gap-3 p-4 border-b ${isDark ? "border-white/10" : "border-stone-200/70"}`}>
          <div
            className={`flex-1 flex items-center gap-3 h-11 px-4 rounded-xl ${
              isDark
                ? "bg-white/[0.06] border border-white/10"
                : theme === "editorial"
                  ? "bg-[#EAE3D5] border border-[#1C1917]/15"
                  : "bg-stone-100"
            }`}
          >
            <Search className={`w-4 h-4 ${isDark ? "text-amber-300/70" : "text-stone-400"}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Ürün ara..."
              autoFocus
              className={`flex-1 bg-transparent text-sm focus:outline-none ${
                isDark ? "text-[#F5F2EB] placeholder:text-stone-500" : "text-stone-900 placeholder:text-stone-400"
              }`}
            />
            {searchQuery && (
              <button type="button" onClick={() => onSearchQueryChange("")} aria-label="Temizle">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`text-sm font-medium px-2 py-2 ${isDark ? "text-amber-300" : "text-stone-600"}`}
          >
            İptal
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {searchQuery.trim() ? (
            filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className={isDark ? "text-stone-300 font-medium" : "text-stone-500 font-medium"}>Sonuç bulunamadı</p>
                <p className="text-stone-400 text-xs mt-1">Farklı bir ürün adı ile tekrar deneyin.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    disabled={!product.inStock}
                    onClick={() => {
                      if (product.inStock) {
                        onSelectProduct(product)
                        onClose()
                      }
                    }}
                    className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${
                      isDark
                        ? "bg-[#15151B] border-white/[0.08] hover:border-amber-400/40"
                        : theme === "editorial"
                          ? "bg-[#EFE9DC] border-[#1C1917]/15 hover:bg-[#E7DFCF]"
                          : "bg-white border-stone-100 hover:bg-stone-50"
                    } ${product.inStock ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold truncate ${isDark ? "text-[#F5F2EB]" : "text-stone-900"}`}>
                          {product.name}
                        </h3>
                        {!product.inStock && (
                          <span className="text-[10px] font-medium text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                            Tükendi
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-xs text-stone-400 truncate mt-0.5">{product.description}</p>
                      )}
                      <ProductMetaTags product={product} variant={metaVariant} className="mt-1.5" />
                      <p
                        className={`text-sm font-bold mt-1.5 ${
                          isDark ? "text-amber-300" : theme === "editorial" ? "text-[#8C2D19]" : "text-stone-900"
                        }`}
                      >
                        {formatCurrency(product.price)} TL
                      </p>
                    </div>
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const el = e.currentTarget
                          applyCfImageFallback(el, () => {
                            el.style.display = "none"
                          })
                        }}
                        className="w-14 h-14 rounded-xl object-cover bg-stone-200/50 flex-shrink-0"
                      />
                    )}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <p className="text-stone-400 text-sm">Aramaya başlayın</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProductDetailModal(props: {
  product: ProductDisplay
  formatCurrency: (n: number) => string
  onClose: () => void
  theme?: MenuWidgetTheme
}) {
  const { product, formatCurrency, onClose, theme = "light" } = props
  const [imgFailed, setImgFailed] = useState(false)
  const isDark = theme === "dark"
  const hasCalories = typeof product.calories === "number" && product.calories > 0
  const allergens =
    Array.isArray(product.allergens) && product.allergens.length > 0 ? product.allergens : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto shadow-2xl ${
          isDark
            ? "bg-[#15151C] text-[#F5F2EB] border border-white/10"
            : theme === "editorial"
              ? "bg-[#F6F1E7] text-[#1C1917] border border-[#1C1917]/15"
              : "bg-white text-stone-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className={`w-10 h-1 rounded-full ${isDark ? "bg-white/20" : "bg-stone-300"}`} />
        </div>
        {product.image && !imgFailed && (
          <div className="w-full aspect-video bg-stone-900/10 overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              decoding="async"
              onError={(e) => applyCfImageFallback(e.currentTarget, () => setImgFailed(true))}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className={`text-xl font-bold ${theme === "editorial" ? "font-serif text-2xl" : ""}`}>
              {product.name}
            </h2>
            {hasCalories && (
              <span
                className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                  isDark
                    ? "bg-amber-400/10 text-amber-300 border-amber-400/25"
                    : theme === "editorial"
                      ? "bg-[#EAE2D3] text-[#8C2D19] border-[#8C2D19]/25 font-sans"
                      : "bg-orange-50 text-orange-700 border-orange-200"
                }`}
              >
                {product.calories} kcal
              </span>
            )}
          </div>
          {product.description && (
            <p
              className={`leading-relaxed mb-4 text-sm sm:text-base ${
                isDark ? "text-stone-300" : theme === "editorial" ? "font-serif italic text-[#57534E]" : "text-stone-500"
              }`}
            >
              {product.description}
            </p>
          )}
          {allergens && (
            <div
              className={`mb-5 p-3 rounded-xl border ${
                isDark
                  ? "bg-white/[0.03] border-white/10"
                  : theme === "editorial"
                    ? "bg-[#EFE9DC] border-[#1C1917]/15"
                    : "bg-amber-50/50 border-amber-200/70"
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
                  isDark ? "text-amber-300/80" : theme === "editorial" ? "text-[#8C2D19]" : "text-amber-900/80"
                }`}
              >
                Alerjen Bilgisi
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map((allergen) => (
                  <span
                    key={allergen}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium ${
                      isDark
                        ? "bg-white/[0.06] text-stone-200 border-white/15"
                        : theme === "editorial"
                          ? "bg-[#F6F1E7] text-[#1C1917] border-[#1C1917]/15"
                          : "bg-white text-amber-900 border-amber-200"
                    }`}
                  >
                    {allergen}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div
            className={`flex items-center justify-between pt-4 border-t ${
              isDark ? "border-white/10" : theme === "editorial" ? "border-[#1C1917]/15" : "border-stone-100"
            }`}
          >
            <span
              className={`text-2xl font-bold ${
                isDark ? "text-amber-300" : theme === "editorial" ? "font-serif text-[#8C2D19]" : "text-stone-900"
              }`}
            >
              {formatCurrency(product.price)}{" "}
              <span className={`text-sm font-normal ${isDark ? "text-amber-300/70" : "text-stone-400"}`}>TL</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-3 rounded-xl font-semibold text-sm transition-colors ${
                isDark
                  ? "bg-white/10 text-[#F5F2EB] hover:bg-white/15"
                  : theme === "editorial"
                    ? "bg-[#1C1917] text-[#F6F1E7] hover:bg-stone-800"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
