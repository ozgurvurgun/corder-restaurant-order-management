import { useCallback } from "react"
import type {
  InventoryCount,
  PanelProduct,
  PurchaseOrder,
  StockMaterial,
  StockMovement,
  Supplier,
} from "../panel-types"
import { api } from "../api"
import {
  mapApiProductsToPanel,
  mapInventoryCountDtoToPanel,
  mapPurchaseOrderDtoToPanel,
  mapStockMaterialDtoToPanel,
  mapStockMovementDtoToPanel,
  mapSupplierDtoToPanel,
} from "../mappers/catalog-inventory.mapper"
import type { LogActivityFn, StockMovementInput } from "./panel-store-context"

export function useInventoryActions(params: {
  token: string | null
  stockMaterials: StockMaterial[]
  purchaseOrders: PurchaseOrder[]
  setStockMaterials: (
    v: StockMaterial[] | ((prev: StockMaterial[]) => StockMaterial[]),
  ) => void
  setSuppliers: (v: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void
  setStockMovements: (
    v: StockMovement[] | ((prev: StockMovement[]) => StockMovement[]),
  ) => void
  setPurchaseOrders: (
    v: PurchaseOrder[] | ((prev: PurchaseOrder[]) => PurchaseOrder[]),
  ) => void
  setInventoryCounts: (
    v: InventoryCount[] | ((prev: InventoryCount[]) => InventoryCount[]),
  ) => void
  setProducts: (
    v: PanelProduct[] | ((prev: PanelProduct[]) => PanelProduct[]),
  ) => void
  logActivity: LogActivityFn
}) {
  const {
    token,
    stockMaterials,
    purchaseOrders,
    setStockMaterials,
    setSuppliers,
    setStockMovements,
    setPurchaseOrders,
    setInventoryCounts,
    setProducts,
    logActivity,
  } = params

  const addMaterial = useCallback(
    (m: Omit<StockMaterial, "id" | "lastUpdated">) => {
      if (!token) return
      api.stock.materials
        .create(token, {
          name: m.name,
          unit: m.unit,
          currentStock: m.currentStock,
          minStock: m.minStock,
          costPerUnit: m.costPerUnit,
          supplierId: m.supplierId,
          category: m.category,
        })
        .then((created) => {
          setStockMaterials((prev) => [
            ...prev,
            mapStockMaterialDtoToPanel(created),
          ])
          logActivity({
            action: "material_created",
            category: "stock",
            details: `Malzeme eklendi: ${created.name}`,
            metadata: {
              materialId: created.id,
              stock: created.currentStock,
              unit: created.unit,
            },
          })
        })
        .catch(console.error)
    },
    [token, setStockMaterials, logActivity],
  )

  const updateMaterial = useCallback(
    (id: string, data: Partial<StockMaterial>) => {
      if (!token) return
      const body = {
        name: data.name,
        unit: data.unit,
        currentStock: data.currentStock,
        minStock: data.minStock,
        costPerUnit: data.costPerUnit,
        supplierId: data.supplierId,
        category: data.category,
      }
      api.stock.materials
        .update(token, id, body)
        .then((updated) => {
          setStockMaterials((prev) =>
            prev.map((m) =>
              m.id === id ? mapStockMaterialDtoToPanel(updated) : m,
            ),
          )
          logActivity({
            action: "material_updated",
            category: "stock",
            details: `Malzeme guncellendi: ${updated.name}`,
            metadata: { materialId: id, fields: Object.keys(body) },
          })
        })
        .catch(console.error)
    },
    [token, setStockMaterials, logActivity],
  )

  const deleteMaterial = useCallback(
    (id: string) => {
      if (!token) return
      api.stock.materials
        .delete(token, id)
        .then(() => {
          setStockMaterials((prev) => prev.filter((m) => m.id !== id))
          logActivity({
            action: "material_deleted",
            category: "stock",
            details: `Malzeme silindi: ${id}`,
            metadata: { materialId: id },
          })
        })
        .catch(console.error)
    },
    [token, setStockMaterials, logActivity],
  )

  const addStockMovement = useCallback(
    (m: StockMovementInput): Promise<void> => {
      if (!token) return Promise.resolve()
      const material = stockMaterials.find((sm) => sm.id === m.materialId)
      if (!material) return Promise.resolve()
      return api.stock.movements
        .create(token, {
          materialId: m.materialId,
          materialName: m.materialName,
          type: m.type,
          quantity: m.quantity,
          unitCost: m.unitCost,
          totalCost: m.totalCost,
          supplierId: m.supplierId,
          reason: m.reason,
          createdBy: m.createdBy,
        })
        .then((created) => {
          setStockMovements((prev) => [
            mapStockMovementDtoToPanel(created),
            ...prev,
          ])
          setStockMaterials((mats) =>
            mats.map((sm) =>
              sm.id === created.materialId
                ? {
                    ...sm,
                    currentStock: created.newStock,
                    lastUpdated: new Date(created.createdAt),
                  }
                : sm,
            ),
          )
          logActivity({
            action: "stock_movement_created",
            category: "stock",
            details: `${created.materialName} icin ${created.type} hareketi (${created.quantity})`,
            metadata: {
              movementId: created.id,
              materialId: created.materialId,
              type: created.type,
              quantity: created.quantity,
            },
          })
        })
        .catch((e) => {
          console.error(e)
          throw e
        })
    },
    [stockMaterials, token, setStockMovements, setStockMaterials, logActivity],
  )

  const setProductIngredients = useCallback(
    (
      productId: string,
      ingredients: { materialId: string; quantity: number }[],
    ) => {
      if (!token) return
      const payload = ingredients.filter((i) => i.materialId && i.quantity > 0)
      void api.products
        .update(token, productId, {
          ingredients: payload.map((i) => ({
            materialId: i.materialId,
            quantity: i.quantity,
          })),
        })
        .then((updated) =>
          setProducts((prev) =>
            prev.map((p) =>
              p.id === productId
                ? mapApiProductsToPanel([updated], stockMaterials)[0]
                : p,
            ),
          ),
        )
        .then(() => {
          logActivity({
            action: "product_ingredients_updated",
            category: "stock",
            details: "Urun-malzeme eslestirmesi guncellendi",
            metadata: { productId, ingredientCount: payload.length },
          })
        })
        .catch(console.error)
    },
    [stockMaterials, token, setProducts, logActivity],
  )

  const addSupplier = useCallback(
    (s: Omit<Supplier, "id">): Promise<boolean> => {
      if (!token) return Promise.resolve(false)
      return api.stock.suppliers
        .create(token, {
          name: s.name,
          contactPerson: s.contactPerson,
          phone: s.phone,
          email: s.email,
          address: s.address,
          notes: s.notes,
        })
        .then((created) => {
          setSuppliers((prev) => [...prev, mapSupplierDtoToPanel(created)])
          logActivity({
            action: "supplier_created",
            category: "stock",
            details: `Tedarikci eklendi: ${created.name}`,
            metadata: {
              supplierId: created.id,
              phone: created.phone ?? undefined,
            },
          })
          return true
        })
        .catch((e) => {
          console.error(e)
          return false
        })
    },
    [token, setSuppliers, logActivity],
  )

  const updateSupplier = useCallback(
    (id: string, data: Partial<Supplier>) => {
      if (!token) return
      api.stock.suppliers
        .update(token, id, {
          name: data.name,
          contactPerson: data.contactPerson,
          phone: data.phone,
          email: data.email,
          address: data.address,
          notes: data.notes,
          active: data.active,
        })
        .then((updated) => {
          setSuppliers((prev) =>
            prev.map((s) =>
              s.id === id ? mapSupplierDtoToPanel(updated) : s,
            ),
          )
          logActivity({
            action: "supplier_updated",
            category: "stock",
            details: `Tedarikci guncellendi: ${updated.name}`,
            metadata: { supplierId: id, fields: Object.keys(data) },
          })
        })
        .catch(console.error)
    },
    [token, setSuppliers, logActivity],
  )

  const deleteSupplier = useCallback(
    (id: string) => {
      if (!token) return
      api.stock.suppliers
        .delete(token, id)
        .then(() => {
          setSuppliers((prev) => prev.filter((s) => s.id !== id))
          logActivity({
            action: "supplier_deleted",
            category: "stock",
            details: `Tedarikci silindi: ${id}`,
            metadata: { supplierId: id },
          })
        })
        .catch(console.error)
    },
    [token, setSuppliers, logActivity],
  )

  const addPurchaseOrder = useCallback(
    (po: Omit<PurchaseOrder, "id" | "createdAt">) => {
      if (!token) return
      api.stock.purchaseOrders
        .create(token, {
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          items: po.items,
          notes: po.notes,
          status: po.status === "draft" ? "draft" : "ordered",
        })
        .then((created) => {
          setPurchaseOrders((prev) => [
            mapPurchaseOrderDtoToPanel(created),
            ...prev,
          ])
        })
        .catch(console.error)
    },
    [token, setPurchaseOrders],
  )

  const updatePurchaseOrder = useCallback(
    (id: string, data: Partial<PurchaseOrder>) => {
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === id ? { ...po, ...data } : po)),
      )
    },
    [setPurchaseOrders],
  )

  const receivePurchaseOrder = useCallback(
    (id: string) => {
      if (!token) return
      const po = purchaseOrders.find((p) => p.id === id)
      if (!po) return
      api.stock.purchaseOrders
        .receive(token, id)
        .then((updated) => {
          setPurchaseOrders((prev) =>
            prev.map((p) =>
              p.id === id ? mapPurchaseOrderDtoToPanel(updated) : p,
            ),
          )
        })
        .catch(console.error)
    },
    [purchaseOrders, token, setPurchaseOrders],
  )

  const startInventoryCount = useCallback(() => {
    if (!token) return
    api.stock.inventoryCounts
      .start(token)
      .then((created) => {
        setInventoryCounts((prev) => [
          mapInventoryCountDtoToPanel(created),
          ...prev,
        ])
      })
      .catch(console.error)
  }, [token, setInventoryCounts])

  const updateInventoryItem = useCallback(
    (countId: string, materialId: string, actual: number) => {
      if (!token) return
      api.stock.inventoryCounts
        .updateItem(token, countId, { materialId, actual })
        .then((updated) => {
          setInventoryCounts((prev) =>
            prev.map((c) =>
              c.id === countId ? mapInventoryCountDtoToPanel(updated) : c,
            ),
          )
        })
        .catch(console.error)
    },
    [token, setInventoryCounts],
  )

  const completeInventoryCount = useCallback(
    (countId: string) => {
      if (!token) return
      api.stock.inventoryCounts
        .complete(token, countId)
        .then((updated) => {
          setInventoryCounts((prev) =>
            prev.map((c) =>
              c.id === countId ? mapInventoryCountDtoToPanel(updated) : c,
            ),
          )
        })
        .catch(console.error)
    },
    [token, setInventoryCounts],
  )

  return {
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addStockMovement,
    setProductIngredients,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addPurchaseOrder,
    updatePurchaseOrder,
    receivePurchaseOrder,
    startInventoryCount,
    updateInventoryItem,
    completeInventoryCount,
  }
}
