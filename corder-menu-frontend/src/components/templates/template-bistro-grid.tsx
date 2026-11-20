import { useState } from "react"
import { Clock, MapPin, Search, UtensilsCrossed } from "lucide-react"
import {
  formatMenuPrice,
  resolveImageUrl,
  type MenuCategory,
  type MenuProduct,
} from "@/lib/api"
import type { ProductDisplay } from "../menu-modals"
import {
  ActiveCampaignsShowcaseStrip,
  categoryHasProducts,
  countCategoryProducts,
  ProductMetaTags,
  type MenuTemplateProps,
} from "../menu-template-shared"

function BistroGridProductCard(props: {
  product: MenuProduct
  index?: number
  onSelect: (display: ProductDisplay) => void
}) {
  const { product, index = 0, onSelect } = props
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedImage = resolveImageUrl(product.imageUrl)
  const display: ProductDisplay = {
    ...product,
    image: imgFailed ? undefined : resolvedImage,
  }
  const isEager = index < 6

  return (
    <button
      type="button"
      disabled={!product.inStock}
      aria-disabled={!product.inStock}
      onClick={() => product.inStock && onSelect(display)}
      className={`group w-full text-left bg-white rounded-2xl overflow-hidden border border-stone-200/80 shadow-2xs flex flex-col transition-all ${
        product.inStock
          ? "cursor-pointer hover:shadow-md hover:border-stone-300 active:scale-[0.98]"
          : "opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-stone-100 to-stone-200/70 overflow-hidden">
        {resolvedImage && !imgFailed ? (
          <img
            src={resolvedImage}
            alt={product.name}
            loading={isEager ? "eager" : "lazy"}
            fetchPriority={index < 4 ? "high" : "auto"}
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-300">
            <UtensilsCrossed className="w-7 h-7 stroke-[1.5]" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-stone-950/80 backdrop-blur-md text-white text-xs font-bold shadow-sm">
          {formatMenuPrice(product.price)} TL
        </div>
        {!product.inStock && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-xs">
            Tükendi
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-bold text-stone-900 text-sm leading-snug line-clamp-1">
          {product.name}
        </h3>
        {product.description ? (
          <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        ) : (
          <p className="text-[11px] text-stone-400 mt-1">Detaylar için dokunun</p>
        )}
        <ProductMetaTags product={product} variant="bistro" className="mt-2" />
      </div>
    </button>
  )
}

function BistroSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay) => void
}) {
  const { category: cat, onSelectProduct } = props
  if (!categoryHasProducts(cat)) return null
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-stone-800">{cat.name}</h3>
        <span className="text-xs font-medium text-stone-400">
          {countCategoryProducts(cat)} ürün
        </span>
      </div>
      {cat.products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-4">
          {cat.products.map((product, idx) => (
            <BistroGridProductCard
              key={product.id}
              product={product}
              index={idx}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
      {(cat.children ?? []).map((child) => (
        <BistroSubcategoryBlock
          key={child.id}
          category={child}
          onSelectProduct={onSelectProduct}
        />
      ))}
    </div>
  )
}

export function BistroGridMenuTemplate(props: MenuTemplateProps) {
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
    <div className="min-h-dvh bg-stone-100/80 text-stone-900 flex flex-col">
      <header className="bg-white border-b border-stone-200/70">
        <div className="max-w-3xl mx-auto px-5 pt-6 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-200/60 flex-shrink-0 overflow-hidden">
                {logoUrl && !logoFailed ? (
                  <img
                    src={logoUrl}
                    alt={business.name}
                    onError={onLogoError}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-white">{business.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-stone-900 tracking-tight truncate">
                  {business.name}
                </h1>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500 flex-wrap">
                  {business.workingHours && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      {business.workingHours}
                    </span>
                  )}
                  {business.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      {business.address.split(",")[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Ürün Ara"
              className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200/80 flex items-center justify-center text-stone-700 transition-colors flex-shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeCampaigns.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <ActiveCampaignsShowcaseStrip
              campaigns={activeCampaigns}
              onSelectCampaign={(idx) => onOpenCampaigns(idx)}
              variant="light"
            />
          </div>
        )}
      </header>

      {roots.length > 0 && (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs">
          <div
            className="max-w-3xl mx-auto overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Menü Kategorileri"
          >
            <div className="flex gap-2 px-5 py-3">
              {roots.map((cat) => {
                const isSelected = activeRoot?.id === cat.id
                const itemCount = countCategoryProducts(cat)
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    key={cat.id}
                    onClick={(e) => onSelectCategory(cat.id, e.currentTarget)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-stone-900 text-white shadow-sm"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200/70"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-stone-200/90 text-stone-600"
                      }`}
                    >
                      {itemCount}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl w-full mx-auto px-5 py-6 flex-1">
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
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-extrabold text-stone-900 tracking-tight">
                {activeRoot.name}
              </h2>
              <span className="text-xs font-semibold text-stone-400">
                {countCategoryProducts(activeRoot)} çeşit
              </span>
            </div>
            {activeRoot.products.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-6">
                {activeRoot.products.map((product, idx) => (
                  <BistroGridProductCard
                    key={product.id}
                    product={product}
                    index={idx}
                    onSelect={onSelectProduct}
                  />
                ))}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <BistroSubcategoryBlock
                key={sub.id}
                category={sub}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 pt-4 pb-24 text-center border-t border-stone-200/70 bg-white">
        <p className="text-xs font-medium text-stone-500">Tüm fiyatlarımıza KDV dahildir.</p>
      </footer>
    </div>
  )
}
