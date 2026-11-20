import { useState } from "react"
import { ArrowUpRight, Clock, MapPin, Search, UtensilsCrossed } from "lucide-react"
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
  countCategoryProducts,
  ProductMetaTags,
  type MenuTemplateProps,
} from "../menu-template-shared"

function VibrantBentoProductCard(props: {
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
      className={`group w-full text-left rounded-3xl bg-white shadow-xs border border-stone-200/70 p-3.5 transition-all ${
        product.inStock
          ? "cursor-pointer hover:shadow-md hover:border-rose-200 active:scale-[0.99]"
          : "opacity-55 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 overflow-hidden flex-shrink-0 ring-1 ring-stone-200/60">
          {resolvedImage && !imgFailed ? (
            <img
              src={resolvedImage}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={(e) => applyCfImageFallback(e.currentTarget, () => setImgFailed(true))}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-rose-300">
              <UtensilsCrossed className="w-7 h-7 stroke-[1.75]" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-stone-900 text-base leading-snug truncate">
              {product.name}
            </h3>
            {!product.inStock && (
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                Tükendi
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
              {product.description}
            </p>
          )}
          <ProductMetaTags product={product} variant="vibrant" className="mt-2" />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="inline-flex items-baseline gap-1 px-3 py-1 rounded-xl bg-rose-50 text-rose-600 font-extrabold text-sm">
              {formatMenuPrice(product.price)}
              <span className="text-[11px] font-bold">TL</span>
            </span>
          </div>
        </div>

        <div className="w-9 h-9 rounded-full bg-stone-100 group-hover:bg-gradient-to-br group-hover:from-rose-500 group-hover:to-orange-500 group-hover:text-white text-stone-600 flex items-center justify-center flex-shrink-0 transition-all shadow-2xs">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  )
}

function VibrantSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay) => void
}) {
  const { category: cat, onSelectProduct } = props
  if (!categoryHasProducts(cat)) return null
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2.5 mb-3.5">
        <h3 className="text-base font-extrabold text-stone-800">{cat.name}</h3>
        <span className="px-2.5 py-0.5 rounded-full bg-stone-200/80 text-stone-600 text-xs font-bold">
          {countCategoryProducts(cat)}
        </span>
      </div>
      {cat.products.length > 0 && (
        <div className="space-y-3 mb-4">
          {cat.products.map((product) => (
            <VibrantBentoProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
      {(cat.children ?? []).map((child) => (
        <VibrantSubcategoryBlock
          key={child.id}
          category={child}
          onSelectProduct={onSelectProduct}
        />
      ))}
    </div>
  )
}

export function VibrantPopMenuTemplate(props: MenuTemplateProps) {
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
    <div className="min-h-dvh bg-stone-100 text-stone-900 flex flex-col">
      <header className="relative bg-gradient-to-br from-rose-600 via-rose-500 to-orange-500 text-white pt-6 pb-11 px-5 rounded-b-[2rem] shadow-lg shadow-rose-500/15 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative max-w-2xl mx-auto">
          {activeCampaigns.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenCampaigns(0)}
                aria-label="Kampanyaları Gör"
                className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white text-rose-600 text-xs font-extrabold shadow-md hover:bg-rose-50 transition-colors"
              >
                <span>Kampanyalar ({activeCampaigns.length})</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md ring-2 ring-white/40 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={business.name}
                  onError={(e) => applyCfImageFallback(e.currentTarget, onLogoError)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-extrabold text-white">
                  {business.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-white truncate">
                {business.name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-white/90 flex-wrap">
                {business.workingHours && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/15">
                    <Clock className="w-3 h-3" />
                    {business.workingHours}
                  </span>
                )}
                {business.address && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/15">
                    <MapPin className="w-3 h-3" />
                    {business.address.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-5 -mt-6 relative z-30">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full h-12 px-4 rounded-2xl bg-white shadow-lg shadow-stone-900/10 border border-stone-200/80 flex items-center gap-3 text-stone-400 hover:border-rose-300 transition-all"
        >
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-stone-500">En sevdiğin lezzeti ara...</span>
        </button>
      </div>

      {roots.length > 0 && (
        <div className="sticky top-0 z-20 bg-stone-100/95 backdrop-blur-md border-b border-stone-200/70 mt-3">
          <div
            className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Menü Kategorileri"
          >
            <div className="flex gap-2 px-5 py-3">
              {roots.map((cat) => {
                const isSelected = activeRoot?.id === cat.id
                const count = countCategoryProducts(cat)
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    key={cat.id}
                    onClick={(e) => onSelectCategory(cat.id, e.currentTarget)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all ${
                      isSelected
                        ? "bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md shadow-rose-500/25"
                        : "bg-white text-stone-700 border border-stone-200/80 hover:border-rose-200"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected ? "bg-white/25 text-white" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl w-full mx-auto px-5 py-6 flex-1">
        {!hasTreeContent ? (
          <div className="text-center py-16">
            <p className="text-stone-400">Bu menüde henüz ürün bulunmuyor.</p>
          </div>
        ) : !activeRoot ? null : !categoryHasProducts(activeRoot) ? (
          <div className="text-center py-16">
            <p className="text-stone-500 font-bold">Ürün bulunamadı</p>
            <p className="text-stone-400 text-sm mt-1">Bu kategoride henüz ürün yok.</p>
          </div>
        ) : (
          <div key={activeRoot.id} className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
                {activeRoot.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-extrabold">
                {countCategoryProducts(activeRoot)} Ürün
              </span>
            </div>
            {activeRoot.products.length > 0 && (
              <div className="space-y-3 mb-6">
                {activeRoot.products.map((product) => (
                  <VibrantBentoProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                  />
                ))}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <VibrantSubcategoryBlock
                key={sub.id}
                category={sub}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 pt-4 pb-24 text-center border-t border-stone-200/70 bg-stone-100">
        <p className="text-xs font-semibold text-stone-500">Tüm fiyatlarımıza KDV dahildir.</p>
      </footer>
    </div>
  )
}
