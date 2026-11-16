import { useState, useCallback, useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { usePanelToast } from "./panel-toast"
import { api, getBase } from "@/lib/api"
import { Plus, Pencil, Trash2, Search, Package, ToggleLeft, ToggleRight, ImageIcon, Monitor, Menu, Settings2, CornerDownRight } from "lucide-react"
import type { PanelCategory, PanelProduct } from "@/lib/panel-types"
import { orderedCategoryList } from "@/lib/panel-api-sync"
import { AddProductInlineForm, DeleteProductConfirmModal, EditProductModal } from "./products/product-form-modal"
import { AddCategoryInlineForm, categoryDepth, CategorySettingsModal, DeleteCategoryConfirmModal } from "./products/category-modals"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function productImageSrc(url: string | undefined): string {
  if (!url) return ""
  if (url.startsWith("http")) return url
  const base = getBase()
  return base ? `${base}${url.startsWith("/") ? "" : "/"}${url}` : url
}

export default function ProductManagement() {
  const { token } = usePanelAuth()
  const { showToast } = usePanelToast()
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
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<PanelProduct | null>(null)
  const [categoryDeleteStep, setCategoryDeleteStep] = useState<null | { id: string; name: string; step: 1 | 2 }>(null)

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
    const priceVal = parseFloat(productPrice)
    if (!productName.trim() || !Number.isFinite(priceVal) || priceVal < 0) {
      showToast("Geçerli bir ürün adı ve fiyat girin.", "error")
      return
    }
    addProduct({ name: productName.trim(), price: priceVal, categoryId: selectedCat, inStock: true, description: productDesc.trim() || undefined, image: productImage || undefined })
    setProductName(""); setProductPrice(""); setProductDesc(""); setProductImage(""); setShowAddProduct(false)
  }

  const handleAddCategory = () => {
    if (!catName.trim()) return
    addCategory(catName.trim(), { parentId: newCategoryParentId.trim() || null })
    setCatName(""); setNewCategoryParentId(""); setShowAddCategory(false)
  }

  const openEditModal = (product: PanelProduct) => {
    setEditingProduct(product)
    setEditName(product.name)
    setEditPrice(product.price.toString())
    setEditDesc(product.description || "")
    setEditImage(product.image || "")
  }

  const handleUpdateProduct = () => {
    const priceVal = parseFloat(editPrice)
    if (!editingProduct || !editName.trim() || !Number.isFinite(priceVal) || priceVal < 0) {
      showToast("Geçerli bir ürün adı ve fiyat girin.", "error")
      return
    }
    updateProduct(editingProduct.id, { name: editName.trim(), price: priceVal, description: editDesc.trim() || undefined, image: editImage || undefined })
    setEditingProduct(null)
  }

  return (
    <div className="h-full flex">
      <div className="w-[220px] h-full border-r border-[#d1d1d6]/60 bg-white flex flex-col flex-shrink-0">
        <div className="h-[52px] border-b border-[#d1d1d6]/60 flex items-center justify-between px-4">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Kategoriler</h3>
          <button type="button" onClick={() => { setShowAddCategory(true); setCatName(""); setNewCategoryParentId("") }} className="w-6 h-6 rounded-md bg-[#e63462]/10 flex items-center justify-center hover:bg-[#e63462]/20 transition-colors">
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (!dragCategoryId || dragCategoryId === cat.id) return
                const fromCat = categories.find((c) => c.id === dragCategoryId)
                const toCat = categories.find((c) => c.id === cat.id)
                if (!fromCat || !toCat) return
                const p1 = fromCat.parentId ?? null
                const p2 = toCat.parentId ?? null
                if (p1 !== p2) { setDragCategoryId(null); return }
                const siblings = categories.filter((c) => (c.parentId ?? null) === p2).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
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
                <div
                  style={{ paddingLeft: `${12 + categoryDepth(categories, cat.id) * 12}px` }}
                  className={`w-full pr-4 text-[13px] flex items-center justify-between gap-1 transition-colors ${selectedCat === cat.id ? "bg-[#e63462]/10 text-[#e63462] font-medium" : "text-[#1d1d1f] hover:bg-black/[0.03]"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCat(cat.id)}
                    className="truncate flex-1 flex items-center gap-2 py-2 text-left"
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      {cat.showInTerminal && <Monitor className="w-2.5 h-2.5 text-blue-500" />}
                      {cat.showInMenu && <Menu className="w-2.5 h-2.5 text-green-500" />}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <span className="text-[10px] text-[#86868b]">{products.filter((p) => p.categoryId === cat.id).length}</span>
                    <button type="button" onClick={() => setEditingCatSettings(cat)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/5">
                      <Settings2 className="w-3 h-3 text-[#86868b]" />
                    </button>
                    <button type="button" title="Alt kategori" onClick={() => { setNewCategoryParentId(cat.id); setCatName(""); setShowAddCategory(true) }} className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/5">
                      <CornerDownRight className="w-3 h-3 text-[#86868b]" />
                    </button>
                    <button type="button" onClick={() => setEditingCat(cat.id)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/5">
                      <Pencil className="w-3 h-3 text-[#86868b]" />
                    </button>
                    <button type="button" onClick={() => setCategoryDeleteStep({ id: cat.id, name: cat.name, step: 1 })} className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-50">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {showAddCategory && (
          <AddCategoryInlineForm
            categories={categories} newCategoryParentId={newCategoryParentId} setNewCategoryParentId={setNewCategoryParentId}
            catName={catName} setCatName={setCatName} onCancel={() => { setShowAddCategory(false); setNewCategoryParentId("") }} onSubmit={handleAddCategory}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Ürünler</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
              <input type="text" placeholder="Ürün ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-[30px] w-[180px] pl-8 pr-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 focus:ring-1 focus:ring-[#e63462]/20" />
            </div>
            <button onClick={() => { setShowAddProduct(true); setProductName(""); setProductPrice(""); setProductDesc(""); setProductImage("") }} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Ürün Ekle
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {showAddProduct && (
            <AddProductInlineForm
              productName={productName} setProductName={setProductName} productPrice={productPrice} setProductPrice={setProductPrice}
              productDesc={productDesc} setProductDesc={setProductDesc} productImage={productImage} setProductImage={setProductImage}
              onUpload={token ? handleUpload : undefined} onClose={() => setShowAddProduct(false)} onSubmit={handleAddProduct}
            />
          )}

          <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Ürün</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Fiyat</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Stok</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[100px]">İşlem</th>
                </tr>
              </thead>
              <tbody onDragOver={(e) => { if (dragProductId) e.preventDefault() }}>
                {catProducts.map((product, idx) => (
                  <tr
                    key={product.id}
                    className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] transition-colors ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}
                    draggable
                    onDragStart={() => setDragProductId(product.id)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (!dragProductId || dragProductId === product.id) return
                      const fromIndex = catProducts.findIndex((p) => p.id === dragProductId)
                      const toIndex = catProducts.findIndex((p) => p.id === product.id)
                      if (fromIndex === -1 || toIndex === -1) return
                      const next = [...catProducts]
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
                          <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center"><ImageIcon className="w-3.5 h-3.5 text-[#d1d1d6]" /></div>
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
                        <button onClick={() => openEditModal(product)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f5f5f7] transition-colors"><Pencil className="w-3.5 h-3.5 text-[#86868b]" /></button>
                        <button type="button" onClick={() => setConfirmDeleteProduct(product)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {catProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-[#86868b]">
                      <Package className="w-8 h-8 text-[#d1d1d6] mx-auto mb-2" /> Bu kategoride ürün yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingProduct && <EditProductModal editName={editName} setEditName={setEditName} editPrice={editPrice} setEditPrice={setEditPrice} editDesc={editDesc} setEditDesc={setEditDesc} editImage={editImage} setEditImage={setEditImage} onUpload={token ? handleUpload : undefined} onClose={() => setEditingProduct(null)} onSave={handleUpdateProduct} />}
      {confirmDeleteProduct && <DeleteProductConfirmModal product={confirmDeleteProduct} onCancel={() => setConfirmDeleteProduct(null)} onConfirm={() => { deleteProduct(confirmDeleteProduct.id); setConfirmDeleteProduct(null) }} />}
      {categoryDeleteStep && <DeleteCategoryConfirmModal categoryDeleteStep={categoryDeleteStep} onCancel={() => setCategoryDeleteStep(null)} onNextStep={() => setCategoryDeleteStep({ ...categoryDeleteStep, step: 2 })} onConfirmDelete={() => { deleteCategory(categoryDeleteStep.id); setCategoryDeleteStep(null) }} />}
      {editingCatSettings && <CategorySettingsModal categories={categories} editingCatSettings={editingCatSettings} setEditingCatSettings={setEditingCatSettings} updateCategory={updateCategory} />}
    </div>
  )
}
