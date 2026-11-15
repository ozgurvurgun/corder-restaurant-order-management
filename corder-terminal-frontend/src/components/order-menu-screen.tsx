import { useState, useMemo, useEffect } from "react"
import { ChevronLeft, ShoppingCart, Search, X, Utensils, AlertTriangle } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { useToast } from "@/components/ios-toast"
import { api, getToken } from "@/lib/api"
import type { MenuBusinessDto, MenuCategoryTree } from "@/lib/api"

/** Shows the same data without waiting for refetch when switching cart ↔ menu (reduces header jump). */
const menuBusinessByRestaurantId: Partial<Record<string, MenuBusinessDto>> = {}

/** Avoid a one-frame "Menu" flash when `tables` lags; keep the last known table name. */
const tableTitleByTableId: Record<string, string> = {}

type CartProduct = { id: string; name: string; price: number; inStock: boolean }

function OrderMenuHeaderBar(props: {
  onBack: () => void
  title: string
  actions: "none" | "full"
  cartCount?: number
  onSearchToggle?: () => void
  onCartOpen?: () => void
}) {
  const { onBack, title, actions, cartCount = 0, onSearchToggle, onCartOpen } = props
  return (
    <header className="bg-[#e63462] text-white flex items-center flex-shrink-0 safe-top relative h-[44px]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onBack()
        }}
        className="flex items-center gap-0.5 pl-3 pr-3 h-full active:opacity-60 z-10 touch-manipulation"
        aria-label="Geri"
      >
        <ChevronLeft className="h-[22px] w-[22px]" />
        <span className="text-[17px]">Geri</span>
      </button>
      <h1 className="text-[17px] font-semibold absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[46%] truncate pointer-events-none">
        {title}
      </h1>
      <div className="ml-auto flex items-center justify-end gap-1 pr-3 z-10 min-w-[92px]">
        {actions === "full" && onSearchToggle && onCartOpen ? (
          <>
            <button type="button" onClick={onSearchToggle} className="p-2 active:opacity-60" aria-label="Ara">
              <Search className="h-[20px] w-[20px]" />
            </button>
            <button type="button" onClick={onCartOpen} className="p-2 relative active:opacity-60" aria-label="Sepet">
              <ShoppingCart className="h-[22px] w-[22px]" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-white text-[#e63462] text-[11px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </>
        ) : (
          <span className="inline-block h-10 w-[76px] shrink-0" aria-hidden />
        )}
      </div>
    </header>
  )
}

function ProductCard({
  product,
  onAdd,
  disabled = false,
}: {
  product: { id: string; name: string; price: number; image?: string; inStock: boolean }
  onAdd: () => void
  disabled?: boolean
}) {
  const outOfStock = !product.inStock
  const actionDisabled = outOfStock || disabled

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={actionDisabled}
      className={`bg-card rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all active:scale-[0.96] ${
        actionDisabled ? "opacity-40" : ""
      }`}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-1">
        <span className="text-[12px] font-medium text-card-foreground leading-tight line-clamp-2 text-left">
          {product.name}
        </span>
        <span className="text-[12px] font-bold text-[#e63462] text-left">
          ₺{formatCurrency(product.price)}
        </span>
      </div>
    </button>
  )
}

function SubTreeProducts(props: {
  node: MenuCategoryTree
  depth: number
  isCheckoutLocked: boolean
  onAdd: (p: CartProduct) => void
}) {
  const { node, depth, isCheckoutLocked, onAdd } = props
  const hasBlock = node.products.length > 0 || (node.children ?? []).length > 0
  if (!hasBlock) return null

  return (
    <div className={depth > 0 ? "mt-4" : ""}>
      {depth > 0 && (
        <h4
          className={`text-[12px] font-semibold text-muted-foreground mb-2 px-1 ${depth > 1 ? "text-[11px]" : ""}`}
        >
          {node.name}
        </h4>
      )}
      {node.products.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-2">
          {node.products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                name: p.name,
                price: p.price,
                image: p.imageUrl,
                inStock: p.inStock,
              }}
              onAdd={() => onAdd({ id: p.id, name: p.name, price: p.price, inStock: p.inStock })}
              disabled={isCheckoutLocked}
            />
          ))}
        </div>
      )}
      {(node.children ?? []).map((ch) => (
        <SubTreeProducts key={ch.id} node={ch} depth={depth + 1} isCheckoutLocked={isCheckoutLocked} onAdd={onAdd} />
      ))}
    </div>
  )
}

interface OrderMenuScreenProps {
  tableId: string
  onBack: () => void
  onCartOpen: () => void
}

export function OrderMenuScreen({ tableId, onBack, onCartOpen }: OrderMenuScreenProps) {
  const { restaurant, tables, cart, addToCart } = useApp()
  const { showToast } = useToast()
  const [menu, setMenu] = useState<MenuBusinessDto | null>(() => {
    const rid = restaurant?.id
    return rid && menuBusinessByRestaurantId[rid] ? menuBusinessByRestaurantId[rid]! : null
  })
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const rid = restaurant?.id
    const token = getToken()
    if (!rid || !token) return
    const cached = menuBusinessByRestaurantId[rid] ?? null
    setMenu(cached)
    setMenuLoadError(null)
    const hadCache = !!cached
    let cancelled = false
    api.menu
      .terminal(token)
      .then((m) => {
        if (cancelled) return
        menuBusinessByRestaurantId[rid] = m
        setMenu(m)
      })
      .catch((e) => {
        if (cancelled) return
        if (!hadCache) setMenuLoadError(e instanceof Error ? e.message : "Menu yuklenemedi")
      })
    return () => {
      cancelled = true
    }
  }, [restaurant?.id])

  const roots = useMemo(() => menu?.categories ?? [], [menu])

  const allProducts = useMemo(() => {
    const acc: (CartProduct & { image?: string; description?: string })[] = []
    const walk = (n: MenuCategoryTree) => {
      for (const p of n.products) {
        acc.push({
          id: p.id,
          name: p.name,
          price: p.price,
          inStock: p.inStock,
          image: p.imageUrl,
          description: p.description,
        })
      }
      for (const ch of n.children ?? []) walk(ch)
    }
    roots.forEach(walk)
    return acc
  }, [roots])

  useEffect(() => {
    if (roots.length > 0 && !activeCategory) setActiveCategory(roots[0].id)
  }, [roots, activeCategory])

  const activeRootNode = useMemo(() => roots.find((r) => r.id === activeCategory), [roots, activeCategory])

  const filteredProducts = useMemo(() => {
    if (searchQuery) {
      return allProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    const acc: (CartProduct & { image?: string })[] = []
    const walk = (n: MenuCategoryTree) => {
      for (const p of n.products) {
        acc.push({
          id: p.id,
          name: p.name,
          price: p.price,
          inStock: p.inStock,
          image: p.imageUrl,
        })
      }
      for (const ch of n.children ?? []) walk(ch)
    }
    if (activeRootNode) walk(activeRootNode)
    return acc
  }, [searchQuery, allProducts, activeRootNode])

  const table = tables.find((t) => t.id === tableId)
  const isCheckoutLocked = table?.status === "checkout"

  useEffect(() => {
    if (table?.name) tableTitleByTableId[tableId] = table.name
  }, [table?.name, tableId])
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handleAddProduct = (product: CartProduct) => {
    if (isCheckoutLocked) {
      showToast("Masa hesap kesiminde. Modal kapanana kadar siparis eklenemez.", "error")
      return
    }
    if (!product.inStock) {
      showToast(`${product.name} stokta yok`, "error")
      return
    }
    addToCart({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: 1,
    })
    showToast(`${product.name} sepete eklendi`)
  }

  const headerTitle = table?.name ?? tableTitleByTableId[tableId] ?? "Menu"

  if (menuLoadError) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <OrderMenuHeaderBar onBack={onBack} title={headerTitle} actions="none" />
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
          {menuLoadError}
        </div>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <OrderMenuHeaderBar onBack={onBack} title={headerTitle} actions="none" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Yukleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-background">
      <OrderMenuHeaderBar
        onBack={onBack}
        title={headerTitle}
        actions="full"
        cartCount={cartCount}
        onSearchToggle={() => setShowSearch((v) => !v)}
        onCartOpen={onCartOpen}
      />
      {isCheckoutLocked && (
        <div className="mx-3 mt-2 rounded-xl border border-[#0a84ff]/35 bg-[#0a84ff]/10 px-3 py-2 text-[12px] text-[#0a4f99]">
          Hesap Kes penceresi acik. Bu masa icin yeni siparis ekleme gecici olarak kilitlendi.
        </div>
      )}

      {showSearch && (
        <div className="bg-background px-4 py-2 flex-shrink-0 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Urun ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted rounded-xl pl-9 pr-9 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setShowSearch(false)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {!searchQuery && (
        <div className="flex bg-background overflow-x-auto flex-shrink-0 px-2 ios-scroll border-b border-border">
          {roots.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors relative ${
                activeCategory === cat.id ? "text-[#e63462]" : "text-muted-foreground"
              }`}
            >
              {cat.name}
              {activeCategory === cat.id && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#e63462] rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 ios-scroll">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-[15px]">Urun bulunamadi</p>
          </div>
        ) : searchQuery ? (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image: product.image,
                  inStock: product.inStock,
                }}
                onAdd={() => handleAddProduct(product)}
                disabled={isCheckoutLocked}
              />
            ))}
          </div>
        ) : activeRootNode ? (
          <SubTreeProducts node={activeRootNode} depth={0} isCheckoutLocked={isCheckoutLocked} onAdd={handleAddProduct} />
        ) : null}
      </div>
    </div>
  )
}
