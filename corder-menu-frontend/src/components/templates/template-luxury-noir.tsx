import { useState } from "react"
import { Clock, MapPin, Search, Sparkles } from "lucide-react"
import {
  applyCfImageFallback,
  formatMenuPrice,
  resolveImageUrl,
  type MenuCategory,
  type MenuProduct,
} from "@/lib/api"
import type { ProductDisplay } from "../menu-modals"
import {
  categoryHasProducts,
  type MenuTemplateProps,
} from "../menu-template-shared"

function LuxuryNoirProductItem(props: {
  product: MenuProduct
  onSelect: (display: ProductDisplay) => void
}) {
  const { product, onSelect } = props
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedImage = resolveImageUrl(product.imageUrl, { width: 280 })
  const display: ProductDisplay = {
    ...product,
    image: imgFailed ? undefined : resolveImageUrl(product.imageUrl),
  }

  return (
    <button
      type="button"
      disabled={!product.inStock}
      aria-disabled={!product.inStock}
      onClick={() => product.inStock && onSelect(display)}
      className={`group w-full text-left bg-[#15151B] rounded-2xl p-4 border border-white/[0.07] shadow-lg shadow-black/40 transition-all ${
        product.inStock
          ? "cursor-pointer hover:border-amber-400/40 hover:bg-[#191922] active:scale-[0.99]"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-semibold text-[#F5F2EB] text-base tracking-tight group-hover:text-amber-200 transition-colors">
              {product.name}
            </h3>
            {!product.inStock && (
              <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                Tükendi
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-xs sm:text-sm text-stone-400 line-clamp-2 leading-relaxed mb-3">
              {product.description}
            </p>
          )}
          <div className="inline-flex items-baseline gap-1">
            <span className="text-base font-semibold text-amber-300 tracking-wide">
              {formatMenuPrice(product.price)}
            </span>
            <span className="text-xs font-medium text-amber-400/70">TL</span>
          </div>
        </div>
        {resolvedImage && !imgFailed && (
          <div className="w-24 h-24 rounded-2xl bg-[#1E1E26] overflow-hidden flex-shrink-0 ring-1 ring-white/10 group-hover:ring-amber-400/30 transition-all">
            <img
              src={resolvedImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={(e) => applyCfImageFallback(e.currentTarget, () => setImgFailed(true))}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
      </div>
    </button>
  )
}

function LuxuryNoirSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay) => void
}) {
  const { category: cat, onSelectProduct } = props
  if (!categoryHasProducts(cat)) return null
  return (
    <div className="mt-9">
      <div className="flex items-center gap-3 mb-3.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-amber-300/90">
          {cat.name}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      </div>
      {cat.products.length > 0 && (
        <div className="space-y-3.5 mb-4">
          {cat.products.map((product) => (
            <LuxuryNoirProductItem
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
      {(cat.children ?? []).map((child) => (
        <LuxuryNoirSubcategoryBlock
          key={child.id}
          category={child}
          onSelectProduct={onSelectProduct}
        />
      ))}
    </div>
  )
}

export function LuxuryNoirMenuTemplate(props: MenuTemplateProps) {
  const {
    business,
    logoUrl,
    logoFailed,
    onLogoError,
    activeCampaigns,
    roots,
    activeRoot,
    hasTreeContent,
    onSelectCategory,
    onSelectProduct,
    onOpenSearch,
    onOpenCampaigns,
  } = props

  return (
    <div className="min-h-dvh bg-[#0B0B0E] text-[#F5F2EB] flex flex-col">
      <header className="relative overflow-hidden border-b border-white/[0.08] bg-[#0F0F14]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.18),_transparent_70%)]"
        />
        <div className="relative max-w-2xl mx-auto px-5 pt-7 pb-6">
          {activeCampaigns.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenCampaigns(0)}
                aria-label="Kampanyaları Gör"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/35 text-amber-300 text-xs font-semibold hover:bg-amber-400/20 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Özel Fırsatlar ({activeCampaigns.length})</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 flex items-center justify-center shadow-xl shadow-black/70 ring-1 ring-amber-300/40 flex-shrink-0 overflow-hidden">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={business.name}
                  onError={(e) => applyCfImageFallback(e.currentTarget, onLogoError)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-stone-950">{business.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/80 mb-0.5">
                Lounge & Signature Menu
              </p>
              <h1 className="text-2xl font-bold text-[#F5F2EB] tracking-tight truncate">
                {business.name}
              </h1>
              <div className="flex items-center gap-3.5 mt-1.5 text-xs text-stone-400 flex-wrap">
                {business.workingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
                    {business.workingHours}
                  </span>
                )}
                {business.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
                    {business.address.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 bg-[#121217]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto">
          <div className="px-5 py-3">
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 h-11 px-4 bg-white/[0.04] border border-white/10 rounded-xl text-stone-400 hover:border-amber-400/35 transition-colors"
            >
              <Search className="w-4 h-4 text-amber-300/80" />
              <span className="text-sm">Menüde lezzet ara...</span>
            </button>
          </div>
          {roots.length > 0 && (
            <div className="overflow-x-auto scrollbar-hide" role="tablist" aria-label="Menü Kategorileri">
              <div className="flex gap-2 px-5 pb-3">
                {roots.map((cat) => {
                  const isSelected = activeRoot?.id === cat.id
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      key={cat.id}
                      onClick={(e) => onSelectCategory(cat.id, e.currentTarget)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-stone-950 shadow-lg shadow-amber-500/20"
                          : "bg-white/[0.04] text-stone-400 border border-white/[0.07] hover:text-stone-200 hover:border-white/15"
                      }`}
                    >
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-2xl w-full mx-auto px-5 py-6 flex-1">
        {!hasTreeContent ? (
          <div className="text-center py-16">
            <p className="text-stone-500">Bu menüde henüz ürün bulunmuyor.</p>
          </div>
        ) : !activeRoot ? null : !categoryHasProducts(activeRoot) ? (
          <div className="text-center py-16">
            <p className="text-stone-400 font-medium">Ürün bulunamadı</p>
            <p className="text-stone-500 text-sm mt-1">Bu kategoride henüz ürün yok.</p>
          </div>
        ) : (
          <div key={activeRoot.id} className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-[#F5F2EB] tracking-tight">
                {activeRoot.name}
              </h2>
              <span className="h-px flex-1 ml-4 bg-gradient-to-r from-amber-400/30 to-transparent" />
            </div>
            {activeRoot.products.length > 0 && (
              <div className="space-y-3.5 mb-6">
                {activeRoot.products.map((product) => (
                  <LuxuryNoirProductItem
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                  />
                ))}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <LuxuryNoirSubcategoryBlock
                key={sub.id}
                category={sub}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 pt-4 pb-24 text-center border-t border-white/[0.08] bg-[#0B0B0E]">
        <p className="text-xs font-medium text-stone-500">Tüm fiyatlarımıza KDV dahildir.</p>
      </footer>
    </div>
  )
}
