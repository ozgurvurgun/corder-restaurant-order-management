import { useState, useCallback, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api, getBase } from "@/lib/api"
import { Plus, Pencil, Trash2, Search, Package, ToggleLeft, ToggleRight, X, ImageIcon, Monitor, Menu, Settings2, Zap, CornerDownRight, AlertTriangle } from "lucide-react"
import type { PanelCategory } from "@/lib/panel-types"
import { orderedCategoryList } from "@/lib/panel-api-sync"
import ImageUpload from "./image-upload"
import type { PanelProduct } from "@/lib/panel-types"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }

function productImageSrc(url: string | undefined): string {
  if (!url) return ""
  if (url.startsWith("http")) return url
  const base = getBase()
  return base ? `${base}${url.startsWith("/") ? "" : "/"}${url}` : url
}

function categoryDepth(cats: PanelCategory[], id: string): number {
  let d = 0
  let cur = cats.find((c) => c.id === id)
  while (cur?.parentId) {
    d++
    cur = cats.find((c) => c.id === cur!.parentId)
  }
  return d
}

function descendantIdSet(cats: PanelCategory[], rootId: string): Set<string> {
  const out = new Set<string>()
  const walk = (pid: string) => {
    for (const c of cats.filter((x) => x.parentId === pid)) {
      out.add(c.id)
      walk(c.id)
    }
  }
  walk(rootId)
  return out
}

export default function ProductManagement() {
  const { token } = usePanelAuth()
  const { categories, products, addCategory, updateCategory, deleteCategory, addProduct, updateProduct, deleteProduct, reorderCategories, reorderProducts } = usePanelStore()
  const handleUpload = useCallback((file: File) => {
    if (!token) return Promise.reject(new Error("Giriş gerekli"))
    return api.upload(token, file).then((r) => r.url)
  }, [token])
  const [selectedCat, setSelectedCat] = useState("")
  const [search, setSearch] = useState("")
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryParentId, setNewCategoryParentId] = useState("")
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editingCatSettings, setEditingCatSettings] = useState<PanelCategory | null>(null)
  const [editingProduct, setEditingProduct] = useState<PanelProduct | null>(null)
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null)
  const [dragProductId, setDragProductId] = useState<string | null>(null)
  /** Product delete confirmation */
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<PanelProduct | null>(null)
  /** Category delete: two-step confirmation (1 -> 2) */
  const [categoryDeleteStep, setCategoryDeleteStep] = useState<null | { id: string; name: string; step: 1 | 2 }>(null)

  // Form states for adding new product
  const [productName, setProductName] = useState("")
  const [productPrice, setProductPrice] = useState("")
  const [productDesc, setProductDesc] = useState("")
  const [productImage, setProductImage] = useState("")
  const [catName, setCatName] = useState("")

  useEffect(() => {
    if (!categories.length) return
    const ordered = orderedCategoryList(categories)
    if (!ordered[0]) return
    setSelectedCat((cur) => (cur && ordered.some((c) => c.id === cur) ? cur : ordered[0].id))
  }, [categories])

  // Form states for editing product
  const [editName, setEditName] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editImage, setEditImage] = useState("")

  const catProducts = products.filter((p) => {
    const matchCat = p.categoryId === selectedCat
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleAddProduct = () => {
    if (!productName.trim() || !productPrice.trim()) return
    addProduct({ 
      name: productName, 
      price: parseFloat(productPrice), 
      categoryId: selectedCat, 
      inStock: true, 
      description: productDesc || undefined,
      image: productImage || undefined
    })
    setProductName(""); setProductPrice(""); setProductDesc(""); setProductImage(""); setShowAddProduct(false)
  }

  const handleAddCategory = () => {
    if (!catName.trim()) return
    addCategory(catName, { parentId: newCategoryParentId.trim() || null })
    setCatName("")
    setNewCategoryParentId("")
    setShowAddCategory(false)
  }

  const openEditModal = (product: PanelProduct) => {
    setEditingProduct(product)
    setEditName(product.name)
    setEditPrice(product.price.toString())
    setEditDesc(product.description || "")
    setEditImage(product.image || "")
  }

  const handleUpdateProduct = () => {
    if (!editingProduct || !editName.trim() || !editPrice.trim()) return
    updateProduct(editingProduct.id, {
      name: editName,
      price: parseFloat(editPrice),
      description: editDesc || undefined,
      image: editImage || undefined,
    })
    setEditingProduct(null)
  }

  return (
    <div className="h-full flex">
      {/* Left: Categories */}
      <div className="w-[220px] h-full border-r border-[#d1d1d6]/60 bg-white flex flex-col flex-shrink-0">
        <div className="h-[52px] border-b border-[#d1d1d6]/60 flex items-center justify-between px-4">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Kategoriler</h3>
          <button
            type="button"
            onClick={() => {
              setShowAddCategory(true)
              setCatName("")
              setNewCategoryParentId("")
            }}
            className="w-6 h-6 rounded-md bg-[#e63462]/10 flex items-center justify-center hover:bg-[#e63462]/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#e63462]" />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {orderedCategoryList(categories).map((cat) => (
          <div
            key={cat.id}
            className="group"
            draggable
            onDragStart={() => setDragCategoryId(cat.id)}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              if (!dragCategoryId || dragCategoryId === cat.id) return
              const fromCat = categories.find((c) => c.id === dragCategoryId)
              const toCat = categories.find((c) => c.id === cat.id)
              if (!fromCat || !toCat) return
              const p1 = fromCat.parentId ?? null
              const p2 = toCat.parentId ?? null
              if (p1 !== p2) {
                setDragCategoryId(null)
                return
              }
              const siblings = categories
                .filter((c) => (c.parentId ?? null) === p2)
                .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
              const fromIndex = siblings.findIndex((c) => c.id === dragCategoryId)
              const toIndex = siblings.findIndex((c) => c.id === cat.id)
              if (fromIndex === -1 || toIndex === -1) return
              const next = [...siblings]
              const [moved] = next.splice(fromIndex, 1)
              next.splice(toIndex, 0, moved)
              reorderCategories(next.map((c) => c.id), p2)
              setDragCategoryId(null)
            }}
          >
              {editingCat === cat.id ? (
                <div className="flex items-center gap-1 px-3 py-1">
                  <input
                    type="text"
                    defaultValue={cat.name}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { updateCategory(cat.id, { name: e.currentTarget.value }); setEditingCat(null) }
                      if (e.key === "Escape") setEditingCat(null)
                    }}
                    onBlur={(e) => { updateCategory(cat.id, { name: e.target.value }); setEditingCat(null) }}
                    className="flex-1 h-[28px] px-2 text-[13px] bg-[#f5f5f7] rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  style={{ paddingLeft: `${12 + categoryDepth(categories, cat.id) * 12}px` }}
                  className={`w-full text-left pr-4 py-2 text-[13px] flex items-center justify-between gap-1 transition-colors ${
                    selectedCat === cat.id ? "bg-[#e63462]/10 text-[#e63462] font-medium" : "text-[#1d1d1f] hover:bg-black/[0.03]"
                  }`}
                >
                  <span className="truncate flex-1 flex items-center gap-2">
                    {cat.name}
                    <div className="flex items-center gap-0.5">
                      {cat.showInTerminal && <Monitor className="w-2.5 h-2.5 text-blue-500" />}
                      {cat.showInMenu && <Menu className="w-2.5 h-2.5 text-green-500" />}
                    </div>
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-[#86868b]">{products.filter((p) => p.categoryId === cat.id).length}</span>
                    <button onClick={(e) => { e.stopPropagation(); setEditingCatSettings(cat) }} className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/5">
                      <Settings2 className="w-3 h-3 text-[#86868b]" />
                    </button>
                    <button
                      type="button"
                      title="Alt kategori"
                      onClick={(e) => {
                        e.stopPropagation()
                        setNewCategoryParentId(cat.id)
                        setCatName("")
                        setShowAddCategory(true)
                      }}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/5"
                    >
                      <CornerDownRight className="w-3 h-3 text-[#86868b]" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingCat(cat.id) }} className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/5">
                      <Pencil className="w-3 h-3 text-[#86868b]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCategoryDeleteStep({ id: cat.id, name: cat.name, step: 1 })
                      }}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add category modal inline */}
        {showAddCategory && (
          <div className="px-3 py-2 border-t border-[#d1d1d6]/40">
            <label className="block text-[10px] font-medium text-[#86868b] mb-0.5">Ust kategori</label>
            <select
              value={newCategoryParentId}
              onChange={(e) => setNewCategoryParentId(e.target.value)}
              className="w-full h-[28px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 mb-1.5"
            >
              <option value="">Ana kategori</option>
              {orderedCategoryList(categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {"\u00A0".repeat(categoryDepth(categories, c.id) * 2)}
                  {c.name}
                </option>
              ))}
            </select>
            <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Kategori adi" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setShowAddCategory(false) }}
              className="w-full h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 mb-1.5" />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(false)
                  setNewCategoryParentId("")
                }}
                className="flex-1 h-[28px] text-[11px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
              >
                Iptal
              </button>
              <button onClick={handleAddCategory} className="flex-1 h-[28px] text-[11px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]">Ekle</button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Products */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Urunler</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
              <input type="text" placeholder="Urun ara..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-[30px] w-[180px] pl-8 pr-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 focus:ring-1 focus:ring-[#e63462]/20" />
            </div>
            <button onClick={() => { setShowAddProduct(true); setProductName(""); setProductPrice(""); setProductDesc(""); setProductImage("") }}
              className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Urun Ekle
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {/* Add product form */}
          {showAddProduct && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-semibold text-[#1d1d1f]">Yeni Urun</h4>
                <button onClick={() => setShowAddProduct(false)} className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                  <X className="w-3 h-3 text-[#86868b]" />
                </button>
              </div>
              <div className="flex gap-3">
                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Urun adi"
                  className="flex-1 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="Fiyat"
                  className="w-[120px] h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              </div>
              <input type="text" value={productDesc} onChange={(e) => setProductDesc(e.target.value)} placeholder="Aciklama (opsiyonel)"
                className="w-full mt-2 h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
              <div className="mt-3">
                <ImageUpload
                  value={productImage}
                  onChange={setProductImage}
                  label="Urun Fotografı (opsiyonel)"
                  onUpload={token ? handleUpload : undefined}
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setShowAddProduct(false)} className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]">Iptal</button>
                <button onClick={handleAddProduct} className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]">Kaydet</button>
              </div>
            </div>
          )}

          {/* Product table */}
          <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Urun</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Fiyat</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Stok</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[100px]">Islem</th>
                </tr>
              </thead>
              <tbody
                onDragOver={(e) => { if (dragProductId) e.preventDefault() }}
              >
                {catProducts.map((product, idx) => (
                  <tr
                    key={product.id}
                    className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] transition-colors ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}
                    draggable
                    onDragStart={() => setDragProductId(product.id)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (!dragProductId || dragProductId === product.id) return
                      const current = catProducts
                      const fromIndex = current.findIndex((p) => p.id === dragProductId)
                      const toIndex = current.findIndex((p) => p.id === product.id)
                      if (fromIndex === -1 || toIndex === -1) return
                      const next = [...current]
                      const [moved] = next.splice(fromIndex, 1)
                      next.splice(toIndex, 0, moved)
                      reorderProducts(next.map((p) => p.id))
                      setDragProductId(null)
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img src={productImageSrc(product.image)} alt={product.name} className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center">
                            <ImageIcon className="w-3.5 h-3.5 text-[#d1d1d6]" />
                          </div>
                        )}
                        <div>
                          <span className="text-[13px] font-medium text-[#1d1d1f]">{product.name}</span>
                          {product.description && <p className="text-[11px] text-[#86868b] mt-0.5 line-clamp-1">{product.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-[#e63462]">{"₺"}{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => updateProduct(product.id, { inStock: !product.inStock })} className="inline-flex items-center">
                        {product.inStock ? <ToggleRight className="w-6 h-6 text-[#34c759]" /> : <ToggleLeft className="w-6 h-6 text-[#d1d1d6]" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(product)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f5f5f7] transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-[#86868b]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProduct(product)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {catProducts.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-[13px] text-[#86868b]">
                    <Package className="w-8 h-8 text-[#d1d1d6] mx-auto mb-2" />
                    Bu kategoride urun yok
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8ed]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Urun Duzenle</h3>
              <button onClick={() => setEditingProduct(null)} className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                <X className="w-4 h-4 text-[#86868b]" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">Urun Adi</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="w-full h-[40px] px-3 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">Fiyat (TL)</label>
                <input 
                  type="number" 
                  value={editPrice} 
                  onChange={(e) => setEditPrice(e.target.value)} 
                  className="w-full h-[40px] px-3 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">Aciklama (opsiyonel)</label>
                <textarea 
                  value={editDesc} 
                  onChange={(e) => setEditDesc(e.target.value)} 
                  rows={3}
                  className="w-full px-3 py-2 text-[14px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none resize-none" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">Fotograf</label>
                <ImageUpload value={editImage} onChange={setEditImage} onUpload={token ? handleUpload : undefined} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#e8e8ed] flex justify-end gap-2">
              <button onClick={() => setEditingProduct(null)} className="h-[38px] px-5 text-[13px] font-medium text-[#86868b] rounded-xl border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]">
                Iptal
              </button>
              <button onClick={handleUpdateProduct} className="h-[38px] px-5 text-[13px] font-medium text-white bg-[#e63462] rounded-xl hover:bg-[#d42d56]">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product delete confirmation */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px]">
            <div className="flex items-start gap-3 px-5 pt-5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Urunu sil</h3>
                <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                  <span className="font-medium text-[#1d1d1f]">{confirmDeleteProduct.name}</span> urununu silmek istediginize emin misiniz? Bu islem geri alinamaz.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t border-[#e8e8ed] mt-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(null)}
                className="h-[38px] px-4 text-[13px] font-medium text-[#86868b] rounded-xl border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
              >
                Iptal
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProduct(confirmDeleteProduct.id)
                  setConfirmDeleteProduct(null)
                }}
                className="h-[38px] px-4 text-[13px] font-medium text-white bg-red-500 rounded-xl hover:bg-red-600"
              >
                Evet, sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category delete: two-step confirmation */}
      {categoryDeleteStep && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px]">
            <div className="flex items-start gap-3 px-5 pt-5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {categoryDeleteStep.step === 1 ? "Kategoriyi sil" : "Son onay"}
                </h3>
                {categoryDeleteStep.step === 1 ? (
                  <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                    <span className="font-medium text-[#1d1d1f]">{categoryDeleteStep.name}</span> kategorisini silmek istediginize emin misiniz?
                  </p>
                ) : (
                  <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                    Alt kategoriler ve bu kategorideki urunler de silinebilir. Son kez onayliyor musunuz?
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t border-[#e8e8ed] mt-4">
              <button
                type="button"
                onClick={() => setCategoryDeleteStep(null)}
                className="h-[38px] px-4 text-[13px] font-medium text-[#86868b] rounded-xl border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
              >
                Iptal
              </button>
              {categoryDeleteStep.step === 1 ? (
                <button
                  type="button"
                  onClick={() => setCategoryDeleteStep({ ...categoryDeleteStep, step: 2 })}
                  className="h-[38px] px-4 text-[13px] font-medium text-white bg-[#e63462] rounded-xl hover:bg-[#d42d56]"
                >
                  Evet, devam et
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    deleteCategory(categoryDeleteStep.id)
                    setCategoryDeleteStep(null)
                  }}
                  className="h-[38px] px-4 text-[13px] font-medium text-white bg-red-500 rounded-xl hover:bg-red-600"
                >
                  Kategoriyi sil
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Settings Modal */}
      {editingCatSettings && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[360px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8ed]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Kategori Ayarlari</h3>
              <button onClick={() => setEditingCatSettings(null)} className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                <X className="w-4 h-4 text-[#86868b]" />
              </button>
            </div>
            <div className="p-5">
              <div className="text-[14px] font-medium text-[#1d1d1f] mb-4">{editingCatSettings.name}</div>
              
              <div className="space-y-3">
                {/* Terminal visibility */}
                <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-[#1d1d1f]">Terminalde Goster</div>
                      <div className="text-[11px] text-[#86868b]">Garson siparis ekraninda gorunur</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      updateCategory(editingCatSettings.id, { showInTerminal: !editingCatSettings.showInTerminal })
                      setEditingCatSettings({ ...editingCatSettings, showInTerminal: !editingCatSettings.showInTerminal })
                    }}
                  >
                    {editingCatSettings.showInTerminal ? (
                      <ToggleRight className="w-8 h-8 text-blue-500" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
                    )}
                  </button>
                </div>

                {/* Menu visibility */}
                <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <Menu className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-[#1d1d1f]">Menude Goster</div>
                      <div className="text-[11px] text-[#86868b]">QR menu ve web menude gorunur</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      updateCategory(editingCatSettings.id, { showInMenu: !editingCatSettings.showInMenu })
                      setEditingCatSettings({ ...editingCatSettings, showInMenu: !editingCatSettings.showInMenu })
                    }}
                  >
                    {editingCatSettings.showInMenu ? (
                      <ToggleRight className="w-8 h-8 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
                    )}
                  </button>
                </div>

                {/* Quick Sale visibility */}
                <div className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-[#1d1d1f]">Hizli Satista Goster</div>
                      <div className="text-[11px] text-[#86868b]">Hizli satis ekraninda gorunur</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      updateCategory(editingCatSettings.id, { showInQuickSale: !editingCatSettings.showInQuickSale })
                      setEditingCatSettings({ ...editingCatSettings, showInQuickSale: !editingCatSettings.showInQuickSale })
                    }}
                  >
                    {editingCatSettings.showInQuickSale ? (
                      <ToggleRight className="w-8 h-8 text-orange-500" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-[#d1d1d6]" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[11px] font-medium text-[#86868b] mb-1.5">Ust kategori</label>
                <select
                  className="w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#e63462]/50 focus:outline-none"
                  value={editingCatSettings.parentId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    const parentId = v ? v : null
                    updateCategory(editingCatSettings.id, { parentId })
                    setEditingCatSettings({
                      ...editingCatSettings,
                      parentId: parentId ?? undefined,
                    })
                  }}
                >
                  <option value="">Ana kategori</option>
                  {orderedCategoryList(categories)
                    .filter(
                      (c) =>
                        c.id !== editingCatSettings.id &&
                        !descendantIdSet(categories, editingCatSettings.id).has(c.id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {"\u00A0".repeat(categoryDepth(categories, c.id) * 2)}
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#e8e8ed]">
              <button 
                type="button"
                onClick={() => setEditingCatSettings(null)} 
                className="w-full h-[38px] text-[13px] font-medium text-white bg-[#e63462] rounded-xl hover:bg-[#d42d56]"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
