import { useState, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import {
  Search, Plus, Trash2, X, Package, AlertTriangle, ArrowDown, ArrowUp, RotateCcw,
  Truck, ClipboardList, TrendingUp, Link2, Check,
} from "lucide-react"
import type { PanelProduct } from "@/lib/panel-types"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatDate(d: Date) { return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }

export default function StockView() {
  const {
    stockMaterials, suppliers, stockMovements, inventoryCounts,
    addMaterial, deleteMaterial, addStockMovement, setProductIngredients,
    addSupplier, updateSupplier, deleteSupplier,
    startInventoryCount, updateInventoryItem, completeInventoryCount,
    currentUser, products, categories,
    addNotification,
  } = usePanelStore()
  
  // Helper to get category name by ID
  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat?.name || categoryId
  }

  const [activeTab, setActiveTab] = useState<"materials" | "movements" | "suppliers" | "inventory" | "cost" | "link">("materials")
  const [search, setSearch] = useState("")
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [showAddMovement, setShowAddMovement] = useState(false)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingIngredients, setEditingIngredients] = useState<{ materialId: string; quantity: number }[]>([])
  const [linkCategoryFilter, setLinkCategoryFilter] = useState<string>("all")

  // Forms
  const [matName, setMatName] = useState("")
  const [matUnit, setMatUnit] = useState<"kg" | "lt" | "adet" | "gr" | "ml" | "paket" | "koli">("kg")
  const [matStock, setMatStock] = useState("")
  const [matMin, setMatMin] = useState("")
  const [matCost, setMatCost] = useState("")
  const [matCategory, setMatCategory] = useState("")
  const [matSupplier] = useState("")

  const [mvMatId, setMvMatId] = useState("")
  const [mvType, setMvType] = useState<"in" | "out" | "waste">("in")
  const [mvQty, setMvQty] = useState("")
  const [mvCost, setMvCost] = useState("")
  const [mvReason, setMvReason] = useState("")

  const [supName, setSupName] = useState("")
  const [supContact, setSupContact] = useState("")
  const [supPhone, setSupPhone] = useState("")
  const [savingSupplier, setSavingSupplier] = useState(false)

  const lowStockItems = useMemo(() => stockMaterials.filter((m) => m.currentStock <= m.minStock), [stockMaterials])

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return stockMaterials
    return stockMaterials.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase()))
  }, [stockMaterials, search])

  /** Uses manual costPrice if set; otherwise Product Match recipe × material unit cost. */
  const costAnalysis = useMemo(() => {
    const recipeBomCost = (p: PanelProduct): number | null => {
      const ings = p.ingredients
      if (!ings?.length) return null
      let total = 0
      for (const ing of ings) {
        const mat = stockMaterials.find((m) => m.id === ing.materialId)
        if (!mat) return null
        total += ing.quantity * mat.costPerUnit
      }
      return total
    }

    const rows: {
      id: string
      name: string
      sellPrice: number
      costPrice: number
      margin: number
      marginPercent: number
      source: "manual" | "recipe"
    }[] = []

    for (const p of products) {
      const sellPrice = Number(p.price)
      if (!(sellPrice > 0)) continue

      const manual = p.costPrice != null && p.costPrice > 0 ? p.costPrice : null
      const recipe = manual == null ? recipeBomCost(p) : null
      const cost = manual ?? recipe
      if (cost == null || cost < 0) continue

      const margin = sellPrice - cost
      const marginPercent = Math.round((margin / sellPrice) * 100)
      rows.push({
        id: p.id,
        name: p.name,
        sellPrice,
        costPrice: cost,
        margin,
        marginPercent,
        source: manual != null ? "manual" : "recipe",
      })
    }
    return rows.sort((a, b) => a.marginPercent - b.marginPercent)
  }, [products, stockMaterials])

  const handleAddMaterial = () => {
    if (!matName || !matCost) return
    addMaterial({
      name: matName, unit: matUnit, currentStock: parseFloat(matStock) || 0,
      minStock: parseFloat(matMin) || 0, costPerUnit: parseFloat(matCost),
      category: matCategory || "Diger", supplierId: matSupplier || undefined,
    })
    setMatName(""); setMatStock(""); setMatMin(""); setMatCost(""); setMatCategory(""); setShowAddMaterial(false)
  }

  const handleAddMovement = () => {
    if (!mvMatId || !mvQty) return
    const material = stockMaterials.find((m) => m.id === mvMatId)
    addStockMovement({
      materialId: mvMatId, materialName: material?.name || "", type: mvType,
      quantity: parseFloat(mvQty), unitCost: parseFloat(mvCost) || undefined,
      totalCost: (parseFloat(mvCost) || 0) * parseFloat(mvQty),
      reason: mvReason || undefined, createdBy: currentUser?.name || "Sistem",
    })
    setMvMatId(""); setMvQty(""); setMvCost(""); setMvReason(""); setShowAddMovement(false)
  }

  const handleAddSupplier = async () => {
    const name = supName.trim()
    if (!name || savingSupplier) return
    setSavingSupplier(true)
    try {
      const ok = await addSupplier({
        name,
        contactPerson: supContact.trim() || undefined,
        phone: supPhone.trim() || undefined,
        active: true,
      })
      if (ok) {
        setSupName("")
        setSupContact("")
        setSupPhone("")
        setShowAddSupplier(false)
      } else {
        addNotification({
          type: "system",
          title: "Tedarikci eklenemedi",
          message: "Sunucu yaniti alinamadi veya yetki hatasi. API adresini ve giris bilgilerinizi kontrol edin.",
        })
      }
    } finally {
      setSavingSupplier(false)
    }
  }

  const TABS = [
    { id: "materials" as const, label: "Malzemeler", icon: Package },
    { id: "link" as const, label: "Urun Eslestir", icon: Link2 },
    { id: "movements" as const, label: "Hareketler", icon: RotateCcw },
    { id: "suppliers" as const, label: "Tedarikciler", icon: Truck },
    { id: "inventory" as const, label: "Sayim", icon: ClipboardList },
    { id: "cost" as const, label: "Maliyet", icon: TrendingUp },
  ]

  const handleEditIngredients = (product: PanelProduct) => {
    setEditingProductId(product.id)
    setEditingIngredients(product.ingredients?.map(i => ({ materialId: i.materialId, quantity: i.quantity })) || [])
  }

  const handleAddIngredient = () => {
    setEditingIngredients(prev => [...prev, { materialId: "", quantity: 0 }])
  }

  const handleRemoveIngredient = (index: number) => {
    setEditingIngredients(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveIngredients = () => {
    if (!editingProductId) return
    setProductIngredients(editingProductId, editingIngredients.filter(i => i.materialId && i.quantity > 0))
    setEditingProductId(null)
    setEditingIngredients([])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Stok Yonetimi</h2>
        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
            <AlertTriangle className="w-3 h-3" /> {lowStockItems.length} urun kritik stokta
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex gap-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 ${activeTab === tab.id ? "bg-[#e63462] text-white" : "text-[#86868b] hover:bg-black/[0.04]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-6xl flex flex-col gap-4">

          {/* ===== MATERIALS ===== */}
          {activeTab === "materials" && (
            <>
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
                  <input type="text" placeholder="Malzeme ara..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="h-[30px] w-[220px] pl-8 pr-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 focus:ring-1 focus:ring-[#e63462]/20" />
                </div>
                <button onClick={() => setShowAddMaterial(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
                  <Plus className="w-3.5 h-3.5" /> Malzeme Ekle
                </button>
              </div>

              {showAddMaterial && (
                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[13px] font-semibold text-[#1d1d1f]">Yeni Malzeme</h4>
                    <button onClick={() => setShowAddMaterial(false)} className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"><X className="w-3 h-3 text-[#86868b]" /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <input type="text" value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="Malzeme adi" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <select value={matUnit} onChange={(e) => setMatUnit(e.target.value as typeof matUnit)} className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none">
                      {["kg", "lt", "adet", "gr", "ml", "paket", "koli"].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" value={matCost} onChange={(e) => setMatCost(e.target.value)} placeholder="Birim maliyet" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <input type="text" value={matCategory} onChange={(e) => setMatCategory(e.target.value)} placeholder="Kategori" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <input type="number" value={matStock} onChange={(e) => setMatStock(e.target.value)} placeholder="Mevcut stok" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <input type="number" value={matMin} onChange={(e) => setMatMin(e.target.value)} placeholder="Min. stok" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => setShowAddMaterial(false)} className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]">Iptal</button>
                    <button onClick={handleAddMaterial} className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]">Kaydet</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Malzeme</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kategori</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Stok</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Min.</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Birim Maliyet</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Toplam Deger</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Durum</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[80px]">Islem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map((mat, idx) => {
                      const isLow = mat.currentStock <= mat.minStock
                      return (
                        <tr key={mat.id} className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{mat.name}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">{mat.category}</td>
                          <td className={`px-4 py-2.5 text-[13px] text-right font-semibold ${isLow ? "text-red-500" : "text-[#1d1d1f]"}`}>
                            {mat.currentStock} {mat.unit}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-right text-[#86868b]">{mat.minStock} {mat.unit}</td>
                          <td className="px-4 py-2.5 text-[12px] text-right text-[#1d1d1f]">{"\u20BA"}{formatCurrency(mat.costPerUnit)}</td>
                          <td className="px-4 py-2.5 text-[12px] text-right font-semibold text-[#e63462]">{"\u20BA"}{formatCurrency(mat.currentStock * mat.costPerUnit)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isLow ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                              {isLow ? "Kritik" : "Yeterli"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => deleteMaterial(mat.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total stock value */}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Toplam Stok Degeri</span>
                <span className="text-[18px] font-bold text-[#e63462]">{"\u20BA"}{formatCurrency(stockMaterials.reduce((s, m) => s + m.currentStock * m.costPerUnit, 0))}</span>
              </div>
            </>
          )}

          {/* ===== MOVEMENTS ===== */}
          {activeTab === "movements" && (
            <>
              <div className="flex justify-end">
                <button onClick={() => setShowAddMovement(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
                  <Plus className="w-3.5 h-3.5" /> Hareket Ekle
                </button>
              </div>

              {showAddMovement && (
                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[13px] font-semibold text-[#1d1d1f]">Stok Hareketi</h4>
                    <button onClick={() => setShowAddMovement(false)} className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"><X className="w-3 h-3 text-[#86868b]" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <select value={mvMatId} onChange={(e) => setMvMatId(e.target.value)} className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60">
                      <option value="">Malzeme secin</option>
                      {stockMaterials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.currentStock} {m.unit})</option>)}
                    </select>
                    <div className="flex gap-2">
                      {(["in", "out", "waste"] as const).map((t) => (
                        <button key={t} onClick={() => setMvType(t)} className={`flex-1 h-[36px] rounded-lg border text-[12px] font-medium ${mvType === t ? "border-[#e63462] bg-[#e63462]/5 text-[#e63462]" : "border-[#d1d1d6]/60 text-[#86868b]"}`}>
                          {t === "in" ? "Giris" : t === "out" ? "Cikis" : "Fire"}
                        </button>
                      ))}
                    </div>
                    <input type="number" value={mvQty} onChange={(e) => setMvQty(e.target.value)} placeholder="Miktar" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <input type="number" value={mvCost} onChange={(e) => setMvCost(e.target.value)} placeholder="Birim maliyet (opsiyonel)" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <input type="text" value={mvReason} onChange={(e) => setMvReason(e.target.value)} placeholder="Sebep (opsiyonel)" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => setShowAddMovement(false)} className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60">Iptal</button>
                    <button onClick={handleAddMovement} className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]">Kaydet</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tarih</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Malzeme</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Tur</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Miktar</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Stok</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Sebep</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Isleyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements.map((mv, idx) => (
                      <tr key={mv.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                        <td className="px-4 py-2 text-[12px] text-[#86868b]">{formatDate(mv.createdAt)}</td>
                        <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{mv.materialName}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                            mv.type === "in" ? "bg-green-50 text-green-600" : mv.type === "out" ? "bg-blue-50 text-blue-600" : mv.type === "waste" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
                          }`}>
                            {mv.type === "in" ? <><ArrowDown className="w-2.5 h-2.5" /> Giris</> : mv.type === "out" ? <><ArrowUp className="w-2.5 h-2.5" /> Cikis</> : mv.type === "waste" ? "Fire" : "Sayim"}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-[12px] text-right font-semibold ${
                          mv.type === "in" || (mv.type === "count-adjustment" && mv.quantity > 0)
                            ? "text-green-600"
                            : "text-red-500"
                        }`}>
                          {mv.type === "count-adjustment"
                            ? `${mv.quantity > 0 ? "+" : ""}${mv.quantity}`
                            : `${mv.type === "in" ? "+" : "-"}${mv.quantity}`}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-right text-[#86868b]">{mv.previousStock} {"->"} {mv.newStock}</td>
                        <td className="px-4 py-2 text-[12px] text-[#86868b]">{mv.reason || "-"}</td>
                        <td className="px-4 py-2 text-[12px] text-[#86868b]">{mv.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ===== SUPPLIERS ===== */}
          {activeTab === "suppliers" && (
            <>
              <div className="flex justify-end">
                <button onClick={() => setShowAddSupplier(true)} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
                  <Plus className="w-3.5 h-3.5" /> Tedarikci Ekle
                </button>
              </div>
              {showAddSupplier && (
                <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="Firma adi" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <input type="text" value={supContact} onChange={(e) => setSupContact(e.target.value)} placeholder="Yetkili kisi" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                    <input type="tel" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} placeholder="Telefon" className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      disabled={savingSupplier}
                      onClick={() => setShowAddSupplier(false)}
                      className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 disabled:opacity-50"
                    >
                      Iptal
                    </button>
                    <button
                      type="button"
                      disabled={savingSupplier || !supName.trim()}
                      onClick={() => void handleAddSupplier()}
                      className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56] disabled:opacity-50"
                    >
                      {savingSupplier ? "Kaydediliyor..." : "Ekle"}
                    </button>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Firma</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Yetkili</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Telefon</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Durum</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[80px]">Islem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#86868b]">
                          Henuz tedarikci yok. Yukaridan &quot;Tedarikci Ekle&quot; ile kayit acin.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((sup, idx) => (
                        <tr key={sup.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{sup.name}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">{sup.contactPerson || "-"}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">{sup.phone || "-"}</td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => updateSupplier(sup.id, { active: !sup.active })}
                              className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${sup.active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}
                            >
                              {sup.active ? "Aktif" : "Pasif"}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => deleteSupplier(sup.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ===== INVENTORY ===== */}
          {activeTab === "inventory" && (
            <>
              <div className="flex justify-end">
                <button onClick={startInventoryCount} className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56]">
                  <ClipboardList className="w-3.5 h-3.5" /> Yeni Sayim Baslat
                </button>
              </div>
              {inventoryCounts.map((ic) => (
                <div key={ic.id} className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0] bg-[#f9f9f9]">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[#1d1d1f]">Sayim - {formatDate(ic.date)}</h4>
                      <p className="text-[11px] text-[#86868b]">Sayan: {ic.countedBy}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${ic.status === "completed" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                        {ic.status === "completed" ? "Tamamlandi" : "Devam Ediyor"}
                      </span>
                      {ic.status === "in-progress" && (
                        <button onClick={() => completeInventoryCount(ic.id)} className="h-[26px] px-3 bg-[#34c759] text-white rounded-lg text-[11px] font-medium hover:bg-[#2db84e]">Tamamla</button>
                      )}
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#f0f0f0]">
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Malzeme</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Beklenen</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Sayilan</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Fark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ic.items.map((item) => (
                        <tr key={item.materialId} className="border-b border-[#f0f0f0]">
                          <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">{item.materialName}</td>
                          <td className="px-4 py-2 text-[12px] text-right text-[#86868b]">{item.expectedStock}</td>
                          <td className="px-4 py-2 text-right">
                            {ic.status === "in-progress" ? (
                              <input type="number" defaultValue={item.actualStock}
                                onBlur={(e) => updateInventoryItem(ic.id, item.materialId, parseFloat(e.target.value) || 0)}
                                className="w-[80px] h-[26px] px-2 text-[12px] text-right bg-[#f5f5f7] rounded border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                            ) : (
                              <span className="text-[12px] text-[#1d1d1f]">{item.actualStock}</span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-[12px] text-right font-semibold ${item.difference === 0 ? "text-[#86868b]" : item.difference > 0 ? "text-green-600" : "text-red-500"}`}>
                            {item.difference > 0 ? "+" : ""}{item.difference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}

          {/* ===== COST ANALYSIS ===== */}
          {activeTab === "cost" && (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] text-[#86868b] px-1">
                Maliyet: once manuel <span className="font-medium text-[#1d1d1f]">costPrice</span> (varsa), yoksa{" "}
                <span className="font-medium text-[#1d1d1f]">Urun Eslestir</span> reçetesi ile malzeme birim maliyetlerinin toplami.
              </p>
              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] px-4 pt-4 pb-2">Urun Maliyet Analizi</h3>
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Urun</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kaynak</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Satis Fiyati</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Maliyet</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kar</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kar Marji</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costAnalysis.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#86868b]">
                          Hesaplanabilir urun yok. Urunlere reçete tanimlayin (Urun Eslestir) ve malzemelerde birim maliyet girin; veya urun modelinde manuel maliyet alani kullanin.
                        </td>
                      </tr>
                    ) : (
                      costAnalysis.map((item, idx) => (
                        <tr key={item.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{item.name}</td>
                          <td className="px-4 py-2.5 text-[11px] text-[#86868b]">
                            {item.source === "manual" ? "Manuel" : "Reçete"}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-right text-[#1d1d1f]">{"\u20BA"}{formatCurrency(item.sellPrice)}</td>
                          <td className="px-4 py-2.5 text-[12px] text-right text-red-500">{"\u20BA"}{formatCurrency(item.costPrice)}</td>
                          <td className="px-4 py-2.5 text-[12px] text-right font-semibold text-green-600">{"\u20BA"}{formatCurrency(item.margin)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, item.marginPercent))}%`,
                                    backgroundColor: item.marginPercent > 60 ? "#34c759" : item.marginPercent > 40 ? "#ff9500" : "#ff3b30",
                                  }}
                                />
                              </div>
                              <span
                                className={`text-[12px] font-semibold ${item.marginPercent > 60 ? "text-green-600" : item.marginPercent > 40 ? "text-amber-600" : "text-red-500"}`}
                              >
                                %{item.marginPercent}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== PRODUCT LINK ===== */}
          {activeTab === "link" && (
            <>
              <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-amber-800">
                  <p className="font-semibold mb-1">Urun-Malzeme Eslestirme</p>
                  <p>Her urun icin gerekli malzemeleri ve miktarlarini tanimlayarak, siparis tamamlandiginda stok otomatik olarak dusecektir.</p>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setLinkCategoryFilter("all")}
                  className={`h-[30px] px-3 rounded-lg text-[12px] font-medium transition-colors ${
                    linkCategoryFilter === "all" 
                      ? "bg-[#e63462] text-white" 
                      : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                  }`}
                >
                  Tumu ({products.length})
                </button>
                {categories.map(cat => {
                  const count = products.filter(p => p.categoryId === cat.id).length
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setLinkCategoryFilter(cat.id)}
                      className={`h-[30px] px-3 rounded-lg text-[12px] font-medium transition-colors ${
                        linkCategoryFilter === cat.id 
                          ? "bg-[#e63462] text-white" 
                          : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  )
                })}
              </div>

              <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Urun</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kategorisi</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Eslesen Malzemeler</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[100px]">Islem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .filter(p => linkCategoryFilter === "all" || p.categoryId === linkCategoryFilter)
                      .map((product, idx) => {
                      const isEditing = editingProductId === product.id
                      return (
                      <tr key={product.id} className={`border-b border-[#f0f0f0] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                          <td className="px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{product.name}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#86868b]">{getCategoryName(product.categoryId)}</td>
                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                {editingIngredients.map((ing, ingIdx) => (
                                  <div key={ingIdx} className="flex items-center gap-2">
                                    <select 
                                      value={ing.materialId} 
                                      onChange={(e) => {
                                        const newIng = [...editingIngredients]
                                        newIng[ingIdx].materialId = e.target.value
                                        setEditingIngredients(newIng)
                                      }}
                                      className="h-[28px] px-2 text-[12px] bg-[#f5f5f7] rounded border border-[#d1d1d6]/60 flex-1"
                                    >
                                      <option value="">Malzeme sec</option>
                                      {stockMaterials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                                    </select>
                                    <input 
                                      type="number" 
                                      value={ing.quantity} 
                                      onChange={(e) => {
                                        const newIng = [...editingIngredients]
                                        newIng[ingIdx].quantity = parseFloat(e.target.value) || 0
                                        setEditingIngredients(newIng)
                                      }}
                                      placeholder="Miktar"
                                      className="h-[28px] w-[80px] px-2 text-[12px] bg-[#f5f5f7] rounded border border-[#d1d1d6]/60"
                                    />
                                    <button onClick={() => handleRemoveIngredient(ingIdx)} className="w-6 h-6 rounded bg-red-50 flex items-center justify-center hover:bg-red-100">
                                      <Trash2 className="w-3 h-3 text-red-500" />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex items-center gap-2">
                                  <button onClick={handleAddIngredient} className="h-[26px] px-2 text-[11px] font-medium text-[#e63462] bg-[#e63462]/10 rounded hover:bg-[#e63462]/20 flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Malzeme Ekle
                                  </button>
                                  <button onClick={handleSaveIngredients} className="h-[26px] px-3 text-[11px] font-medium text-white bg-[#34c759] rounded hover:bg-[#2db84e] flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Kaydet
                                  </button>
                                  <button onClick={() => setEditingProductId(null)} className="h-[26px] px-2 text-[11px] font-medium text-[#86868b] border border-[#d1d1d6]/60 rounded hover:bg-[#f5f5f7]">
                                    Iptal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {product.ingredients && product.ingredients.length > 0 ? (
                                  product.ingredients.map((ing, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                                      {ing.materialName}: {ing.quantity} {ing.unit}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-[#aeaeb2] italic">Esleme yapilmamis</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {!isEditing && (
                              <button onClick={() => handleEditIngredients(product)} className="h-[28px] px-3 text-[11px] font-medium text-[#e63462] bg-[#e63462]/10 rounded-lg hover:bg-[#e63462]/20 flex items-center gap-1 ml-auto">
                                <Link2 className="w-3 h-3" /> Esle
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#f9f9fb] rounded-xl p-4 text-[12px] text-[#86868b]">
                <p className="font-semibold text-[#1d1d1f] mb-1">Stok Nasil Duser?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Bir masa kapatildiginda, o masadaki tum urunler icin tanimlanan malzemeler otomatik olarak stoktan duser.</li>
                  <li>Ornek: 1 adet Kahvalti Tabagi = 2 adet Yumurta + 50gr Peynir + 30gr Zeytin</li>
                  <li>Iptal edilen urunler stoktan dusulmez.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
