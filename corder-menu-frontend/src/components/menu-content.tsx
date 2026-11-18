import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  applyCfImageFallback,
  fetchMenu,
  formatMenuPrice,
  isCampaignCurrentlyValid,
  MenuFetchError,
  resolveImageUrl,
  resolveMenuImageUrl,
  type MenuErrorKind,
  type MenuResponse,
  type MenuProduct,
  type MenuCategory,
} from "@/lib/api"
import { MapPin, Search, Clock, Sparkles, RefreshCw, AlertTriangle } from "lucide-react"
import {
  CampaignsModal,
  ContactPopover,
  MenuSearchOverlay,
  ProductDetailModal,
  type ProductDisplay,
} from "./menu-modals"
import { WaiterCallWidget } from "./waiter-call-modal"

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
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedImage = resolveImageUrl(product.imageUrl)
  const display: ProductDisplay = { ...product, image: imgFailed ? undefined : resolvedImage }

  return (
    <button
      type="button"
      disabled={!product.inStock}
      aria-disabled={!product.inStock}
      onClick={() => product.inStock && onSelect(display)}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-stone-100 transition-all ${
        product.inStock
          ? "cursor-pointer hover:shadow-md hover:border-stone-200 active:scale-[0.99]"
          : "opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-stone-900">{product.name}</h3>
            {!product.inStock && (
              <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                Tükendi
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          <p className="mt-2 font-bold text-stone-900">
            {formatMenuPrice(product.price)}{" "}
            <span className="text-xs font-normal text-stone-400">TL</span>
          </p>
        </div>
        {resolvedImage && !imgFailed && (
          <div className="w-20 h-20 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
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

function MenuSubcategoryBlock(props: {
  category: MenuCategory
  onSelectProduct: (p: ProductDisplay | null) => void
}) {
  const { category: cat, onSelectProduct } = props
  if (!categoryHasProducts(cat)) return null
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

export function MenuContent({
  slug,
  tableToken = "",
}: {
  slug: string
  tableToken?: string
}) {
  const [data, setData] = useState<MenuResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<MenuErrorKind>("not_found")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductDisplay | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0)
  const [hasSeenCampaigns, setHasSeenCampaigns] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const loadMenu = useCallback(
    async (forceRefresh = false) => {
      if (!slug?.trim()) {
        setLoading(false)
        setErrorKind("missing_slug")
        setError("Restoran bağlantısı belirtilmedi. Lütfen masadaki QR kodu tekrar okutun.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetchMenu(slug.trim(), { forceRefresh, tableToken })
        setData(res)
        setLogoFailed(false)
        const validCampaigns = (res.campaigns ?? []).filter(isCampaignCurrentlyValid)
        if (res.categories.length > 0) {
          setActiveCategory((prev) =>
            prev && res.categories.some((c) => c.id === prev) ? prev : res.categories[0].id
          )
        }
        if (validCampaigns.length > 0 && !hasSeenCampaigns) {
          setTimeout(() => {
            setShowCampaigns(true)
            setHasSeenCampaigns(true)
          }, 400)
        }
      } catch (e) {
        if (e instanceof MenuFetchError) {
          setErrorKind(e.kind)
          setError(e.message)
        } else {
          setErrorKind("network")
          setError(e instanceof Error ? e.message : "Menü yüklenemedi")
        }
      } finally {
        setLoading(false)
      }
    },
    [slug, tableToken, hasSeenCampaigns]
  )

  useEffect(() => {
    void loadMenu(false)
  }, [loadMenu])

  // Dynamic SEO / Metadata
  useEffect(() => {
    if (!data?.name) return
    document.title = `${data.name} — Dijital Menü`
    const descMeta = document.querySelector('meta[name="description"]')
    if (descMeta) {
      descMeta.setAttribute(
        "content",
        `${data.name} dijital QR menüsü${data.address ? ` (${data.address})` : ""}. Güncel ürünler ve fiyatlar.`
      )
    }
  }, [data?.name, data?.address])

  const activeCampaigns = useMemo(
    () => (data?.campaigns ?? []).filter(isCampaignCurrentlyValid),
    [data?.campaigns]
  )
  const roots = useMemo(() => data?.categories ?? [], [data?.categories])
  const allProducts: ProductDisplay[] = useMemo(
    () =>
      flattenMenuProducts(roots).map((p) => ({
        ...p,
        image: resolveImageUrl(p.imageUrl),
      })),
    [roots]
  )
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR")
    if (!q) return []
    return allProducts.filter(
      (p) =>
        p.name.toLocaleLowerCase("tr-TR").includes(q) ||
        (p.description?.toLocaleLowerCase("tr-TR").includes(q) ?? false)
    )
  }, [searchQuery, allProducts])

  const hasTreeContent = useMemo(() => roots.some(categoryHasProducts), [roots])

  /** Currently selected root category (only products in this branch are shown) */
  const activeRoot =
    roots.find((r) => r.id === activeCategory) ?? (roots.length > 0 ? roots[0] : null)

  useEffect(() => {
    if (!showSearch && !selectedProduct && !showCampaigns && !showContact) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (selectedProduct) setSelectedProduct(null)
      else if (showSearch) {
        setShowSearch(false)
        setSearchQuery("")
      } else if (showCampaigns) setShowCampaigns(false)
      else if (showContact) setShowContact(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [showSearch, selectedProduct, showCampaigns, showContact])

  const scrollToCategory = (categoryId: string, buttonEl?: HTMLButtonElement | null) => {
    setActiveCategory(categoryId)
    buttonEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-stone-50 flex items-center justify-center">
        <div className="animate-pulse text-stone-400">Yükleniyor...</div>
      </div>
    )
  }

  if (error || !data) {
    const title =
      errorKind === "suspended"
        ? "Menü Geçici Olarak Kullanılamıyor"
        : errorKind === "network"
          ? "Bağlantı Hatası"
          : errorKind === "missing_slug"
            ? "Restoran Belirtilmedi"
            : "Menü Bulunamadı"

    return (
      <div className="min-h-dvh bg-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            {errorKind === "suspended" || errorKind === "network" ? (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            ) : (
              <Search className="w-6 h-6 text-stone-400" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">{title}</h1>
          <p className="text-stone-500 text-sm leading-relaxed">
            {error ?? "Bu işletmeye ait menü mevcut değil."}
          </p>
          {errorKind !== "missing_slug" && (
            <button
              type="button"
              onClick={() => void loadMenu(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tekrar Dene
            </button>
          )}
        </div>
      </div>
    )
  }

  const business = data
  const rawLogoUrl = business.logoUrl ?? business.logo ?? business.restaurant?.logoUrl ?? null
  const logoUrl = resolveMenuImageUrl(rawLogoUrl, { width: 120 })
  const verifiedTable =
    tableToken &&
    business.tableContext?.tableId &&
    business.tableContext?.tableName &&
    business.tableContext?.tableToken
      ? business.tableContext
      : null

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col">
      <header className="bg-white">
        <div className="px-5 pt-8 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center shadow-lg shadow-rose-200/50 flex-shrink-0 overflow-hidden">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={business.name}
                  onError={(e) => applyCfImageFallback(e.currentTarget, () => setLogoFailed(true))}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">{business.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-stone-900 truncate">{business.name}</h1>
                {verifiedTable && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/70 text-xs font-semibold">
                    Masa: {verifiedTable.tableName}
                    {verifiedTable.sectionName ? ` (${verifiedTable.sectionName})` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 flex-wrap">
                {business.workingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {business.workingHours}
                  </span>
                )}
                {business.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {business.address.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
            {activeCampaigns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveCampaignIndex(0)
                  setShowCampaigns(true)
                }}
                aria-label="Kampanyaları Gör"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-colors flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kampanyalar ({activeCampaigns.length})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div ref={navRef} className="sticky top-0 z-40 bg-white border-b border-stone-100 shadow-sm">
        <div className="px-5 py-3">
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 h-11 px-4 bg-stone-100 rounded-xl text-stone-400 hover:bg-stone-200/70 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Ürün ara...</span>
          </button>
        </div>
        {roots.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide" role="tablist" aria-label="Menü Kategorileri">
            <div className="flex gap-1 px-5 pb-3">
              {roots.map((cat) => {
                const isSelected = activeRoot?.id === cat.id
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    key={cat.id}
                    onClick={(e) => scrollToCategory(cat.id, e.currentTarget)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-stone-900 text-white"
                        : "text-stone-600 hover:bg-stone-100"
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

      <main className="px-5 py-6 flex-1">
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

      <footer className="px-5 pt-4 pb-24 text-center border-t border-stone-200/60 bg-stone-50">
        <p className="text-xs font-medium text-stone-500">
          Tüm fiyatlarımıza KDV dahildir.
        </p>
      </footer>

      <WaiterCallWidget slug={slug} tableContext={verifiedTable} />

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
          formatCurrency={formatMenuPrice}
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
          formatCurrency={formatMenuPrice}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {showCampaigns && activeCampaigns.length > 0 && (
        <CampaignsModal
          campaigns={activeCampaigns}
          activeIndex={activeCampaignIndex}
          formatCurrency={formatMenuPrice}
          onChangeIndex={setActiveCampaignIndex}
          onClose={() => setShowCampaigns(false)}
        />
      )}
    </div>
  )
}
