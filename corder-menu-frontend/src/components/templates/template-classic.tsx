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

function ClassicProductItem(props: {
  product: MenuProduct
  onSelect: (display: ProductDisplay) => void
}) {
  const { product, onSelect } = props
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedImage = resolveImageUrl(product.imageUrl, { width: 240 })
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
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-2xs border border-stone-200/70 transition-all ${
        product.inStock
          ? "cursor-pointer hover:shadow-md hover:border-stone-300/90 active:scale-[0.99]"
          : "opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="flex justify-between items-start gap-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-stone-900 text-[15px] leading-snug">
              {product.name}
            </h3>
            {!product.inStock && (
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                Tükendi
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-xs sm:text-sm text-stone-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          <p className="mt-2.5 font-bold text-stone-900 text-[15px]">
            {formatMenuPrice(product.price)}{" "}
            <span className="text-xs font-medium text-stone-400">TL</span>
          </p>
        </div>
        {resolvedImage && !imgFailed && (
          <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden flex-shrink-0 ring-1 ring-black/[0.04]">
            <img
              src={resolvedImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={(e) => applyCfImageFallback(e.currentTarget, () => setImgFailed(true))}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </button>
  )
}

function ClassicSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay) => void
}) {
  const { category: cat, onSelectProduct } = props
  if (!categoryHasProducts(cat)) return null
  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-stone-800 mb-3 tracking-tight">{cat.name}</h3>
      {cat.products.length > 0 && (
        <div className="space-y-3 mb-4">
          {cat.products.map((product) => (
            <ClassicProductItem key={product.id} product={product} onSelect={onSelectProduct} />
          ))}
        </div>
      )}
      {(cat.children ?? []).map((child) => (
        <ClassicSubcategoryBlock
          key={child.id}
          category={child}
          onSelectProduct={onSelectProduct}
        />
      ))}
    </div>
  )
}

export function ClassicMenuTemplate(props: MenuTemplateProps) {
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
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 flex flex-col">
      <header className="bg-white border-b border-stone-200/60">
        <div className="max-w-2xl mx-auto px-5 pt-7 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center shadow-md shadow-rose-200/50 flex-shrink-0 overflow-hidden ring-1 ring-stone-200/60">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={business.name}
                  onError={(e) => applyCfImageFallback(e.currentTarget, onLogoError)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">{business.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-stone-900 tracking-tight truncate">
                {business.name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 flex-wrap">
                {business.workingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    {business.workingHours}
                  </span>
                )}
                {business.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    {business.address.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
            {activeCampaigns.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenCampaigns(0)}
                aria-label="Kampanyaları Gör"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 text-xs font-semibold hover:bg-rose-100/80 transition-colors flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kampanyalar ({activeCampaigns.length})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-stone-200/70">
        <div className="max-w-2xl mx-auto">
          <div className="px-5 py-3">
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 h-11 px-4 bg-white border border-stone-200/80 rounded-xl text-stone-400 shadow-2xs hover:border-stone-300 transition-colors"
            >
              <Search className="w-4 h-4 text-stone-400" />
              <span className="text-sm">Menüde ürün ara...</span>
            </button>
          </div>
          {roots.length > 0 && (
            <div className="overflow-x-auto scrollbar-hide" role="tablist" aria-label="Menü Kategorileri">
              <div className="flex gap-1.5 px-5 pb-3">
                {roots.map((cat) => {
                  const isSelected = activeRoot?.id === cat.id
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      key={cat.id}
                      onClick={(e) => onSelectCategory(cat.id, e.currentTarget)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-stone-900 text-white shadow-xs"
                          : "text-stone-600 bg-white/70 border border-stone-200/60 hover:bg-stone-100"
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
            <p className="text-stone-400">Bu menüde henüz ürün bulunmuyor.</p>
          </div>
        ) : !activeRoot ? null : !categoryHasProducts(activeRoot) ? (
          <div className="text-center py-16">
            <p className="text-stone-500 font-medium">Ürün bulunamadı</p>
            <p className="text-stone-400 text-sm mt-1">Bu kategoride henüz ürün yok.</p>
          </div>
        ) : (
          <div key={activeRoot.id} className="mb-10">
            <h2 className="text-lg font-bold text-stone-900 mb-4 tracking-tight">
              {activeRoot.name}
            </h2>
            {activeRoot.products.length > 0 && (
              <div className="space-y-3 mb-6">
                {activeRoot.products.map((product) => (
                  <ClassicProductItem
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                  />
                ))}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <ClassicSubcategoryBlock
                key={sub.id}
                category={sub}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 pt-4 pb-24 text-center border-t border-stone-200/60 bg-[#FAF9F6]">
        <p className="text-xs font-medium text-stone-500">Tüm fiyatlarımıza KDV dahildir.</p>
      </footer>
    </div>
  )
}
