import { useState, useMemo } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelToast } from "./panel-toast"
import {
  Package,
  AlertTriangle,
  RotateCcw,
  Truck,
  ClipboardList,
  TrendingUp,
  Link2,
} from "lucide-react"
import type { PanelProduct, StockMaterial } from "@/lib/panel-types"
import { MaterialsTab, ProductLinkTab } from "./stock/materials-tab"
import {
  CostAnalysisTab,
  InventoryCountsTab,
  MovementsTab,
  SuppliersTab,
} from "./stock/operations-tabs"

export default function StockView() {
  const {
    stockMaterials,
    suppliers,
    stockMovements,
    inventoryCounts,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addStockMovement,
    setProductIngredients,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    startInventoryCount,
    updateInventoryItem,
    completeInventoryCount,
    cancelInventoryCount,
    currentUser,
    products,
    categories,
    addNotification,
    hasPermission,
  } = usePanelStore()
  const { showToast } = usePanelToast()

  const isBoss = currentUser?.role === "root"
  const canManageMaterials =
    isBoss || hasPermission("inventory.manage_materials")
  const canAddMovement = isBoss || hasPermission("inventory.stock_movement")
  const canManageSuppliers =
    isBoss || hasPermission("inventory.manage_suppliers")
  const canCountInventory = isBoss || hasPermission("inventory.count_adjust")
  const canManageProducts =
    isBoss ||
    hasPermission("catalog.manage_products", "inventory.manage_materials")

  const [activeTab, setActiveTab] = useState<
    "materials" | "movements" | "suppliers" | "inventory" | "cost" | "link"
  >("materials")
  const [search, setSearch] = useState("")
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [showAddMovement, setShowAddMovement] = useState(false)
  const [showAddSupplier, setShowAddSupplier] = useState(false)

  // Forms
  const [matName, setMatName] = useState("")
  const [matUnit, setMatUnit] = useState<StockMaterial["unit"]>("kg")
  const [matStock, setMatStock] = useState("")
  const [matMin, setMatMin] = useState("")
  const [matCost, setMatCost] = useState("")
  const [matCategory, setMatCategory] = useState("")
  const [matSupplier, setMatSupplier] = useState("")

  const [mvMatId, setMvMatId] = useState("")
  const [mvType, setMvType] = useState<"in" | "out" | "waste">("in")
  const [mvQty, setMvQty] = useState("")
  const [mvCost, setMvCost] = useState("")
  const [mvReason, setMvReason] = useState("")

  const [supName, setSupName] = useState("")
  const [supContact, setSupContact] = useState("")
  const [supPhone, setSupPhone] = useState("")
  const [savingSupplier, setSavingSupplier] = useState(false)

  const lowStockItems = useMemo(
    () => stockMaterials.filter((m) => m.currentStock <= m.minStock),
    [stockMaterials],
  )

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return stockMaterials
    const q = search.trim().toLocaleLowerCase("tr-TR")
    return stockMaterials.filter(
      (m) =>
        m.name.toLocaleLowerCase("tr-TR").includes(q) ||
        m.category.toLocaleLowerCase("tr-TR").includes(q),
    )
  }, [stockMaterials, search])

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

      const manual =
        p.costPrice != null && p.costPrice > 0 ? p.costPrice : null
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
    const cost = parseFloat(matCost)
    if (!matName.trim() || !Number.isFinite(cost) || cost < 0) {
      showToast("Geçerli bir malzeme adı ve birim maliyet girin.", "error")
      return
    }
    addMaterial({
      name: matName.trim(),
      unit: matUnit,
      currentStock: Math.max(0, parseFloat(matStock) || 0),
      minStock: Math.max(0, parseFloat(matMin) || 0),
      costPerUnit: cost,
      category: matCategory.trim() || "Diğer",
      supplierId: matSupplier || undefined,
    })
    setMatName("")
    setMatStock("")
    setMatMin("")
    setMatCost("")
    setMatCategory("")
    setMatSupplier("")
    setShowAddMaterial(false)
  }

  const handleAddMovement = () => {
    const qty = parseFloat(mvQty)
    if (!mvMatId || !Number.isFinite(qty) || qty <= 0) {
      showToast("Lütfen malzeme seçin ve 0'dan büyük bir miktar girin.", "error")
      return
    }
    const material = stockMaterials.find((m) => m.id === mvMatId)
    const unitCostVal = parseFloat(mvCost)
    const unitCost =
      Number.isFinite(unitCostVal) && unitCostVal >= 0 ? unitCostVal : undefined
    void addStockMovement({
      materialId: mvMatId,
      materialName: material?.name || "",
      type: mvType,
      quantity: qty,
      unitCost,
      totalCost: (unitCost || 0) * qty,
      reason: mvReason.trim() || undefined,
      createdBy: currentUser?.name || "Sistem",
    })
    setMvMatId("")
    setMvQty("")
    setMvCost("")
    setMvReason("")
    setShowAddMovement(false)
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
          title: "Tedarikçi eklenemedi",
          message:
            "Sunucu yanıtı alınamadı veya yetki hatası. API adresini ve giriş bilgilerinizi kontrol edin.",
        })
      }
    } finally {
      setSavingSupplier(false)
    }
  }

  const TABS = [
    { id: "materials" as const, label: "Malzemeler", icon: Package },
    { id: "link" as const, label: "Ürün Eşleştir", icon: Link2 },
    { id: "movements" as const, label: "Hareketler", icon: RotateCcw },
    { id: "suppliers" as const, label: "Tedarikçiler", icon: Truck },
    { id: "inventory" as const, label: "Sayım", icon: ClipboardList },
    { id: "cost" as const, label: "Maliyet", icon: TrendingUp },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-white/50 border-b border-[#d1d1d6]/40 px-5 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-[5px] rounded-lg text-[12px] font-medium transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-[#e63462] text-white"
                  : "text-[#86868b] hover:bg-black/[0.04]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
            <AlertTriangle className="w-3 h-3" /> {lowStockItems.length} ürün
            kritik seviyede
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="w-full flex flex-col gap-4">
          {activeTab === "materials" && (
            <MaterialsTab
              stockMaterials={stockMaterials}
              filteredMaterials={filteredMaterials}
              suppliers={suppliers}
              search={search}
              setSearch={setSearch}
              showAddMaterial={showAddMaterial}
              setShowAddMaterial={setShowAddMaterial}
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
              canManageMaterials={canManageMaterials}
              handleAddMaterial={handleAddMaterial}
              updateMaterial={updateMaterial}
              deleteMaterial={deleteMaterial}
            />
          )}

          {activeTab === "movements" && (
            <MovementsTab
              stockMaterials={stockMaterials}
              stockMovements={stockMovements}
              showAddMovement={showAddMovement}
              setShowAddMovement={setShowAddMovement}
              mvMatId={mvMatId}
              setMvMatId={setMvMatId}
              mvType={mvType}
              setMvType={setMvType}
              mvQty={mvQty}
              setMvQty={setMvQty}
              mvCost={mvCost}
              setMvCost={setMvCost}
              mvReason={mvReason}
              setMvReason={setMvReason}
              canAddMovement={canAddMovement}
              handleAddMovement={handleAddMovement}
            />
          )}

          {activeTab === "suppliers" && (
            <SuppliersTab
              suppliers={suppliers}
              showAddSupplier={showAddSupplier}
              setShowAddSupplier={setShowAddSupplier}
              supName={supName}
              setSupName={setSupName}
              supContact={supContact}
              setSupContact={setSupContact}
              supPhone={supPhone}
              setSupPhone={setSupPhone}
              savingSupplier={savingSupplier}
              canManageSuppliers={canManageSuppliers}
              handleAddSupplier={() => void handleAddSupplier()}
              updateSupplier={updateSupplier}
              deleteSupplier={deleteSupplier}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryCountsTab
              inventoryCounts={inventoryCounts}
              canCountInventory={canCountInventory}
              startInventoryCount={startInventoryCount}
              updateInventoryItem={updateInventoryItem}
              completeInventoryCount={completeInventoryCount}
              cancelInventoryCount={cancelInventoryCount}
            />
          )}

          {activeTab === "cost" && (
            <CostAnalysisTab costAnalysis={costAnalysis} />
          )}

          {activeTab === "link" && (
            <ProductLinkTab
              products={products}
              categories={categories}
              stockMaterials={stockMaterials}
              canManageProducts={canManageProducts}
              setProductIngredients={setProductIngredients}
            />
          )}
        </div>
      </div>
    </div>
  )
}
