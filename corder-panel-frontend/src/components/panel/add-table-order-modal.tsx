import { useMemo, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { formatCurrency } from "@/lib/format"
import type { PanelCategory, PanelProduct } from "@/lib/panel-types"
import { Minus, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react"

function descendantCategoryIds(rootId: string, cats: PanelCategory[]): Set<string> {
  const out = new Set<string>()
  const walk = (id: string) => {
    out.add(id)
    for (const c of cats) {
      if (c.parentId === id) walk(c.id)
    }
  }
  walk(rootId)
  return out
}

function ProductCard({
  product,
  onAddProduct,
}: {
  product: PanelProduct
  onAddProduct: (product: PanelProduct) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onAddProduct(product)}
      className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden hover:border-[#e63462]/50 hover:shadow-md transition-all text-left"
    >
      <div className="aspect-square bg-[#f5f5f7] relative overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-[#d1d1d6]" />
          </div>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[10px] font-medium">Stokta Yok</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[11px] font-medium text-[#1d1d1f] line-clamp-2 min-h-[28px]">{product.name}</p>
        <p className="text-[13px] font-bold text-[#e63462]">{"₺"}{formatCurrency(product.price)}</p>
      </div>
    </button>
  )
}

function ProductSubtree(props: {
  nodeId: string
  categories: PanelCategory[]
  products: PanelProduct[]
  depth: number
  onAddProduct: (product: PanelProduct) => void
}) {
  const { nodeId, categories, products, depth, onAddProduct } = props
  const node = categories.find((c) => c.id === nodeId)
  const nodeProducts = products.filter((p) => p.categoryId === nodeId)
  const childCats = categories
    .filter((c) => c.parentId === nodeId && c.showInTerminal !== false)
    .sort((a, b) => a.order - b.order)
  if (nodeProducts.length === 0 && childCats.length === 0) return null

  return (
    <div className={depth > 0 ? "mt-4" : ""}>
      {depth > 0 && (
        <h4 className="text-[12px] font-semibold text-[#86868b] mb-2 px-1">{node?.name ?? ""}</h4>
      )}
      {nodeProducts.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 mb-2">
          {nodeProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddProduct={onAddProduct} />
          ))}
        </div>
      )}
      {childCats.map((ch) => (
        <ProductSubtree
          key={ch.id}
          nodeId={ch.id}
          categories={categories}
          products={products}
          depth={depth + 1}
          onAddProduct={onAddProduct}
        />
      ))}
    </div>
  )
}

type CartLine = {
  productId: string
  productName: string
  price: number
  quantity: number
  image?: string
  note?: string
}

interface Props {
  tableId: string
  tableName: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddTableOrderModal({ tableId, tableName, onClose, onSuccess }: Props) {
  const { products, categories, createTableOrder, currentShift } = usePanelStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminalProducts = useMemo(
    () =>
      products.filter((p) => {
        const cat = categories.find((c) => c.id === p.categoryId)
        return cat && cat.showInTerminal !== false && p.inStock
      }),
    [products, categories],
  )

  const rootCategories = useMemo(
    () =>
      categories
        .filter((c) => c.showInTerminal !== false && !c.parentId)
        .sort((a, b) => a.order - b.order),
    [categories],
  )

  const filteredProducts = useMemo(() => {
    let filtered = terminalProducts
    if (searchQuery.trim()) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    } else if (selectedCategoryId) {
      const ids = descendantCategoryIds(selectedCategoryId, categories)
      filtered = filtered.filter((p) => ids.has(p.categoryId))
    }
    return filtered
  }, [terminalProducts, categories, searchQuery, selectedCategoryId])

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const addToCart = (product: PanelProduct) => {
    if (!product.inStock) return
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: 1,
          image: product.image,
        },
      ]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i
          const qty = i.quantity + delta
          return qty <= 0 ? null : { ...i, quantity: qty }
        })
        .filter(Boolean) as CartLine[],
    )
  }

  const saveNote = (productId: string) => {
    const note = noteValue.trim()
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, note: note || undefined } : item,
      ),
    )
    setEditingNote(null)
    setNoteValue("")
  }

  const handleSubmit = async () => {
    if (cart.length === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    const result = await createTableOrder(
      tableId,
      cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        note: i.note,
      })),
    )
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? "Siparis gonderilemedi")
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl h-[min(90vh,820px)] bg-[#f5f5f7] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex-shrink-0 h-[52px] px-4 bg-white border-b border-[#d1d1d6]/60 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Siparis Gir</h3>
            <p className="text-[11px] text-[#86868b]">{tableName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
          >
            <X className="w-4 h-4 text-[#86868b]" />
          </button>
        </div>

        {!currentShift && (
          <div className="px-4 py-2.5 bg-[#fff4e5] text-[12px] text-[#b54708] border-b border-[#f5d0a9]">
            Siparis gonderebilmek icin once kasayi acmaniz gerekir.
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 flex flex-col p-4 min-w-0">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
              <input
                type="text"
                placeholder="Urun ara..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (e.target.value) setSelectedCategoryId(null)
                }}
                className="w-full h-[42px] pl-10 pr-3 text-[13px] bg-white rounded-xl border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
              />
            </div>

            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(null)
                  setSearchQuery("")
                }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${
                  !selectedCategoryId && !searchQuery
                    ? "bg-[#e63462] text-white"
                    : "bg-white text-[#1d1d1f] border border-[#d1d1d6]/60"
                }`}
              >
                Tumu
              </button>
              {rootCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id)
                    setSearchQuery("")
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${
                    selectedCategoryId === cat.id
                      ? "bg-[#e63462] text-white"
                      : "bg-white text-[#1d1d1f] border border-[#d1d1d6]/60"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[220px] text-[#86868b]">
                  <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-[13px]">Urun bulunamadi</p>
                </div>
              ) : searchQuery.trim() || !selectedCategoryId ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAddProduct={addToCart} />
                  ))}
                </div>
              ) : (
                <ProductSubtree
                  nodeId={selectedCategoryId}
                  categories={categories}
                  products={filteredProducts}
                  depth={0}
                  onAddProduct={addToCart}
                />
              )}
            </div>
          </div>

          <div className="w-[300px] flex-shrink-0 bg-white border-l border-[#d1d1d6]/60 flex flex-col">
            <div className="px-4 py-3 border-b border-[#d1d1d6]/40">
              <p className="text-[13px] font-semibold text-[#1d1d1f]">Sepet ({cartCount})</p>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <p className="text-[12px] text-[#86868b] text-center mt-8">Urun secerek sepete ekleyin</p>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="rounded-xl bg-[#f5f5f7] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-[#1d1d1f] truncate">{item.productName}</p>
                        <p className="text-[11px] text-[#86868b]">{"₺"}{formatCurrency(item.price)}</p>
                        {item.note && (
                          <p className="mt-1 text-[11px] text-[#e63462] break-words">{item.note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((i) => i.productId !== item.productId))}
                        className="text-[#86868b] hover:text-[#ff3b30]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingNote === item.productId) {
                            setEditingNote(null)
                            setNoteValue("")
                          } else {
                            setEditingNote(item.productId)
                            setNoteValue(item.note ?? "")
                          }
                        }}
                        className="text-[11px] font-medium text-[#007aff] hover:opacity-70"
                      >
                        {item.note ? "Notu Duzenle" : "Not Ekle"}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 rounded-md bg-white border border-[#d1d1d6]/60 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[12px] font-semibold w-5 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 rounded-md bg-white border border-[#d1d1d6]/60 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-right text-[12px] font-bold text-[#1d1d1f]">
                      {"₺"}{formatCurrency(item.price * item.quantity)}
                    </div>
                    {editingNote === item.productId && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          placeholder="Ornegin: acisiz, az piskin..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNote(item.productId)
                            if (e.key === "Escape") {
                              setEditingNote(null)
                              setNoteValue("")
                            }
                          }}
                          className="min-w-0 flex-1 h-8 rounded-lg bg-white border border-[#d1d1d6]/60 px-2.5 text-[11px] focus:outline-none focus:border-[#e63462]/50"
                        />
                        <button
                          type="button"
                          onClick={() => saveNote(item.productId)}
                          className="text-[11px] font-semibold text-[#007aff]"
                        >
                          Tamam
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-[#d1d1d6]/60 space-y-2">
              {error && <p className="text-[11px] text-[#ff3b30]">{error}</p>}
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#86868b]">Toplam</span>
                <span className="font-bold text-[#e63462]">{"₺"}{formatCurrency(cartTotal)}</span>
              </div>
              <button
                type="button"
                disabled={cart.length === 0 || submitting || !currentShift}
                onClick={() => void handleSubmit()}
                className="w-full h-[40px] rounded-xl bg-[#e63462] hover:bg-[#d12d57] disabled:opacity-45 disabled:pointer-events-none text-white text-[13px] font-semibold transition-colors"
              >
                {submitting ? "Gonderiliyor..." : "Siparisi Gonder"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
