import { useState, useEffect, useRef } from "react"
import { fetchMenu, resolveImageUrl, type MenuResponse, type MenuProduct, type MenuCategory } from "@/lib/api"
import { MapPin, Phone, Search, X, Clock, ChevronLeft, ChevronRight, Instagram, MessageCircle } from "lucide-react"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 })
}

function flattenMenuProducts(categories: MenuCategory[]): MenuProduct[] {
  const out: MenuProduct[] = []
  const walk = (nodes: MenuCategory[]) => {
    for (const n of nodes) {
      out.push(...n.products)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(categories)
  return out
}

function categoryHasProducts(c: MenuCategory): boolean {
  if (c.products.length > 0) return true
  return (c.children ?? []).some(categoryHasProducts)
}

type ProductDisplay = MenuProduct & { image?: string }

function MenuSubcategoryBlock(props: {
  category: MenuCategory
  formatCurrency: (n: number) => string
  onSelectProduct: (p: ProductDisplay | null) => void
}) {
  const { category: cat, formatCurrency, onSelectProduct } = props
  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-stone-800 mb-3">{cat.name}</h3>
      {cat.products.length > 0 && (
        <div className="space-y-3 mb-4">
          {cat.products.map((product) => {
            const display: ProductDisplay = { ...product, image: resolveImageUrl(product.imageUrl) }
            return (
              <div
                key={product.id}
                onClick={() => product.inStock && onSelectProduct(display)}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-stone-100 transition-all ${product.inStock ? "cursor-pointer hover:shadow-md hover:border-stone-200 active:scale-[0.99]" : "opacity-60"}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-stone-900">{product.name}</h3>
                      {!product.inStock && <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">Tukendi</span>}
                    </div>
                    {product.description && <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">{product.description}</p>}
                    <p className="mt-2 font-bold text-stone-900">{formatCurrency(product.price)} <span className="text-xs font-normal text-stone-400">TL</span></p>
                  </div>
                  {display.image && (
                    <div className="w-20 h-20 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
                      <img src={display.image} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {(cat.children ?? []).map((ch) => (
        <MenuSubcategoryBlock key={ch.id} category={ch} formatCurrency={formatCurrency} onSelectProduct={onSelectProduct} />
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
          setTimeout(() => { setShowCampaigns(true); setHasSeenCampaigns(true) }, 500)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Menu yüklenemedi"))
      .finally(() => setLoading(false))
  }, [slug])

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

  /** Secili ust kategori (yalnizca bu dalin urunleri gosterilir) */
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

  const categories = roots

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
          <p className="text-stone-500 text-sm">{error ?? "Bu isletmeye ait menu mevcut degil."}</p>
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
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{business.workingHours}</span>
                )}
                {business.address && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{business.address.split(",")[0]}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      <div ref={navRef} className="sticky top-0 z-40 bg-white border-b border-stone-100 shadow-sm">
        <div className="px-5 py-3">
          <button onClick={() => setShowSearch(true)} className="w-full flex items-center gap-3 h-11 px-4 bg-stone-100 rounded-xl text-stone-400 hover:bg-stone-200/70 transition-colors">
            <Search className="w-4 h-4" /><span className="text-sm">Ara...</span>
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-5 pb-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat.id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <main className="px-5 py-6 pb-28">
        {!hasTreeContent ? (
          <div className="text-center py-16"><p className="text-stone-400">Sonuc bulunamadi</p></div>
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
                {activeRoot.products.map((product) => {
                  const display: ProductDisplay = { ...product, image: resolveImageUrl(product.imageUrl) }
                  return (
                    <div
                      key={product.id}
                      onClick={() => product.inStock && setSelectedProduct(display)}
                      className={`bg-white rounded-2xl p-4 shadow-sm border border-stone-100 transition-all ${product.inStock ? "cursor-pointer hover:shadow-md hover:border-stone-200 active:scale-[0.99]" : "opacity-60"}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-stone-900">{product.name}</h3>
                            {!product.inStock && <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">Tukendi</span>}
                          </div>
                          {product.description && <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">{product.description}</p>}
                          <p className="mt-2 font-bold text-stone-900">{formatCurrency(product.price)} <span className="text-xs font-normal text-stone-400">TL</span></p>
                        </div>
                        {display.image && (
                          <div className="w-20 h-20 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
                            <img src={display.image} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {(activeRoot.children ?? []).map((sub) => (
              <MenuSubcategoryBlock
                key={sub.id}
                category={sub}
                formatCurrency={formatCurrency}
                onSelectProduct={setSelectedProduct}
              />
            ))}
          </div>
        )}
      </main>
      <div className="fixed bottom-6 right-6 z-30">
        <div className={`absolute bottom-16 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden transition-all duration-300 origin-bottom-right ${showContact ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4 pointer-events-none"}`}>
          <div className="p-4 border-b border-stone-100 bg-gradient-to-r from-rose-50 to-orange-50">
            <h3 className="font-semibold text-stone-900">Iletisim</h3>
            <p className="text-xs text-stone-500 mt-0.5">Bize ulasin</p>
          </div>
          <div className="p-2">
            {business.phone && (
              <a href={`tel:${business.phone}`} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30"><Phone className="w-5 h-5 text-white" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-stone-900 group-hover:text-green-600 transition-colors">Telefon</p><p className="text-xs text-stone-500">{business.phone}</p></div>
              </a>
            )}
            {business.whatsapp && (
              <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30"><MessageCircle className="w-5 h-5 text-white" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-stone-900 group-hover:text-[#25D366] transition-colors">WhatsApp</p><p className="text-xs text-stone-500">Mesaj gonder</p></div>
              </a>
            )}
            {business.instagram && (
              <a href={`https://instagram.com/${business.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/30"><Instagram className="w-5 h-5 text-white" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-stone-900 group-hover:text-pink-500 transition-colors">Instagram</p><p className="text-xs text-stone-500">@{business.instagram}</p></div>
              </a>
            )}
            {business.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30"><MapPin className="w-5 h-5 text-white" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-stone-900 group-hover:text-blue-500 transition-colors">Konum</p><p className="text-xs text-stone-500 truncate">{business.address.split(",")[0]}</p></div>
              </a>
            )}
          </div>
        </div>
        <button onClick={() => setShowContact(!showContact)} className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${showContact ? "bg-stone-900 rotate-45 shadow-stone-900/30" : "bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/40 hover:shadow-rose-500/60 hover:scale-105"}`}>
          {showContact ? <X className="w-6 h-6 text-white" /> : <Phone className="w-6 h-6 text-white" />}
        </button>
      </div>
      {showContact && <div className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowContact(false)} />}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-white">
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 p-4 border-b border-stone-100">
              <div className="flex-1 flex items-center gap-3 h-11 px-4 bg-stone-100 rounded-xl">
                <Search className="w-4 h-4 text-stone-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Urun ara..." autoFocus className="flex-1 bg-transparent text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none" />
                {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-4 h-4 text-stone-400" /></button>}
              </div>
              <button onClick={() => { setShowSearch(false); setSearchQuery("") }} className="text-stone-600 text-sm font-medium">Iptal</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {searchQuery.trim() ? (
                filteredProducts.length === 0 ? (
                  <div className="text-center py-16"><p className="text-stone-400">Sonuc bulunamadi</p></div>
                ) : (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (product.inStock) {
                            setSelectedProduct(product)
                            setShowSearch(false)
                            setSearchQuery("")
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl ${product.inStock ? "hover:bg-stone-50 cursor-pointer" : "opacity-50"}`}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-stone-900">{product.name}</h3>
                          <p className="text-sm text-stone-500">{formatCurrency(product.price)} TL</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-16"><p className="text-stone-400 text-sm">Aramaya baslayin</p></div>
              )}
            </div>
          </div>
        </div>
      )}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-end" onClick={() => setSelectedProduct(null)}>
          <div className="w-full bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-stone-200" /></div>
            {selectedProduct.image && <div className="w-full aspect-video bg-stone-100"><img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" /></div>}
            <div className="p-6">
              <h2 className="text-xl font-bold text-stone-900 mb-2">{selectedProduct.name}</h2>
              {selectedProduct.description && <p className="text-stone-500 leading-relaxed mb-6">{selectedProduct.description}</p>}
              <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                <span className="text-2xl font-bold text-stone-900">{formatCurrency(selectedProduct.price)} <span className="text-sm font-normal text-stone-400">TL</span></span>
                <button onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCampaigns && activeCampaigns.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => { setShowCampaigns(false) }}>
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {activeCampaigns.map((campaign, index) => {
              const offset = index - activeCampaignIndex
              const isVisible = offset >= 0 && offset <= 2
              if (!isVisible || index === activeCampaignIndex) return null
              const imgUrl = resolveImageUrl(campaign.imageUrl)
              return (
                <div key={campaign.id} className="absolute inset-0 bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300" style={{ transform: `translateY(${offset * 12}px) scale(${1 - offset * 0.05}) rotate(${offset * 2}deg)`, opacity: 1 - offset * 0.3, zIndex: 10 - offset }}>
                  <div className="aspect-[4/3] bg-stone-100">{imgUrl && <img src={imgUrl} alt={campaign.title} className="w-full h-full object-cover" />}</div>
                </div>
              )
            })}
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden z-20">
              <button onClick={() => setShowCampaigns(false)} className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"><X className="w-5 h-5" /></button>
              <div className="relative aspect-[4/3] bg-stone-100">
                {resolveImageUrl(activeCampaigns[activeCampaignIndex]?.imageUrl) && <img src={resolveImageUrl(activeCampaigns[activeCampaignIndex].imageUrl)!} alt={activeCampaigns[activeCampaignIndex].title} className="w-full h-full object-cover" />}
                {activeCampaigns[activeCampaignIndex].discountPercent && <div className="absolute top-4 left-4 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg">%{activeCampaigns[activeCampaignIndex].discountPercent} Indirim</div>}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-bold text-stone-900 mb-2">{activeCampaigns[activeCampaignIndex].title}</h2>
                {activeCampaigns[activeCampaignIndex].description && <p className="text-stone-500 text-sm mb-4">{activeCampaigns[activeCampaignIndex].description}</p>}
                {(activeCampaigns[activeCampaignIndex].originalPrice || activeCampaigns[activeCampaignIndex].discountedPrice) && (
                  <div className="flex items-center gap-3 mb-4">
                    {activeCampaigns[activeCampaignIndex].discountedPrice && <span className="text-2xl font-bold text-rose-500">{formatCurrency(activeCampaigns[activeCampaignIndex].discountedPrice!)} TL</span>}
                    {activeCampaigns[activeCampaignIndex].originalPrice && activeCampaigns[activeCampaignIndex].discountedPrice && <span className="text-lg text-stone-400 line-through">{formatCurrency(activeCampaigns[activeCampaignIndex].originalPrice!)} TL</span>}
                  </div>
                )}
                {activeCampaigns[activeCampaignIndex].validUntil && <p className="text-xs text-stone-400 mb-4">Gecerlilik: {new Date(activeCampaigns[activeCampaignIndex].validUntil!).toLocaleDateString("tr-TR")}</p>}
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    {activeCampaigns.map((_, idx) => (
                      <button key={idx} onClick={() => setActiveCampaignIndex(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === activeCampaignIndex ? "w-6 bg-rose-500" : "bg-stone-300 hover:bg-stone-400"}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeCampaignIndex > 0 && <button onClick={() => setActiveCampaignIndex(prev => prev - 1)} className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors"><ChevronLeft className="w-5 h-5" /></button>}
                    <button onClick={() => activeCampaignIndex < activeCampaigns.length - 1 ? setActiveCampaignIndex(prev => prev + 1) : setShowCampaigns(false)} className="h-10 px-5 rounded-full bg-stone-900 text-white font-medium text-sm hover:bg-stone-800 transition-colors flex items-center gap-2">
                      {activeCampaignIndex < activeCampaigns.length - 1 ? <>Sonraki<ChevronRight className="w-4 h-4" /></> : "Menuye Git"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {activeCampaigns.length > 1 && <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">{activeCampaignIndex + 1} / {activeCampaigns.length}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
