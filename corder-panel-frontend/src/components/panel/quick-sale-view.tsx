import { useState, useMemo, useRef } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { formatCurrency } from "@/lib/format"
import { usePanelToast } from "./panel-toast"
import { Search, X, ShoppingBag, Banknote, CreditCard, UtensilsCrossed, Smartphone, Minus, Plus, Trash2, Printer, Loader2 } from "lucide-react"
import type { PanelCategory, PanelPaymentMethod, PanelProduct } from "@/lib/panel-types"

function descendantCategoryIds(rootId: string, cats: PanelCategory[]): Set<string> {
  const out = new Set<string>()
  const walk = (id: string) => {
    out.add(id)
    for (const c of cats) { if (c.parentId === id) walk(c.id) }
  }
  walk(rootId)
  return out
}

function ProductCard({ product, onAdd, disabled }: { product: PanelProduct; onAdd: (p: PanelProduct) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(product)}
      className="bg-white rounded-2xl border border-[#d1d1d6]/60 overflow-hidden hover:border-[#e63462]/50 hover:shadow-md transition-all group text-left disabled:opacity-60 disabled:pointer-events-none"
    >
      <div className="aspect-square bg-[#f5f5f7] relative overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-[#d1d1d6]" />
          </div>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[11px] font-medium">Stokta Yok</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[12px] font-medium text-[#1d1d1f] line-clamp-2 mb-1 min-h-[32px]">{product.name}</p>
        <p className="text-[15px] font-bold text-[#e63462]">{"\u20BA"}{formatCurrency(product.price)}</p>
      </div>
    </button>
  )
}

function QuickSaleSubtree(props: {
  nodeId: string
  categories: PanelCategory[]
  products: PanelProduct[]
  depth: number
  disabled?: boolean
  onAddProduct: (product: PanelProduct) => void
}) {
  const { nodeId, categories, products, depth, disabled, onAddProduct } = props
  const node = categories.find((c) => c.id === nodeId)
  const nodeProducts = products.filter((p) => p.categoryId === nodeId)
  const childCats = categories.filter((c) => c.parentId === nodeId && c.showInQuickSale !== false).sort((a, b) => a.order - b.order)
  if (nodeProducts.length === 0 && childCats.length === 0) return null

  return (
    <div className={depth > 0 ? "mt-4" : ""}>
      {depth > 0 && <h4 className="text-[12px] font-semibold text-[#86868b] mb-2 px-1">{node?.name ?? ""}</h4>}
      {nodeProducts.length > 0 && (
        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-2">
          {nodeProducts.map((product) => <ProductCard key={product.id} product={product} disabled={disabled} onAdd={onAddProduct} />)}
        </div>
      )}
      {childCats.map((ch) => (
        <QuickSaleSubtree key={ch.id} nodeId={ch.id} categories={categories} products={products} depth={depth + 1} disabled={disabled} onAddProduct={onAddProduct} />
      ))}
    </div>
  )
}

const PAYMENT_METHODS = [
  { id: "cash" as const, label: "Nakit", icon: Banknote, color: "text-green-600 bg-green-50" },
  { id: "credit-card" as const, label: "Kredi Kartı", icon: CreditCard, color: "text-blue-600 bg-blue-50" },
  { id: "meal-card" as const, label: "Yemek Kartı", icon: UtensilsCrossed, color: "text-orange-600 bg-orange-50" },
  { id: "multinet" as const, label: "Multinet", icon: Smartphone, color: "text-purple-600 bg-purple-50" },
]

export default function QuickSaleView() {
  const { products, categories, currentShift, addQuickSale, reprintReceipt, currentUser } = usePanelStore()
  const { showToast } = usePanelToast()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [cartItems, setCartItems] = useState<{ productId: string; name: string; price: number; quantity: number; image?: string }[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PanelPaymentMethod>("cash")
  const [showSuccess, setShowSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastSaleForPrint, setLastSaleForPrint] = useState<{
    items: { productName: string; quantity: number; price: number; productId?: string; categoryId?: string }[]
    total: number
  } | null>(null)

  const quickSaleProducts = useMemo(
    () => products.filter((p) => { const cat = categories.find((c) => c.id === p.categoryId); return cat && cat.showInQuickSale !== false && p.inStock }),
    [products, categories],
  )

  const quickSaleRootCategories = useMemo(
    () => categories.filter((c) => c.showInQuickSale !== false && !c.parentId).sort((a, b) => a.order - b.order),
    [categories],
  )

  const filteredProducts = useMemo(() => {
    let filtered = quickSaleProducts
    if (searchQuery.trim()) filtered = filtered.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    else if (selectedCategoryId) {
      const ids = descendantCategoryIds(selectedCategoryId, categories)
      filtered = filtered.filter((p) => ids.has(p.categoryId))
    }
    return filtered
  }, [quickSaleProducts, categories, searchQuery, selectedCategoryId])

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const addToCart = (product: PanelProduct) => {
    if (isSubmitting || submittingRef.current) return
    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.image }]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    if (isSubmitting || submittingRef.current) return
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.productId === productId) {
          const newQty = i.quantity + delta
          return newQty <= 0 ? null : { ...i, quantity: newQty }
        }
        return i
      }).filter(Boolean) as typeof prev,
    )
  }

  const removeFromCart = (productId: string) => {
    if (isSubmitting || submittingRef.current) return
    setCartItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const completeSale = async () => {
    if (cartItems.length === 0 || !currentShift || isSubmitting || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await addQuickSale(
        cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
      )
      if (!res.ok || !res.completedOrder) {
        setErrorMsg(res.error || "Satış tamamlanamadı")
        return
      }
      const serverItems = res.completedOrder.orders[0]?.items ?? []
      setLastSaleForPrint({
        items: serverItems.map((i) => ({
          productName: i.productName, quantity: i.quantity, price: i.price,
          productId: i.productId, categoryId: products.find((x) => x.id === i.productId)?.categoryId,
        })),
        total: res.completedOrder.netAmount,
      })
      setCartItems([])
      setShowSuccess(true)
      showToast(`Hızlı satış tamamlandı — ₺${formatCurrency(res.completedOrder.netAmount)}`, "success")
      setTimeout(() => setShowSuccess(false), 5000)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handlePrintReceipt = () => {
    if (!lastSaleForPrint) return
    void reprintReceipt({ tableName: "Elden Satış", waiterName: currentUser?.name ?? "Kasa", items: lastSaleForPrint.items, total: lastSaleForPrint.total })
  }

  return (
    <div className="h-full flex bg-[#f5f5f7]">
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#86868b]" />
          <input
            type="text"
            placeholder="Ürün ara..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setSelectedCategoryId(null) }}
            className="w-full h-[48px] pl-12 pr-4 text-[14px] bg-white rounded-2xl border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#86868b]/20 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-[#86868b]" />
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 flex-shrink-0">
          <button
            onClick={() => { setSelectedCategoryId(null); setSearchQuery("") }}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors ${!selectedCategoryId && !searchQuery ? "bg-[#e63462] text-white" : "bg-white text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60"}`}
          >
            Tümü
          </button>
          {quickSaleRootCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setSelectedCategoryId(cat.id); setSearchQuery("") }}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-colors ${selectedCategoryId === cat.id ? "bg-[#e63462] text-white" : "bg-white text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-[#86868b]">
              <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-[14px]">Ürün bulunamadı</p>
            </div>
          ) : searchQuery.trim() || !selectedCategoryId ? (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} disabled={isSubmitting} onAdd={addToCart} />)}
            </div>
          ) : (
            <QuickSaleSubtree nodeId={selectedCategoryId} categories={categories} products={quickSaleProducts} depth={0} disabled={isSubmitting} onAddProduct={addToCart} />
          )}
        </div>
      </div>

      <div className="w-[380px] bg-white border-l border-[#d1d1d6]/60 flex flex-col">
        <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Hızlı Satış</h2>
            <p className="text-[12px] text-[#86868b]">{cartItemCount} ürün</p>
          </div>
          {cartItems.length > 0 && (
            <button disabled={isSubmitting} onClick={() => setCartItems([])} className="text-[12px] text-red-500 hover:text-red-600 font-medium disabled:opacity-50">Temizle</button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#aeaeb2]">
              <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-[14px] font-medium">Sepet boş</p>
              <p className="text-[12px] mt-1">Ürün eklemek için sol taraftan seçin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 bg-[#f9f9fb] rounded-xl p-3">
                  <div className="w-12 h-12 rounded-lg bg-[#e8e8ed] overflow-hidden flex-shrink-0">
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-[#aeaeb2]" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{item.name}</p>
                    <p className="text-[12px] text-[#86868b]">{"\u20BA"}{formatCurrency(item.price)} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button disabled={isSubmitting} onClick={() => updateQuantity(item.productId, -1)} className="w-8 h-8 rounded-lg bg-white border border-[#d1d1d6]/60 flex items-center justify-center hover:bg-[#f5f5f7] disabled:opacity-50"><Minus className="w-4 h-4 text-[#86868b]" /></button>
                    <span className="w-8 text-center text-[13px] font-semibold">{item.quantity}</span>
                    <button disabled={isSubmitting} onClick={() => updateQuantity(item.productId, 1)} className="w-8 h-8 rounded-lg bg-white border border-[#d1d1d6]/60 flex items-center justify-center hover:bg-[#f5f5f7] disabled:opacity-50"><Plus className="w-4 h-4 text-[#86868b]" /></button>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[13px] font-bold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(item.price * item.quantity)}</span>
                    <button disabled={isSubmitting} onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-500 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#f0f0f0] p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[14px] font-medium text-[#86868b]">Toplam</span>
            <span className="text-[28px] font-bold text-[#e63462]">{"\u20BA"}{formatCurrency(cartTotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon
              const isSelected = paymentMethod === method.id
              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all disabled:opacity-50 ${isSelected ? "border-[#e63462] bg-[#e63462]/5" : "border-[#d1d1d6]/60 hover:border-[#86868b]"}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${method.color}`}><Icon className="w-4 h-4" /></div>
                  <span className={`text-[12px] font-medium ${isSelected ? "text-[#e63462]" : "text-[#1d1d1f]"}`}>{method.label}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => void completeSale()}
            disabled={cartItems.length === 0 || !currentShift || isSubmitting}
            className="w-full h-[52px] bg-[#34c759] text-white rounded-2xl text-[15px] font-semibold hover:bg-[#2db84e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                İşleniyor...
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5" />
                Satışı Tamamla
              </>
            )}
          </button>
          {errorMsg && <p className="text-[11px] text-red-500 text-center mt-3">{errorMsg}</p>}
          {!currentShift && <p className="text-[11px] text-red-500 text-center mt-3">Kasa kapalı. Satış yapabilmek için Kasa sayfasından vardiyayı açın.</p>}
          {showSuccess && (
            <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-[13px] font-medium text-green-700 text-center mb-3">Satış başarıyla tamamlandı!</p>
              <button type="button" onClick={handlePrintReceipt} className="w-full h-[40px] bg-[#1d1d1f] text-white rounded-xl text-[13px] font-medium hover:bg-[#3a3a3c] transition-colors flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Fiş Yazdır
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
