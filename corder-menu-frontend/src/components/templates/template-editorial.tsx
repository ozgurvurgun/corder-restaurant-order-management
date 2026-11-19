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

function EditorialProductRow(props: {
  product: MenuProduct
  onSelect: (display: ProductDisplay) => void
}) {
  const { product, onSelect } = props
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedImage = resolveImageUrl(product.imageUrl, { width: 180 })
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
      className={`group w-full text-left py-3.5 px-3 -mx-3 rounded-xl transition-colors ${
        product.inStock
          ? "cursor-pointer hover:bg-[#EAE2D3]/70 active:bg-[#E2D9C6]"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start gap-3.5">
        {resolvedImage && !imgFailed && (
          <div className="w-14 h-14 rounded-full bg-[#E5DEC9] overflow-hidden flex-shrink-0 ring-1 ring-[#1C1917]/15 shadow-2xs mt-0.5">
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
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif font-bold text-base sm:text-[17px] text-[#1C1917] tracking-tight">
              {product.name}
            </h3>
            {!product.inStock && (
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#8C2D19] bg-[#8C2D19]/10 px-2 py-0.5 rounded">
                Tükendi
              </span>
            )}
            <span
              aria-hidden="true"
              className="flex-1 border-b-2 border-dotted border-[#1C1917]/25 min-w-[24px] translate-y-[-3px]"
            />
            <span className="font-serif font-bold text-base sm:text-[17px] text-[#8C2D19] flex-shrink-0">
              {formatMenuPrice(product.price)}{" "}
              <span className="text-xs font-normal text-[#57534E]">TL</span>
            </span>
          </div>
          {product.description && (
            <p className="font-serif italic text-xs sm:text-sm text-[#57534E] line-clamp-2 leading-relaxed mt-1 pr-6">
              {product.description}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

function EditorialSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay) => void
}) {
  const { category: cat, onSelectProduct } = props
  if (!categoryHasProducts(cat)) return null
  return (
    <div className="mt-9">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-serif italic font-semibold text-lg text-[#1C1917]">{cat.name}</h3>
        <div className="flex-1 h-px bg-[#1C1917]/15" />
      </div>
      {cat.products.length > 0 && (
        <div className="divide-y divide-[#1C1917]/10 mb-4">
          {cat.products.map((product) => (
            <EditorialProductRow
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
      {(cat.children ?? []).map((child) => (
        <EditorialSubcategoryBlock
          key={child.id}
          category={child}
          onSelectProduct={onSelectProduct}
        />
      ))}
    </div>
  )
}

export function EditorialMenuTemplate(props: MenuTemplateProps) {
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
    <div className="min-h-dvh bg-[#F6F1E7] text-[#1C1917] flex flex-col">
      <header className="px-5 pt-7 pb-5 border-b border-[#1C1917]/15">
        <div className="max-w-2xl mx-auto text-center">
          {activeCampaigns.length > 0 && (
            <div className="flex items-center justify-center gap-2.5 mb-4 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenCampaigns(0)}
                aria-label="Kampanyaları Gör"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8C2D19] text-[#F6F1E7] text-xs font-medium hover:bg-[#732312] transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Günün Seçkisi ({activeCampaigns.length})</span>
              </button>
            </div>
          )}

          <div className="border-y border-[#1C1917]/20 py-5 px-3">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#1C1917] text-[#F6F1E7] flex items-center justify-center ring-4 ring-[#1C1917]/10 overflow-hidden">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={business.name}
                  onError={(e) => applyCfImageFallback(e.currentTarget, onLogoError)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-serif text-2xl font-bold">{business.name.charAt(0)}</span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#57534E] mb-1">
              Gastronomi & Seçki Menüsü
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1917]">
              {business.name}
            </h1>
            {(business.workingHours || business.address) && (
              <div className="flex items-center justify-center gap-4 mt-2.5 text-xs text-[#57534E] flex-wrap">
                {business.workingHours && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#8C2D19]" />
                    {business.workingHours}
                  </span>
                )}
                {business.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#8C2D19]" />
                    {business.address.split(",")[0]}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 bg-[#F6F1E7]/95 backdrop-blur-md border-b border-[#1C1917]/15">
        <div className="max-w-2xl mx-auto">
          <div className="px-5 py-2.5">
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 h-10 px-3.5 bg-[#EFE9DC] border border-[#1C1917]/15 rounded-lg text-[#57534E] hover:border-[#1C1917]/35 transition-colors"
            >
              <Search className="w-4 h-4 text-[#8C2D19]" />
              <span className="font-serif italic text-sm">Menüde yemek veya içecek ara...</span>
            </button>
          </div>
          {roots.length > 0 && (
            <div className="overflow-x-auto scrollbar-hide" role="tablist" aria-label="Menü Kategorileri">
              <div className="flex gap-1.5 px-5 pb-2.5">
                {roots.map((cat) => {
                  const isSelected = activeRoot?.id === cat.id
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      key={cat.id}
                      onClick={(e) => onSelectCategory(cat.id, e.currentTarget)}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-md font-serif text-sm font-semibold transition-all ${
                        isSelected
                          ? "bg-[#1C1917] text-[#F6F1E7] shadow-2xs"
                          : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EAE2D3]"
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

      <main className="max-w-2xl w-full mx-auto px-5 py-7 flex-1">
        {!hasTreeContent ? (
          <div className="text-center py-16">
            <p className="font-serif italic text-[#57534E]">Bu menüde henüz ürün bulunmuyor.</p>
          </div>
        ) : !activeRoot ? null : !categoryHasProducts(activeRoot) ? (
          <div className="text-center py-16">
            <p className="font-serif font-semibold text-[#1C1917]">Ürün bulunamadı</p>
            <p className="font-serif italic text-[#57534E] text-sm mt-1">
              Bu kategoride henüz ürün yok.
            </p>
          </div>
        ) : (
          <div key={activeRoot.id} className="mb-10">
            <div className="border-b-2 border-[#1C1917] pb-2 mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#1C1917]">
                {activeRoot.name}
              </h2>
              <span className="text-[11px] uppercase tracking-widest text-[#8C2D19] font-semibold">
                Seçki
              </span>
            </div>
            {activeRoot.products.length > 0 && (
              <div className="divide-y divide-[#1C1917]/10 mb-6">
                {activeRoot.products.map((product) => (
                  <EditorialProductRow
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                  />
                ))}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <EditorialSubcategoryBlock
                key={sub.id}
                category={sub}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 pt-4 pb-24 text-center border-t border-[#1C1917]/15 bg-[#F6F1E7]">
        <p className="font-serif italic text-xs text-[#57534E]">
          Tüm fiyatlarımıza KDV dahildir. Afiyet olsun.
        </p>
      </footer>
    </div>
  )
}
