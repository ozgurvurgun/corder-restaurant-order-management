import { useState, useEffect, useRef } from "react"
import { fetchMenu, resolveImageUrl, type MenuResponse, type MenuProduct, type MenuCategory } from "@/lib/api"
import { MapPin, Search, Clock } from "lucide-react"
import {
  CampaignsModal,
  ContactPopover,
  MenuSearchOverlay,
  ProductDetailModal,
  type ProductDisplay,
} from "./menu-modals"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 })
}

function flattenMenuProducts(categories: MenuCategory[]): MenuProduct[] {
  const out: MenuProduct[] = []
  const walk = (nodes: MenuCategory[]) => {
    for (const node of nodes) {
      out.push(...node.products)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(categories)
  return out
}

function categoryHasProducts(category: MenuCategory): boolean {
  if (category.products.length > 0) return true
  return (category.children ?? []).some(categoryHasProducts)
}

function MenuProductItem(props: {
  product: MenuProduct
  onSelect: (display: ProductDisplay) => void
}) {
  const { product, onSelect } = props
  const display: ProductDisplay = { ...product, image: resolveImageUrl(product.imageUrl) }

  return (
    <div
      onClick={() => product.inStock && onSelect(display)}
      className={`bg-white rounded-2xl p-4 shadow-sm border border-stone-100 transition-all ${
        product.inStock
          ? "cursor-pointer hover:shadow-md hover:border-stone-200 active:scale-[0.99]"
          : "opacity-60"
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-stone-900">{product.name}</h3>
            {!product.inStock && (
              <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                Tukendi
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          <p className="mt-2 font-bold text-stone-900">
            {formatCurrency(product.price)}{" "}
            <span className="text-xs font-normal text-stone-400">TL</span>
          </p>
        </div>
        {display.image && (
          <div className="w-20 h-20 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
            <img src={display.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  )
}

function MenuSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay | null) => void
}) {
  const { category: cat, onSelectProduct } = props
  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-stone-800 mb-3">{cat.name}</h3>
      {cat.products.length > 0 && (
        <div className="space-y-3 mb-4">
          {cat.products.map((product) => (
            <MenuProductItem key={product.id} product={product} onSelect={onSelectProduct} />
          ))}
        </div>
      )}
      {(cat.children ?? []).map((child) => (
        <MenuSubcategoryBlock
          key={child.id}
          category={child}
          onSelectProduct={onSelectProduct}
        />
      ))}
    </div>
  )
}

export function MenuContent({ slug }: { slug: string }) {
  const [data, setData] = useState<MenuResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductDisplay | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0)
  const [hasSeenCampaigns, setHasSeenCampaigns] = useState(false)
  const [showContact, setShowContact] = useState(false)

  useEffect(() => {
    if (!slug?.trim()) {
      setLoading(false)
      setError("Restoran belirtilmedi.")
      return
    }
    setLoading(true)
    setError(null)
    fetchMenu(slug.trim())
      .then((res) => {
        setData(res)
        if (res.categories.length > 0) setActiveCategory(res.categories[0].id)
        if (res.campaigns.length > 0 && !hasSeenCampaigns) {
          setTimeout(() => {
            setShowCampaigns(true)
            setHasSeenCampaigns(true)
          }, 500)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Menu yüklenemedi"))
      .finally(() => setLoading(false))
  }, [slug, hasSeenCampaigns])

  const activeCampaigns = data?.campaigns ?? []
  const roots = data?.categories ?? []
  const allProducts: ProductDisplay[] = flattenMenuProducts(roots).map((p) => ({
    ...p,
    image: resolveImageUrl(p.imageUrl),
  }))
  const filteredProducts = searchQuery.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []
  const hasTreeContent = roots.some(categoryHasProducts)

  /** Currently selected root category (only products in this branch are shown) */
  const activeRoot =
    roots.find((r) => r.id === activeCategory) ?? (roots.length > 0 ? roots[0] : null)

  useEffect(() => {
    const list = data?.categories
    if (!list?.length) return
    setActiveCategory((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0].id))
  }, [data])

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-stone-50 flex items-center justify-center">
        <div className="animate-pulse text-stone-400">Yukleniyor...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-stone-400" />
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Menu Bulunamadi</h1>
          <p className="text-stone-500 text-sm">
            {error ?? "Bu isletmeye ait menu mevcut degil."}
          </p>
        </div>
      </div>
    )
  }

  const business = data

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="bg-white">
        <div className="px-5 pt-8 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center shadow-lg shadow-rose-200/50">
              <span className="text-2xl font-bold text-white">{business.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-stone-900">{business.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                {business.workingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {business.workingHours}
                  </span>
                )}
                {business.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {business.address.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div ref={navRef} className="sticky top-0 z-40 bg-white border-b border-stone-100 shadow-sm">
        <div className="px-5 py-3">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 h-11 px-4 bg-stone-100 rounded-xl text-stone-400 hover:bg-stone-200/70 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Ara...</span>
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-5 pb-3">
            {roots.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="px-5 py-6 pb-28">
        {!hasTreeContent ? (
          <div className="text-center py-16">
            <p className="text-stone-400">Sonuc bulunamadi</p>
          </div>
        ) : !activeRoot ? null : !categoryHasProducts(activeRoot) ? (
          <div className="text-center py-16">
            <p className="text-stone-500 font-medium">Ürün bulunamadı</p>
            <p className="text-stone-400 text-sm mt-1">Bu kategoride henüz ürün yok.</p>
          </div>
        ) : (
          <div key={activeRoot.id} className="mb-10">
            <h2 className="text-lg font-bold text-stone-900 mb-4">{activeRoot.name}</h2>
            {activeRoot.products.length > 0 && (
              <div className="space-y-3 mb-6">
                {activeRoot.products.map((product) => (
                  <MenuProductItem
                    key={product.id}
                    product={product}
                    onSelect={setSelectedProduct}
                  />
                ))}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <MenuSubcategoryBlock
                key={sub.id}
                category={sub}
                onSelectProduct={setSelectedProduct}
              />
            ))}
          </div>
        )}
      </main>

      <ContactPopover
        business={business}
        showContact={showContact}
        onToggle={() => setShowContact(!showContact)}
        onClose={() => setShowContact(false)}
      />

      {showSearch && (
        <MenuSearchOverlay
          searchQuery={searchQuery}
          filteredProducts={filteredProducts}
          formatCurrency={formatCurrency}
          onSearchQueryChange={setSearchQuery}
          onSelectProduct={setSelectedProduct}
          onClose={() => {
            setShowSearch(false)
            setSearchQuery("")
          }}
        />
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          formatCurrency={formatCurrency}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {showCampaigns && activeCampaigns.length > 0 && (
        <CampaignsModal
          campaigns={activeCampaigns}
          activeIndex={activeCampaignIndex}
          formatCurrency={formatCurrency}
          onChangeIndex={setActiveCampaignIndex}
          onClose={() => setShowCampaigns(false)}
        />
      )}
    </div>
  )
}
