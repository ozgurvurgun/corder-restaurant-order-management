import {
  MapPin,
  Phone,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Instagram,
  MessageCircle,
} from "lucide-react"
import { resolveImageUrl, type MenuCampaign, type MenuProduct, type MenuResponse } from "@/lib/api"

export type ProductDisplay = MenuProduct & { image?: string }

export function ContactPopover(props: {
  business: MenuResponse
  showContact: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { business, showContact, onToggle, onClose } = props
  return (
    <>
      <div className="fixed bottom-6 right-6 z-30">
        <div
          className={`absolute bottom-16 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden transition-all duration-300 origin-bottom-right ${showContact
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4 pointer-events-none"
            }`}
        >
          <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-rose-50 to-orange-50">
            <h3 className="font-semibold text-stone-900">İletişim</h3>
            <p className="text-xs text-stone-500 mt-0.5">Bize ulaşın</p>
          </div>
          <div className="p-2">
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-green-600 transition-colors">
                    Telefon
                  </p>
                  <p className="text-xs text-stone-500">{business.phone}</p>
                </div>
              </a>
            )}
            {business.whatsapp && (
              <a
                href={`https://wa.me/${business.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-[#25D366] transition-colors">
                    WhatsApp
                  </p>
                  <p className="text-xs text-stone-500">Mesaj gönder</p>
                </div>
              </a>
            )}
            {business.instagram && (
              <a
                href={`https://instagram.com/${business.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/30">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-pink-500 transition-colors">
                    Instagram
                  </p>
                  <p className="text-xs text-stone-500">@{business.instagram}</p>
                </div>
              </a>
            )}
            {business.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
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
          onClick={onToggle}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${showContact
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
    <div className="fixed inset-0 z-[100] bg-white">
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
              <button onClick={() => onSearchQueryChange("")} aria-label="Temizle">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-stone-600 text-sm font-medium">
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
                  <div
                    key={product.id}
                    onClick={() => {
                      if (product.inStock) {
                        onSelectProduct(product)
                        onClose()
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border border-stone-100 ${product.inStock ? "hover:bg-stone-50 cursor-pointer" : "opacity-50"
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
                      <p className="text-sm font-semibold text-stone-900 mt-1">{formatCurrency(product.price)} TL</p>
                    </div>
                    {product.image && (
                      <img src={product.image} alt={product.name} className="w-14 h-14 rounded-lg object-cover bg-stone-100 flex-shrink-0" />
                    )}
                  </div>
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
  return (
    <div
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
        {product.image && (
          <div className="w-full aspect-video bg-stone-100">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
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

export function CampaignsModal(props: {
  campaigns: MenuCampaign[]
  activeIndex: number
  formatCurrency: (n: number) => string
  onChangeIndex: (index: number) => void
  onClose: () => void
}) {
  const { campaigns, activeIndex, formatCurrency, onChangeIndex, onClose } = props
  const currentCampaign = campaigns[activeIndex]
  if (!currentCampaign) return null
  const currentImgUrl = resolveImageUrl(currentCampaign.imageUrl)

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {campaigns.map((campaign, index) => {
          const offset = index - activeIndex
          const isVisible = offset >= 0 && offset <= 2
          if (!isVisible || index === activeIndex) return null
          const imgUrl = resolveImageUrl(campaign.imageUrl)
          return (
            <div
              key={campaign.id}
              className="absolute inset-0 bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300"
              style={{
                transform: `translateY(${offset * 12}px) scale(${1 - offset * 0.05}) rotate(${offset * 2}deg)`,
                opacity: 1 - offset * 0.3,
                zIndex: 10 - offset,
              }}
            >
              <div className="aspect-[4/3] bg-stone-100">
                {imgUrl && <img src={imgUrl} alt={campaign.title} className="w-full h-full object-cover" />}
              </div>
            </div>
          )
        })}
        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden z-20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative aspect-[4/3] bg-stone-100">
            {currentImgUrl && (
              <img src={currentImgUrl} alt={currentCampaign.title} className="w-full h-full object-cover" />
            )}
            {currentCampaign.discountPercent && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg">
                %{currentCampaign.discountPercent} İndirim
              </div>
            )}
          </div>
          <div className="p-5">
            <h2 className="text-xl font-bold text-stone-900 mb-2">{currentCampaign.title}</h2>
            {currentCampaign.description && (
              <p className="text-stone-500 text-sm mb-4">{currentCampaign.description}</p>
            )}
            {(currentCampaign.originalPrice || currentCampaign.discountedPrice) && (
              <div className="flex items-center gap-3 mb-4">
                {currentCampaign.discountedPrice && (
                  <span className="text-2xl font-bold text-rose-500">
                    {formatCurrency(currentCampaign.discountedPrice)} TL
                  </span>
                )}
                {currentCampaign.originalPrice && currentCampaign.discountedPrice && (
                  <span className="text-lg text-stone-400 line-through">
                    {formatCurrency(currentCampaign.originalPrice)} TL
                  </span>
                )}
              </div>
            )}
            {currentCampaign.validUntil && (
              <p className="text-xs text-stone-400 mb-4">
                Geçerlilik: {new Date(currentCampaign.validUntil).toLocaleDateString("tr-TR")}
              </p>
            )}
            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2">
                {campaigns.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => onChangeIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${idx === activeIndex ? "w-6 bg-rose-500" : "bg-stone-300 hover:bg-stone-400"
                      }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {activeIndex > 0 && (
                  <button
                    onClick={() => onChangeIndex(activeIndex - 1)}
                    className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() =>
                    activeIndex < campaigns.length - 1 ? onChangeIndex(activeIndex + 1) : onClose()
                  }
                  className="h-10 px-5 rounded-full bg-stone-900 text-white font-medium text-sm hover:bg-stone-800 transition-colors flex items-center gap-2"
                >
                  {activeIndex < campaigns.length - 1 ? (
                    <>
                      Sonraki
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    "Menüye Git"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        {campaigns.length > 1 && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">
            {activeIndex + 1} / {campaigns.length}
          </div>
        )}
      </div>
    </div>
  )
}
