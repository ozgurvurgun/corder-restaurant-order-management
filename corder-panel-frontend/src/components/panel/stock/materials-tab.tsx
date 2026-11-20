import { useState, useMemo, useEffect } from "react"
import { AlertTriangle, Check, Link2, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import type { PanelCategory, PanelProduct, StockMaterial, Supplier } from "@/lib/panel-types"
import { AddMaterialForm } from "./stock-modals"
import { formatCurrency } from "@/lib/format"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { PaginationBar } from "@/components/ui/pagination-bar"

export function MaterialsTab(props: {
  stockMaterials: StockMaterial[]
  filteredMaterials: StockMaterial[]
  suppliers?: Supplier[]
  search: string
  setSearch: (v: string) => void
  showAddMaterial: boolean
  setShowAddMaterial: (v: boolean) => void
  matName: string
  setMatName: (v: string) => void
  matUnit: StockMaterial["unit"]
  setMatUnit: (v: StockMaterial["unit"]) => void
  matCost: string
  setMatCost: (v: string) => void
  matCategory: string
  setMatCategory: (v: string) => void
  matStock: string
  setMatStock: (v: string) => void
  matMin: string
  setMatMin: (v: string) => void
  matSupplier?: string
  setMatSupplier?: (v: string) => void
  canManageMaterials?: boolean
  handleAddMaterial: () => void
  updateMaterial?: (id: string, data: Partial<StockMaterial>) => void
  deleteMaterial: (id: string) => void
}) {
  const { stockMaterials, filteredMaterials, suppliers = [], search, setSearch, showAddMaterial, setShowAddMaterial, matName, setMatName, matUnit, setMatUnit, matCost, setMatCost, matCategory, setMatCategory, matStock, setMatStock, matMin, setMatMin, matSupplier, setMatSupplier, canManageMaterials = true, handleAddMaterial, updateMaterial, deleteMaterial } = props

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editMin, setEditMin] = useState("")
  const [editCost, setEditCost] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 12

  useEffect(() => {
    setPage(1)
  }, [search, filteredMaterials.length])

  const paginatedMaterials = useMemo(
    () => filteredMaterials.slice((page - 1) * pageSize, page * pageSize),
    [filteredMaterials, page],
  )

  const startEdit = (mat: StockMaterial) => {
    setEditingId(mat.id)
    setEditName(mat.name)
    setEditMin(String(mat.minStock))
    setEditCost(String(mat.costPerUnit))
  }

  const saveEdit = (id: string) => {
    if (!updateMaterial || !editName.trim()) return
    const minVal = Math.max(0, parseFloat(editMin) || 0)
    const costVal = Math.max(0, parseFloat(editCost) || 0)
    updateMaterial(id, {
      name: editName.trim(),
      minStock: minVal,
      costPerUnit: costVal,
    })
    setEditingId(null)
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
          <input
            type="text"
            placeholder="Malzeme ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[30px] w-full sm:w-[220px] pl-8 pr-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 focus:ring-1 focus:ring-[#e63462]/20"
          />
        </div>
        {canManageMaterials && (
          <button onClick={() => setShowAddMaterial(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" /> Malzeme Ekle
          </button>
        )}
      </div>

      {showAddMaterial && canManageMaterials && (
        <AddMaterialForm
          matName={matName}
          setMatName={setMatName}
          matUnit={matUnit}
          setMatUnit={setMatUnit}
          matCost={matCost}
          setMatCost={setMatCost}
          matCategory={matCategory}
          setMatCategory={setMatCategory}
          matStock={matStock}
          setMatStock={setMatStock}
          matMin={matMin}
          setMatMin={setMatMin}
          matSupplier={matSupplier}
          setMatSupplier={setMatSupplier}
          suppliers={suppliers}
          onClose={() => setShowAddMaterial(false)}
          onSubmit={handleAddMaterial}
        />
      )}

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Malzeme</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kategori</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Stok</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Min.</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Birim Maliyet</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Toplam Değer</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Durum</th>
              {canManageMaterials && (
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[90px]">İşlem</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedMaterials.map((mat, idx) => {
              const isLow = mat.currentStock <= mat.minStock
              const isEditing = editingId === mat.id
              return (
                <tr key={mat.id} className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">
                    {isEditing ? (
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="h-[26px] w-[140px] px-2 text-[12px] bg-[#f5f5f7] rounded border border-[#d1d1d6]" />
                    ) : (
                      mat.name
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                    {mat.category}
                  </td>
                  <td className={`px-4 py-2.5 text-[13px] text-right font-semibold ${isLow ? "text-red-500" : "text-[#1d1d1f]"}`}>
                    {mat.currentStock} {mat.unit}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-right text-[#86868b]">
                    {isEditing ? (
                      <input type="number" min={0} step="0.01" value={editMin} onChange={(e) => setEditMin(e.target.value)} className="h-[26px] w-[70px] px-2 text-[12px] text-right bg-[#f5f5f7] rounded border border-[#d1d1d6]" />
                    ) : (
                      `${mat.minStock} ${mat.unit}`
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-right text-[#1d1d1f]">
                    {isEditing ? (
                      <input type="number" min={0} step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="h-[26px] w-[80px] px-2 text-[12px] text-right bg-[#f5f5f7] rounded border border-[#d1d1d6]" />
                    ) : (
                      `\u20BA${formatCurrency(mat.costPerUnit)}`
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-right font-semibold text-[#e63462]">
                    {"\u20BA"}
                    {formatCurrency(mat.currentStock * mat.costPerUnit)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isLow ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                      {isLow ? "Kritik" : "Yeterli"}
                    </span>
                  </td>
                  {canManageMaterials && (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => saveEdit(mat.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-green-50">
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f5f5f7]">
                              <X className="w-3.5 h-3.5 text-[#86868b]" />
                            </button>
                          </>
                        ) : (
                          <>
                            {updateMaterial && (
                              <button type="button" onClick={() => startEdit(mat)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f5f5f7]">
                                <Pencil className="w-3.5 h-3.5 text-[#86868b]" />
                              </button>
                            )}
                            <button type="button" onClick={() => deleteMaterial(mat.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 pb-3">
          <PaginationBar
            currentPage={page}
            totalItems={filteredMaterials.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="malzeme"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1d1d1f]">Toplam Stok Değeri</span>
        <span className="text-[18px] font-bold text-[#e63462]">
          {"\u20BA"}
          {formatCurrency(
            stockMaterials.reduce(
              (s, m) => s + m.currentStock * m.costPerUnit,
              0,
            ),
          )}
        </span>
      </div>
    </>
  )
}

export function ProductLinkTab(props: {
  products: PanelProduct[]
  categories: PanelCategory[]
  stockMaterials: StockMaterial[]
  canManageProducts?: boolean
  setProductIngredients: (
    productId: string,
    ingredients: { materialId: string; quantity: number }[],
  ) => void
}) {
  const { products, categories, stockMaterials, canManageProducts = true, setProductIngredients } = props
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingIngredients, setEditingIngredients] = useState<
    { materialId: string; quantity: number }[]
  >([])
  const [linkCategoryFilter, setLinkCategoryFilter] = useState<string>("all")
  const [linkPage, setLinkPage] = useState(1)
  const linkPageSize = 12
  const filteredLinkProducts = useMemo(
    () =>
      products.filter(
        (p) => linkCategoryFilter === "all" || p.categoryId === linkCategoryFilter,
      ),
    [products, linkCategoryFilter],
  )
  const paginatedLinkProducts = useMemo(
    () => filteredLinkProducts.slice((linkPage - 1) * linkPageSize, linkPage * linkPageSize),
    [filteredLinkProducts, linkPage],
  )

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name || categoryId

  const handleEditIngredients = (product: PanelProduct) => {
    setEditingProductId(product.id)
    setEditingIngredients(
      product.ingredients?.map((i) => ({
        materialId: i.materialId,
        quantity: i.quantity,
      })) || [],
    )
  }

  const handleSaveIngredients = () => {
    if (!editingProductId) return
    setProductIngredients(
      editingProductId,
      editingIngredients.filter((i) => i.materialId && i.quantity > 0),
    )
    setEditingProductId(null)
    setEditingIngredients([])
  }

  return (
    <>
      <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-amber-800">
          <p className="font-semibold mb-1">Ürün-Malzeme Eşleştirme</p>
          <p>
            Her ürün için gerekli malzemeleri ve miktarlarını tanımlayarak,
            sipariş tamamlandığında envanter otomatik olarak düşecektir.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setLinkCategoryFilter("all")}
          className={`h-[30px] px-3 rounded-lg text-[12px] font-medium transition-colors ${linkCategoryFilter === "all" ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"}`}
        >
          Tümü ({products.length})
        </button>
        {categories.map((cat) => {
          const count = products.filter((p) => p.categoryId === cat.id).length
          return (
            <button
              key={cat.id}
              onClick={() => setLinkCategoryFilter(cat.id)}
              className={`h-[30px] px-3 rounded-lg text-[12px] font-medium transition-colors ${linkCategoryFilter === cat.id ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"}`}
            >
              {cat.name} ({count})
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Ürün</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kategorisi</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Eşleşen Malzemeler</th>
              {canManageProducts && (
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[100px]">İşlem</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedLinkProducts.map((product, idx) => {
                const isEditing = editingProductId === product.id
                return (
                  <tr key={product.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">
                      {product.name}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#86868b]">
                      {getCategoryName(product.categoryId)}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          {editingIngredients.map((ing, ingIdx) => (
                            <div key={ingIdx} className="flex items-center gap-2">
                              <CustomSelect
                                value={ing.materialId}
                                onChange={(e) => {
                                  const newIng = [...editingIngredients]
                                  newIng[ingIdx].materialId = e.target.value
                                  setEditingIngredients(newIng)
                                }}
                                className="h-[28px] px-2 text-[12px] bg-[#f5f5f7] rounded border border-[#d1d1d6]/60 flex-1"
                              >
                                <option value="">Malzeme seç</option>
                                {stockMaterials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.unit})
                                  </option>
                                ))}
                              </CustomSelect>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={ing.quantity}
                                onChange={(e) => {
                                  const newIng = [...editingIngredients]
                                  newIng[ingIdx].quantity = Math.max(
                                    0,
                                    parseFloat(e.target.value) || 0,
                                  )
                                  setEditingIngredients(newIng)
                                }}
                                placeholder="Miktar"
                                className="h-[28px] w-[80px] px-2 text-[12px] bg-[#f5f5f7] rounded border border-[#d1d1d6]/60"
                              />
                              <button onClick={() => setEditingIngredients((prev) => prev.filter((_, i) => i !== ingIdx), ) } className="w-6 h-6 rounded bg-red-50 flex items-center justify-center hover:bg-red-100">
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setEditingIngredients((prev) => [
                                  ...prev,
                                  { materialId: "", quantity: 0 },
                                ])
                              }
                              className="h-[26px] px-2 text-[11px] font-medium text-[#e63462] bg-[#e63462]/10 rounded hover:bg-[#e63462]/20 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Malzeme Ekle
                            </button>
                            <button onClick={handleSaveIngredients} className="h-[26px] px-3 text-[11px] font-medium text-white bg-[#34c759] rounded hover:bg-[#2db84e] flex items-center gap-1">
                              <Check className="w-3 h-3" /> Kaydet
                            </button>
                            <button onClick={() => setEditingProductId(null)} className="h-[26px] px-2 text-[11px] font-medium text-[#86868b] border border-[#d1d1d6]/60 rounded hover:bg-[#f5f5f7]">
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {product.ingredients &&
                          product.ingredients.length > 0 ? (
                            product.ingredients.map((ing, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                                {ing.materialName}: {ing.quantity} {ing.unit}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#aeaeb2] italic">Eşleme yapılmamış</span>
                          )}
                        </div>
                      )}
                    </td>
                    {canManageProducts && (
                      <td className="px-4 py-2.5 text-right">
                        {!isEditing && (
                          <button onClick={() => handleEditIngredients(product)} className="h-[28px] px-3 text-[11px] font-medium text-[#e63462] bg-[#e63462]/10 rounded-lg hover:bg-[#e63462]/20 flex items-center gap-1 ml-auto">
                            <Link2 className="w-3 h-3" /> Eşle
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
        <div className="px-4 pb-3">
          <PaginationBar
            currentPage={linkPage}
            totalItems={filteredLinkProducts.length}
            pageSize={linkPageSize}
            onPageChange={setLinkPage}
            itemLabel="ürün"
          />
        </div>
      </div>
    </>
  )
}
