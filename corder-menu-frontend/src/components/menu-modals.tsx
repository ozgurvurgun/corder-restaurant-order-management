import { useState } from "react"
import {
  MapPin,
  Phone,
  Search,
  X,
  Instagram,
  MessageCircle,
  Globe,
} from "lucide-react"
import type { MenuProduct, MenuResponse } from "@/lib/api"

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
}) {
  const { business, showContact, onToggle, onClose } = props
  const whatsappDigits = business.whatsapp ? sanitizeWhatsappNumber(business.whatsapp) : ""
  const instagramHandle = business.instagram ? sanitizeInstagramHandle(business.instagram) : ""
  const hasAnyContact = Boolean(
    business.phone ||
      whatsappDigits ||
      instagramHandle ||
      business.facebook ||
      business.website ||
      business.address
  )

  if (!hasAnyContact) return null

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30">
        <div
          role="dialog"
          aria-label="İletişim Bilgileri"
          aria-hidden={!showContact}
          className={`absolute bottom-16 right-0 w-68 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden transition-all duration-300 origin-bottom-right ${
            showContact
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-rose-50 to-orange-50">
            <h3 className="font-semibold text-stone-900">İletişim</h3>
            <p className="text-xs text-stone-500 mt-0.5">Bize ulaşın</p>
          </div>
          <div className="p-2 max-h-80 overflow-y-auto">
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center shadow-md shadow-green-500/25 flex-shrink-0">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-green-600 transition-colors">
                    Telefon
                  </p>
                  <p className="text-xs text-stone-500 truncate">{business.phone}</p>
                </div>
              </a>
            )}
            {whatsappDigits && (
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center shadow-md shadow-[#25D366]/25 flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-[#25D366] transition-colors">
                    WhatsApp
                  </p>
                  <p className="text-xs text-stone-500">Mesaj gönder</p>
                </div>
              </a>
            )}
            {instagramHandle && (
              <a
                href={`https://instagram.com/${encodeURIComponent(instagramHandle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-md shadow-pink-500/25 flex-shrink-0">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-pink-500 transition-colors">
                    Instagram
                  </p>
                  <p className="text-xs text-stone-500 truncate">@{instagramHandle}</p>
                </div>
              </a>
            )}
            {business.website && (
              <a
                href={normalizeExternalUrl(business.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center shadow-md flex-shrink-0">
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900">Web Sitesi</p>
                  <p className="text-xs text-stone-500 truncate">{business.website}</p>
                </div>
              </a>
            )}
            {business.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/25 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-blue-500 transition-colors">
                    Konum
                  </p>
                  <p className="text-xs text-stone-500 truncate">{business.address.split(",")[0]}</p>
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
            showContact
              ? "bg-stone-900 rotate-45 shadow-stone-900/30"
              : "bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/40 hover:shadow-rose-500/60 hover:scale-105"
          }`}
        >
          {showContact ? <X className="w-6 h-6 text-white" /> : <Phone className="w-6 h-6 text-white" />}
        </button>
      </div>
      {showContact && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
        />
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
}) {
  const {
    searchQuery,
    filteredProducts,
    formatCurrency,
    onSearchQueryChange,
    onSelectProduct,
    onClose,
  } = props

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ürün Arama"
      className="fixed inset-0 z-[100] bg-white"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-stone-100">
          <div className="flex-1 flex items-center gap-3 h-11 px-4 bg-stone-100 rounded-xl">
            <Search className="w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Ürün ara..."
              autoFocus
              className="flex-1 bg-transparent text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => onSearchQueryChange("")} aria-label="Temizle">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-stone-600 text-sm font-medium px-1 py-2">
            İptal
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {searchQuery.trim() ? (
            filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-stone-500 font-medium">Sonuç bulunamadı</p>
                <p className="text-stone-400 text-xs mt-1">Farklı bir ürün adı ile tekrar deneyin.</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border border-stone-100 ${
                      product.inStock ? "hover:bg-stone-50 cursor-pointer" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-stone-900 truncate">{product.name}</h3>
                        {!product.inStock && (
                          <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            Tükendi
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-xs text-stone-400 truncate mt-0.5">{product.description}</p>
                      )}
                      <p className="text-sm font-semibold text-stone-900 mt-1">
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
                          e.currentTarget.style.display = "none"
                        }}
                        className="w-14 h-14 rounded-lg object-cover bg-stone-100 flex-shrink-0"
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
}) {
  const { product, formatCurrency, onClose } = props
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-stone-200" />
        </div>
        {product.image && !imgFailed && (
          <div className="w-full aspect-video bg-stone-100">
            <img
              src={product.image}
              alt={product.name}
              decoding="async"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-6">
          <h2 className="text-xl font-bold text-stone-900 mb-2">{product.name}</h2>
          {product.description && (
            <p className="text-stone-500 leading-relaxed mb-6">{product.description}</p>
          )}
          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <span className="text-2xl font-bold text-stone-900">
              {formatCurrency(product.price)}{" "}
              <span className="text-sm font-normal text-stone-400">TL</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
