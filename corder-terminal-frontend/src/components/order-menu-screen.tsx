import { useState, useMemo, useEffect, useRef } from "react"
import { ChevronLeft, ShoppingCart, Search, X, Utensils, AlertTriangle, RefreshCw } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency, resolveImageUrl } from "@/lib/format"
import { useToast } from "@/components/ios-toast"
import type { TerminalCategory, TerminalProduct } from "@/lib/types"

const tableTitleByTableId: Record<string, string> = {}

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
  product: TerminalProduct
  onAdd: () => void
  disabled?: boolean
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const outOfStock = !product.isAvailable
  const actionDisabled = outOfStock || disabled
  const resolvedImage = resolveImageUrl(product.imageUrl)

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
        {resolvedImage && !imgFailed ? (
          <img
            src={resolvedImage}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center gap-0.5">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-[10px] font-bold text-destructive uppercase">Tükendi</span>
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-1">
        <span className="text-[12px] font-medium text-card-foreground leading-tight line-clamp-2 text-left">
          {product.name}
        </span>
        <span className="text-[12px] font-bold text-[#e63462] text-left">
          {"₺"}{formatCurrency(product.price)}
        </span>
      </div>
    </button>
  )
}

function CategoryProductSection(props: {
  category: TerminalCategory
  allCategories: TerminalCategory[]
  allProducts: TerminalProduct[]
  depth: number
  isBillRequested: boolean
  onAdd: (product: TerminalProduct) => void
}) {
  const { category, allCategories, allProducts, depth, isBillRequested, onAdd } = props
  const directProducts = allProducts.filter((p) => p.categoryId === category.id)
  const childCategories = allCategories.filter((c) => c.parentId === category.id)

  if (directProducts.length === 0 && childCategories.length === 0) return null

  return (
    <div className={depth > 0 ? "mt-4" : ""}>
      {depth > 0 && (
        <h4 className={`text-[12px] font-semibold text-muted-foreground mb-2 px-1 ${depth > 1 ? "text-[11px]" : ""}`}>
          {category.name}
        </h4>
      )}
      {directProducts.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-2">
          {directProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={() => onAdd(product)}
              disabled={isBillRequested}
            />
          ))}
        </div>
      )}
      {childCategories.map((child) => (
        <CategoryProductSection
          key={child.id}
          category={child}
          allCategories={allCategories}
          allProducts={allProducts}
          depth={depth + 1}
          isBillRequested={isBillRequested}
          onAdd={onAdd}
        />
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
  const {
    tables,
    categories,
    products,
    selectedCategory,
    selectCategory,
    addToCart,
    getCartItemCount,
    hasPermission,
    refreshData,
    isLoading,
    error,
  } = useApp()
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const autoReloadAttemptedRef = useRef(false)

  const canCreateOrder = hasPermission("order.create")
  const rootCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories])

  useEffect(() => {
    if (products.length === 0 && !isLoading && !autoReloadAttemptedRef.current) {
      autoReloadAttemptedRef.current = true
      void refreshData()
    }
  }, [products.length, isLoading, refreshData])

  useEffect(() => {
    if (rootCategories.length === 0) return
    const currentValid =
      selectedCategory &&
      rootCategories.some((c) => c.id === selectedCategory && c.productCount > 0)
    if (!currentValid) {
      const preferred =
        rootCategories.find((c) => c.productCount > 0) ?? rootCategories[0]
      if (preferred && preferred.id !== selectedCategory) {
        selectCategory(preferred.id)
      }
    }
  }, [rootCategories, selectedCategory, selectCategory])

  const activeCategoryId =
    (selectedCategory && rootCategories.some((c) => c.id === selectedCategory)
      ? selectedCategory
      : rootCategories.find((c) => c.productCount > 0)?.id ?? rootCategories[0]?.id) ?? ""
  const activeRootCategory = useMemo(
    () => rootCategories.find((c) => c.id === activeCategoryId) ?? null,
    [rootCategories, activeCategoryId]
  )

  const searchedProducts = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR")
    return products.filter((p) => p.name.toLocaleLowerCase("tr-TR").includes(query))
  }, [searchQuery, products])

  const table = tables.find((t) => t.id === tableId)
  const isBillRequested = table?.status === "bill-requested"

  useEffect(() => {
    if (table?.name) tableTitleByTableId[tableId] = table.name
  }, [table?.name, tableId])

  const cartCount = getCartItemCount()
  const headerTitle = table?.name ?? tableTitleByTableId[tableId] ?? "Menü"

  const handleAddProduct = (product: TerminalProduct) => {
    if (!canCreateOrder) {
      showToast("Sipariş oluşturma yetkiniz bulunmuyor.", "error")
      return
    }
    if (isBillRequested) {
      showToast("Masa hesap kesiminde. Modal kapanana kadar sipariş eklenemez.", "error")
      return
    }
    if (!product.isAvailable) {
      showToast(`${product.name} stokta yok`, "error")
      return
    }
    addToCart(product, 1)
    showToast(`${product.name} sepete eklendi`)
  }

  if (error && categories.length === 0) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <OrderMenuHeaderBar onBack={onBack} title={headerTitle} actions="none" />
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
          {error}
        </div>
      </div>
    )
  }

  if (isLoading && categories.length === 0) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <OrderMenuHeaderBar onBack={onBack} title={headerTitle} actions="none" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Yükleniyor...
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
        onSearchToggle={() => setShowSearch((prev) => !prev)}
        onCartOpen={onCartOpen}
      />
      {isBillRequested && (
        <div className="mx-3 mt-2 rounded-xl border border-[#0a84ff]/35 bg-[#0a84ff]/10 px-3 py-2 text-[12px] text-[#0a4f99]">
          Hesap Kes penceresi açık. Bu masa için yeni sipariş ekleme geçici olarak kilitlendi.
        </div>
      )}

      {showSearch && (
        <div className="bg-background px-4 py-2 flex-shrink-0 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ürün ara..."
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
                aria-label="Aramayı temizle"
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
          {rootCategories.map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() => selectCategory(category.id)}
              className={`px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors relative ${
                activeCategoryId === category.id ? "text-[#e63462]" : "text-muted-foreground"
              }`}
            >
              {category.name}
              {activeCategoryId === category.id && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#e63462] rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 ios-scroll">
        {searchQuery ? (
          searchedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-[15px]">Ürün bulunamadı</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {searchedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => handleAddProduct(product)}
                  disabled={isBillRequested || !canCreateOrder}
                />
              ))}
            </div>
          )
        ) : activeRootCategory && activeRootCategory.productCount > 0 ? (
          <CategoryProductSection
            category={activeRootCategory}
            allCategories={categories}
            allProducts={products}
            depth={0}
            isBillRequested={isBillRequested || !canCreateOrder}
            onAdd={handleAddProduct}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Search className="h-8 w-8 opacity-40" />
            <p className="text-[15px]">
              {isLoading ? "Menü yükleniyor..." : "Ürün bulunamadı"}
            </p>
            {!isLoading && products.length === 0 && (
              <button
                type="button"
                onClick={() => void refreshData()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#e63462] px-4 py-2 text-[13px] font-semibold text-white active:opacity-85"
              >
                <RefreshCw className="h-4 w-4" />
                Menüyü Yenile
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
