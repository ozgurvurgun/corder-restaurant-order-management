import { useCallback } from "react"
import type {
  Campaign,
  PanelCategory,
  PanelProduct,
  StockMaterial,
} from "../panel-types"
import { api } from "../api"
import {
  mapApiCategoriesToPanel,
  mapApiProductsToPanel,
  mapCampaignDtoToPanel,
} from "../mappers/catalog-inventory.mapper"
import { showPanelToast } from "@/components/panel/panel-toast"
import type { LogActivityFn } from "./panel-store-context"

export function useCatalogActions(params: {
  token: string | null
  stockMaterials: StockMaterial[]
  setCategories: (v: PanelCategory[] | ((prev: PanelCategory[]) => PanelCategory[])) => void
  setProducts: (v: PanelProduct[] | ((prev: PanelProduct[]) => PanelProduct[])) => void
  setCampaigns: (v: Campaign[] | ((prev: Campaign[]) => Campaign[])) => void
  logActivity: LogActivityFn
}) {
  const { token, stockMaterials, setCategories, setProducts, setCampaigns, logActivity } = params

  const addProduct = useCallback(
    (p: Omit<PanelProduct, "id">) => {
      if (!token) return
      api.products
        .create(token, {
          categoryId: p.categoryId,
          name: p.name.trim(),
          price: p.price,
          costPrice: p.costPrice ?? null,
          description: p.description?.trim() || undefined,
          imageUrl: p.image || undefined,
          inStock: p.inStock ?? true,
          calories: p.calories != null && p.calories > 0 ? Math.round(p.calories) : null,
          allergens: p.allergens && p.allergens.length > 0 ? p.allergens : null,
          ingredients:
            p.ingredients?.map((i) => ({ materialId: i.materialId, quantity: i.quantity })) ?? undefined,
        })
        .then((created) => {
          const mapped = mapApiProductsToPanel([created], stockMaterials)[0]
          setProducts((prev) => [...prev, mapped])
          logActivity({
            action: "product_created",
            category: "product",
            details: `Ürün eklendi: ${mapped.name}`,
            metadata: { productId: created.id, categoryId: created.categoryId, price: created.price },
          })
          showPanelToast(`Ürün eklendi: ${mapped.name}`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Ürün eklenemedi", "error"))
    },
    [token, stockMaterials, setProducts, logActivity],
  )

  const updateProduct = useCallback(
    (id: string, data: Partial<PanelProduct>) => {
      if (!token) return
      const body: Parameters<typeof api.products.update>[2] = {}
      if (data.categoryId !== undefined) body.categoryId = data.categoryId
      if (data.name !== undefined) body.name = data.name.trim()
      if (data.description !== undefined) body.description = data.description
      if (data.price !== undefined) body.price = data.price
      if (data.costPrice !== undefined) body.costPrice = data.costPrice
      if (data.image !== undefined) body.imageUrl = data.image
      if (data.inStock !== undefined) body.inStock = data.inStock
      if (data.calories !== undefined) {
        body.calories = data.calories != null && data.calories > 0 ? Math.round(data.calories) : null
      }
      if (data.allergens !== undefined) {
        body.allergens = data.allergens && data.allergens.length > 0 ? data.allergens : null
      }
      if (data.ingredients !== undefined) {
        body.ingredients =
          data.ingredients.length > 0
            ? data.ingredients.map((i) => ({ materialId: i.materialId, quantity: i.quantity }))
            : []
      }
      if (Object.keys(body).length === 0) return
      api.products
        .update(token, id, body)
        .then((updated) => {
          setProducts((prev) =>
            prev.map((p) => (p.id === id ? mapApiProductsToPanel([updated], stockMaterials)[0] : p)),
          )
          logActivity({
            action: "product_updated",
            category: "product",
            details: `Ürün güncellendi: ${updated.name}`,
            metadata: { productId: id, fields: Object.keys(body) },
          })
          showPanelToast("Ürün güncellendi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Ürün güncellenemedi", "error"))
    },
    [token, stockMaterials, setProducts, logActivity],
  )

  const deleteProduct = useCallback(
    (id: string) => {
      if (!token) return
      api.products
        .delete(token, id)
        .then(() => {
          setProducts((prev) => prev.filter((p) => p.id !== id))
          logActivity({
            action: "product_deleted",
            category: "product",
            details: `Ürün silindi: ${id}`,
            metadata: { productId: id },
          })
          showPanelToast("Ürün silindi", "info")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Ürün silinemedi", "error"))
    },
    [token, setProducts, logActivity],
  )

  const reorderProducts = useCallback(
    (ids: string[]) => {
      if (!token) return
      api.products
        .reorder(token, ids)
        .then((updatedList) => {
          setProducts((prev) => {
            if (updatedList?.length) {
              const orderMap = new Map(updatedList.map((u) => [u.id, u.order]))
              return prev.map((p) => (orderMap.has(p.id) ? { ...p, order: orderMap.get(p.id)! } : p))
            }
            const map = new Map(prev.map((p) => [p.id, p]))
            const reordered: PanelProduct[] = []
            ids.forEach((id, index) => {
              const p = map.get(id)
              if (p) {
                reordered.push({ ...p, order: index + 1 })
                map.delete(id)
              }
            })
            return [...reordered, ...Array.from(map.values())]
          })
          logActivity({
            action: "products_reordered",
            category: "product",
            details: `Ürün sırası güncellendi (${ids.length} adet)`,
            metadata: { ids },
          })
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Ürün sırası güncellenemedi", "error"))
    },
    [token, setProducts, logActivity],
  )

  const addCategory = useCallback(
    (
      name: string,
      opts?: {
        showInTerminal?: boolean
        showInMenu?: boolean
        showInQuickSale?: boolean
        parentId?: string | null
      },
    ) => {
      if (!token) return
      const showInTerminal = opts?.showInTerminal ?? true
      const showInMenu = opts?.showInMenu ?? true
      const showInQuickSale = opts?.showInQuickSale ?? true
      const parentId = opts?.parentId?.trim() || undefined
      api.categories
        .create(token, {
          name: name.trim(),
          showInTerminal,
          showInMenu,
          showInQuickSale,
          ...(parentId ? { parentId } : {}),
        })
        .then((created) => {
          const mapped = mapApiCategoriesToPanel([created])[0]
          setCategories((prev) => [...prev, mapped])
          logActivity({
            action: "category_created",
            category: "product",
            details: `Kategori eklendi: ${mapped.name}`,
            metadata: { categoryId: created.id, parentId: created.parentId ?? undefined },
          })
          showPanelToast(`Kategori eklendi: ${mapped.name}`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kategori eklenemedi", "error"))
    },
    [token, setCategories, logActivity],
  )

  const updateCategory = useCallback(
    (id: string, data: Partial<PanelCategory>) => {
      if (data.showInQuickSale !== undefined) {
        const nextQuickSale = Boolean(data.showInQuickSale)
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, showInQuickSale: nextQuickSale } : c)),
        )
      }
      if (!token) return
      const payload: {
        name?: string
        showInTerminal?: boolean
        showInMenu?: boolean
        showInQuickSale?: boolean
        parentId?: string | null
      } = {}
      if (data.name !== undefined) payload.name = data.name.trim()
      if (data.showInTerminal !== undefined) payload.showInTerminal = data.showInTerminal
      if (data.showInMenu !== undefined) payload.showInMenu = data.showInMenu
      if (data.showInQuickSale !== undefined) payload.showInQuickSale = Boolean(data.showInQuickSale)
      if (data.parentId !== undefined) payload.parentId = data.parentId?.trim() || null
      if (Object.keys(payload).length === 0) return
      api.categories
        .update(token, id, payload)
        .then((updated) => {
          setCategories((prev) =>
            prev.map((c) => (c.id === id ? mapApiCategoriesToPanel([updated])[0] : c)),
          )
          logActivity({
            action: "category_updated",
            category: "product",
            details: `Kategori güncellendi: ${updated.name}`,
            metadata: { categoryId: id, fields: Object.keys(payload) },
          })
          showPanelToast("Kategori güncellendi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kategori güncellenemedi", "error"))
    },
    [token, setCategories, logActivity],
  )

  const deleteCategory = useCallback(
    (id: string) => {
      if (!token) return
      api.categories
        .delete(token, id)
        .then(() => {
          setCategories((prev) => prev.filter((c) => c.id !== id))
          logActivity({
            action: "category_deleted",
            category: "product",
            details: `Kategori silindi: ${id}`,
            metadata: { categoryId: id },
          })
          showPanelToast("Kategori silindi", "info")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kategori silinemedi", "error"))
    },
    [token, setCategories, logActivity],
  )

  const reorderCategories = useCallback(
    (ids: string[], parentId?: string | null) => {
      if (!token) return
      const body: { ids: string[]; parentId?: string | null } = { ids }
      if (parentId !== undefined) body.parentId = parentId
      api.categories
        .reorder(token, body)
        .then(() => {
          setCategories((prev) =>
            prev.map((c) => {
              const idx = ids.indexOf(c.id)
              return idx === -1 ? c : { ...c, order: idx + 1 }
            }),
          )
          logActivity({
            action: "categories_reordered",
            category: "product",
            details: `Kategori sırası güncellendi (${ids.length} adet)`,
            metadata: { ids, parentId },
          })
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kategori sırası güncellenemedi", "error"))
    },
    [token, setCategories, logActivity],
  )

  const addCampaign = useCallback(
    (c: Omit<Campaign, "id" | "createdAt" | "order">) => {
      if (!token) return
      api.campaigns
        .create(token, {
          title: c.title.trim(),
          description: c.description?.trim() || undefined,
          imageUrl: c.image,
          discountPercent: c.discountPercent,
          originalPrice: c.originalPrice,
          discountedPrice: c.discountedPrice,
          validUntil: c.validUntil ? c.validUntil.toISOString() : undefined,
          isActive: c.isActive,
        })
        .then((created) => {
          setCampaigns((prev) => [...prev, mapCampaignDtoToPanel(created)])
          logActivity({
            action: "campaign_created",
            category: "settings",
            details: `Kampanya eklendi: ${created.title}`,
            metadata: { campaignId: created.id, isActive: created.isActive },
          })
          showPanelToast("Kampanya eklendi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kampanya eklenemedi", "error"))
    },
    [token, setCampaigns, logActivity],
  )

  const updateCampaign = useCallback(
    (id: string, data: Partial<Campaign>) => {
      if (!token) return
      api.campaigns
        .update(token, id, {
          title: data.title,
          description: data.description,
          imageUrl: data.image,
          discountPercent: data.discountPercent,
          originalPrice: data.originalPrice,
          discountedPrice: data.discountedPrice,
          validUntil: data.validUntil ? data.validUntil.toISOString() : undefined,
          isActive: data.isActive,
        })
        .then((updated) => {
          setCampaigns((prev) =>
            prev.map((c) => (c.id === id ? mapCampaignDtoToPanel(updated) : c)),
          )
          logActivity({
            action: "campaign_updated",
            category: "settings",
            details: `Kampanya güncellendi: ${updated.title}`,
            metadata: { campaignId: id, fields: Object.keys(data) },
          })
          showPanelToast("Kampanya güncellendi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kampanya güncellenemedi", "error"))
    },
    [token, setCampaigns, logActivity],
  )

  const deleteCampaign = useCallback(
    (id: string) => {
      if (!token) return
      api.campaigns
        .delete(token, id)
        .then(() => {
          setCampaigns((prev) => prev.filter((c) => c.id !== id))
          logActivity({
            action: "campaign_deleted",
            category: "settings",
            details: `Kampanya silindi: ${id}`,
            metadata: { campaignId: id },
          })
          showPanelToast("Kampanya silindi", "warning")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kampanya silinemedi", "error"))
    },
    [token, setCampaigns, logActivity],
  )

  const reorderCampaigns = useCallback(
    (ids: string[]) => {
      if (!token) return
      api.campaigns
        .reorder(token, ids)
        .then(() => {
          setCampaigns((prev) =>
            ids
              .map((id, i) => {
                const hit = prev.find((c) => c.id === id)
                return hit ? { ...hit, order: i + 1 } : null
              })
              .filter(Boolean) as Campaign[],
          )
          logActivity({
            action: "campaigns_reordered",
            category: "settings",
            details: `Kampanya sırası güncellendi (${ids.length} adet)`,
            metadata: { ids },
          })
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kampanya sırası güncellenemedi", "error"))
    },
    [token, setCampaigns, logActivity],
  )

  return {
    addProduct, updateProduct, deleteProduct, reorderProducts,
    addCategory, updateCategory, deleteCategory, reorderCategories,
    addCampaign, updateCampaign, deleteCampaign, reorderCampaigns,
  }
}
