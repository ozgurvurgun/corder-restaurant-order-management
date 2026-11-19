import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  fetchMenu,
  formatMenuPrice,
  isCampaignCurrentlyValid,
  isValidMenuTemplateId,
  MenuFetchError,
  resolveImageUrl,
  resolveMenuImageUrl,
  type MenuErrorKind,
  type MenuResponse,
  type MenuTemplateId,
} from "@/lib/api"
import { Search, RefreshCw, AlertTriangle } from "lucide-react"
import {
  CampaignsModal,
  ContactPopover,
  MenuSearchOverlay,
  ProductDetailModal,
  type ProductDisplay,
} from "./menu-modals"
import { WaiterCallWidget, type MenuWidgetTheme } from "./waiter-call-modal"
import {
  categoryHasProducts,
  flattenMenuProducts,
  searchProductsWithLevenshtein,
  type MenuTemplateProps,
} from "./menu-template-shared"
import { ClassicMenuTemplate } from "./templates/template-classic"
import { BistroGridMenuTemplate } from "./templates/template-bistro-grid"
import { LuxuryNoirMenuTemplate } from "./templates/template-luxury-noir"
import { EditorialMenuTemplate } from "./templates/template-editorial"
import { VibrantPopMenuTemplate } from "./templates/template-vibrant-pop"

function readTemplateOverrideFromLocation(): MenuTemplateId | null {
  if (typeof window === "undefined") return null
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get("template")?.trim()
    return isValidMenuTemplateId(raw) ? raw : null
  } catch {
    return null
  }
}

function resolveWidgetTheme(templateId: MenuTemplateId): MenuWidgetTheme {
  if (templateId === "luxury-noir") return "dark"
  if (templateId === "editorial") return "editorial"
  return "light"
}

export function MenuContent({
  slug,
  tableToken = "",
  templateOverride,
}: {
  slug: string
  tableToken?: string
  templateOverride?: string
}) {
  const [data, setData] = useState<MenuResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<MenuErrorKind>("not_found")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductDisplay | null>(null)
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0)
  const hasSeenCampaignsRef = useRef(false)
  const campaignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showContact, setShowContact] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const [waiterOpenTrigger, setWaiterOpenTrigger] = useState(0)

  useEffect(() => {
    return () => {
      if (campaignTimerRef.current) clearTimeout(campaignTimerRef.current)
    }
  }, [])

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
        if (validCampaigns.length > 0 && !hasSeenCampaignsRef.current) {
          hasSeenCampaignsRef.current = true
          if (campaignTimerRef.current) clearTimeout(campaignTimerRef.current)
          campaignTimerRef.current = setTimeout(() => {
            setShowCampaigns(true)
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
    [slug, tableToken]
  )

  useEffect(() => {
    void loadMenu(false)
  }, [loadMenu])

  // Dynamic SEO / Metadata
  useEffect(() => {
    if (!data?.name) return
    document.title = `${data.name} - Dijital Menü`
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
  const filteredProducts = useMemo(
    () => searchProductsWithLevenshtein(allProducts, searchQuery),
    [searchQuery, allProducts]
  )

  const hasTreeContent = useMemo(() => roots.some(categoryHasProducts), [roots])

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

  const urlTemplateOverride = isValidMenuTemplateId(templateOverride)
    ? templateOverride
    : readTemplateOverrideFromLocation()
  const activeTemplate: MenuTemplateId =
    urlTemplateOverride ??
    (isValidMenuTemplateId(business.menuTemplate) ? business.menuTemplate : null) ??
    (isValidMenuTemplateId(business.restaurant?.menuTemplate)
      ? business.restaurant.menuTemplate
      : null) ??
    "classic"

  const widgetTheme = resolveWidgetTheme(activeTemplate)

  const templateProps: MenuTemplateProps = {
    business,
    logoUrl,
    logoFailed,
    onLogoError: () => setLogoFailed(true),
    verifiedTable,
    activeCampaigns,
    roots,
    activeRoot,
    hasTreeContent,
    onSelectCategory: scrollToCategory,
    onSelectProduct: (p) => setSelectedProduct(p),
    onOpenSearch: () => setShowSearch(true),
    onOpenCampaigns: (initialIndex = 0) => {
      setActiveCampaignIndex(initialIndex)
      setShowCampaigns(true)
    },
    onOpenWaiterCall: () => setWaiterOpenTrigger((prev) => prev + 1),
  }

  return (
    <>
      {activeTemplate === "bistro-grid" ? (
        <BistroGridMenuTemplate {...templateProps} />
      ) : activeTemplate === "luxury-noir" ? (
        <LuxuryNoirMenuTemplate {...templateProps} />
      ) : activeTemplate === "editorial" ? (
        <EditorialMenuTemplate {...templateProps} />
      ) : activeTemplate === "vibrant-pop" ? (
        <VibrantPopMenuTemplate {...templateProps} />
      ) : (
        <ClassicMenuTemplate {...templateProps} />
      )}

      <WaiterCallWidget
        slug={slug}
        tableContext={verifiedTable}
        theme={widgetTheme}
        openTrigger={waiterOpenTrigger}
      />

      <ContactPopover
        business={business}
        showContact={showContact}
        onToggle={() => setShowContact(!showContact)}
        onClose={() => setShowContact(false)}
        theme={widgetTheme}
        hasWaiterCall={Boolean(verifiedTable)}
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
          theme={widgetTheme}
        />
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          formatCurrency={formatMenuPrice}
          onClose={() => setSelectedProduct(null)}
          theme={widgetTheme}
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
    </>
  )
}
