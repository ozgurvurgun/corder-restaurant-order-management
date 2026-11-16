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
import type { LogActivityFn } from "./panel-store-context"

export function useCatalogActions(params: {
  token: string | null
  stockMaterials: StockMaterial[]
  setCategories: (
    v: PanelCategory[] | ((prev: PanelCategory[]) => PanelCategory[]),
  ) => void
  setProducts: (
    v: PanelProduct[] | ((prev: PanelProduct[]) => PanelProduct[]),
  ) => void
  setCampaigns: (
    v: Campaign[] | ((prev: Campaign[]) => Campaign[]),
  ) => void
  logActivity: LogActivityFn
}) {
  const {
    token,
    stockMaterials,
    setCategories,
    setProducts,
    setCampaigns,
    logActivity,
  } = params

  const addProduct = useCallback(
    (p: Omit<PanelProduct, "id">) => {
      if (!token) return
      api.products
        .create(token, {
          categoryId: p.categoryId,
          name: p.name,
          price: p.price,
          description: p.description,
          imageUrl: p.image,
          inStock: p.inStock ?? true,
          ingredients:
            p.ingredients?.map((i) => ({
              materialId: i.materialId,
              quantity: i.quantity,
            })) ?? undefined,
        })
        .then((created) => {
          setProducts((prev) => [
            ...prev,
            mapApiProductsToPanel([created], stockMaterials)[0],
          ])
          logActivity({
            action: "product_created",
            category: "product",
            details: `Urun eklendi: ${created.name}`,
            metadata: {
              productId: created.id,
              categoryId: created.categoryId,
              price: created.price,
            },
          })
        })
        .catch(console.error)
    },
    [token, stockMaterials, setProducts, logActivity],
  )

  const updateProduct = useCallback(
    (id: string, data: Partial<PanelProduct>) => {
      if (!token) return
      const body: Parameters<typeof api.products.update>[2] = {}
      if (data.name !== undefined) body.name = data.name
      if (data.description !== undefined) body.description = data.description
      if (data.price !== undefined) body.price = data.price
      if (data.image !== undefined) body.imageUrl = data.image
      if (data.inStock !== undefined) body.inStock = data.inStock
      if (data.ingredients !== undefined) {
        body.ingredients =
          data.ingredients.length > 0
            ? data.ingredients.map((i) => ({
                materialId: i.materialId,
                quantity: i.quantity,
              }))
            : []
      }
      if (Object.keys(body).length === 0) return
      api.products
        .update(token, id, body)
        .then((updated) => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === id
                ? mapApiProductsToPanel([updated], stockMaterials)[0]
                : p,
            ),
          )
          logActivity({
            action: "product_updated",
            category: "product",
            details: `Urun guncellendi: ${updated.name}`,
            metadata: { productId: id, fields: Object.keys(body) },
          })
        })
        .catch(console.error)
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
            details: `Urun silindi: ${id}`,
            metadata: { productId: id },
          })
        })
        .catch(console.error)
    },
    [token, setProducts, logActivity],
  )

  const reorderProducts = useCallback(
    (ids: string[]) => {
      setProducts((prev) => {
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
      if (!token) return
      logActivity({
        action: "products_reordered",
        category: "product",
        details: `Urun sirasi guncellendi (${ids.length} adet)`,
        metadata: { ids },
      })
      api.products.reorder(token, ids).catch(console.error)
    },
    [token, setProducts, logActivity],
  )

  const addCategory = useCallback(
    (
      name: string,
      opts?: {
        showInTerminal?: boolean
        showInMenu?: boolean
        parentId?: string | null
      },
    ) => {
      if (!token) return
      const showInTerminal = opts?.showInTerminal ?? true
      const showInMenu = opts?.showInMenu ?? true
      const parentId = opts?.parentId?.trim() || undefined
      api.categories
        .create(token, {
          name,
          showInTerminal,
          showInMenu,
          ...(parentId ? { parentId } : {}),
        })
        .then((created) => {
          setCategories((prev) => [
            ...prev,
            mapApiCategoriesToPanel([created])[0],
          ])
          logActivity({
            action: "category_created",
            category: "product",
            details: `Kategori eklendi: ${created.name}`,
            metadata: {
              categoryId: created.id,
              parentId: created.parentId ?? undefined,
            },
          })
        })
        .catch(console.error)
    },
    [token, setCategories, logActivity],
  )

  const updateCategory = useCallback(
    (id: string, data: Partial<PanelCategory>) => {
      if (!token) return
      const payload: {
        name?: string
        showInTerminal?: boolean
        showInMenu?: boolean
        parentId?: string | null
      } = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.showInTerminal !== undefined)
        payload.showInTerminal = data.showInTerminal
      if (data.showInMenu !== undefined) payload.showInMenu = data.showInMenu
      if (data.parentId !== undefined)
        payload.parentId = data.parentId?.trim() || null
      api.categories
        .update(token, id, payload)
        .then((updated) => {
          setCategories((prev) =>
            prev.map((c) =>
              c.id === id ? mapApiCategoriesToPanel([updated])[0] : c,
            ),
          )
          logActivity({
            action: "category_updated",
            category: "product",
            details: `Kategori guncellendi: ${updated.name}`,
            metadata: { categoryId: id, fields: Object.keys(payload) },
          })
        })
        .catch(console.error)
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
        })
        .catch(console.error)
    },
    [token, setCategories, logActivity],
  )

  const reorderCategories = useCallback(
    (ids: string[], parentId?: string | null) => {
      setCategories((prev) =>
        prev.map((c) => {
          const idx = ids.indexOf(c.id)
          if (idx === -1) return c
          return { ...c, order: idx + 1 }
        }),
      )
      if (!token) return
      const body: { ids: string[]; parentId?: string | null } = { ids }
      if (parentId !== undefined) body.parentId = parentId
      logActivity({
        action: "categories_reordered",
        category: "product",
        details: `Kategori sirasi guncellendi (${ids.length} adet)`,
        metadata: { ids, parentId },
      })
      api.categories.reorder(token, body).catch(console.error)
    },
    [token, setCategories, logActivity],
  )

  const addCampaign = useCallback(
    (c: Omit<Campaign, "id" | "createdAt" | "order">) => {
      if (!token) return
      api.campaigns
        .create(token, {
          title: c.title,
          description: c.description,
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
        })
        .catch(console.error)
    },
    [token, setCampaigns, logActivity],
  )

  const updateCampaign = useCallback(
    (id: string, data: Partial<Campaign>) => {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c)),
      )
      logActivity({
        action: "campaign_updated",
        category: "settings",
        details: `Kampanya guncellendi: ${id}`,
        metadata: { campaignId: id, fields: Object.keys(data) },
      })
      if (!token) return
      api.campaigns
        .update(token, id, {
          title: data.title,
          description: data.description,
          imageUrl: data.image,
          discountPercent: data.discountPercent,
          originalPrice: data.originalPrice,
          discountedPrice: data.discountedPrice,
          validUntil: data.validUntil
            ? data.validUntil.toISOString()
            : undefined,
          isActive: data.isActive,
        })
        .catch(console.error)
    },
    [token, setCampaigns, logActivity],
  )

  const deleteCampaign = useCallback(
    (id: string) => {
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      logActivity({
        action: "campaign_deleted",
        category: "settings",
        details: `Kampanya silindi: ${id}`,
        metadata: { campaignId: id },
      })
      if (!token) return
      api.campaigns.delete(token, id).catch(console.error)
    },
    [token, setCampaigns, logActivity],
  )

  const reorderCampaigns = useCallback(
    (ids: string[]) => {
      setCampaigns((prev) =>
        ids.map((id, i) => ({
          ...prev.find((c) => c.id === id)!,
          order: i + 1,
        })),
      )
      logActivity({
        action: "campaigns_reordered",
        category: "settings",
        details: `Kampanya sirasi guncellendi (${ids.length} adet)`,
        metadata: { ids },
      })
      if (!token) return
      api.campaigns.reorder(token, ids).catch(console.error)
    },
    [token, setCampaigns, logActivity],
  )

  return {
    addProduct,
    updateProduct,
    deleteProduct,
    reorderProducts,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    reorderCampaigns,
  }
}
