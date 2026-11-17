import type {
  Campaign,
  InventoryCount,
  PanelCategory,
  PanelProduct,
  PurchaseOrder,
  StockMaterial,
  StockMovement,
  Supplier,
} from "../panel-types"
import type {
  CampaignDto,
  CategoryDto,
  InventoryCountDto,
  ProductDto,
  PurchaseOrderDto,
  StockMaterialDto,
  StockMovementDto,
  SupplierDto,
} from "../api"
import { formatTitleCaseTr } from "../format"

export function mapApiCategoriesToPanel(cats: CategoryDto[]): PanelCategory[] {
  return cats.map((c) => ({
    id: c.id,
    name: formatTitleCaseTr(c.name),
    slug: c.slug,
    order: c.order,
    parentId: c.parentId?.trim() || undefined,
    showInTerminal: c.showInTerminal,
    showInMenu: c.showInMenu,
    showInQuickSale: c.showInQuickSale !== false,
  }))
}

/** Depth-first list from root (for subcategories in the left menu). */
export function orderedCategoryList(cats: PanelCategory[]): PanelCategory[] {
  const byParent = new Map<string | undefined, PanelCategory[]>()
  for (const c of cats) {
    const k = c.parentId?.trim() || undefined
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(c)
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }
  const walk = (parentId: string | undefined): PanelCategory[] => {
    const ch = byParent.get(parentId) ?? []
    return ch.flatMap((x) => [x, ...walk(x.id)])
  }
  return walk(undefined)
}

export function mapApiProductsToPanel(
  products: ProductDto[],
  materials: StockMaterial[] = [],
): PanelProduct[] {
  const matMap = new Map(materials.map((m) => [m.id, m]))
  return products.map((p) => {
    const ing = p.ingredients?.length
      ? p.ingredients.map((row) => ({
          materialId: row.materialId,
          quantity: Number(row.quantity),
          materialName: formatTitleCaseTr(matMap.get(row.materialId)?.name ?? ""),
          unit: matMap.get(row.materialId)?.unit ?? "adet",
        }))
      : undefined
    return {
      id: p.id,
      name: formatTitleCaseTr(p.name),
      price: Number(p.price),
      costPrice: p.costPrice != null ? Number(p.costPrice) : undefined,
      categoryId: p.categoryId,
      inStock: p.inStock,
      order: p.order,
      description: p.description ?? undefined,
      image: p.imageUrl ?? undefined,
      ...(ing?.length ? { ingredients: ing } : {}),
    }
  })
}

export function mapStockMaterialDtoToPanel(m: StockMaterialDto): StockMaterial {
  return {
    id: m.id,
    name: formatTitleCaseTr(m.name),
    unit: m.unit as StockMaterial["unit"],
    currentStock: Number(m.currentStock),
    minStock: Number(m.minStock),
    costPerUnit: Number(m.costPerUnit),
    supplierId: m.supplierId ?? undefined,
    category: m.category,
    lastUpdated: new Date(m.updatedAt),
  }
}

export function mapSupplierDtoToPanel(s: SupplierDto): Supplier {
  return {
    id: s.id,
    name: formatTitleCaseTr(s.name),
    contactPerson: s.contactPerson ? formatTitleCaseTr(s.contactPerson) : undefined,
    phone: s.phone ?? undefined,
    email: s.email ?? undefined,
    address: s.address ?? undefined,
    notes: s.notes ?? undefined,
    active: s.active,
  }
}

export function mapStockMovementDtoToPanel(mv: StockMovementDto): StockMovement {
  return {
    id: mv.id,
    materialId: mv.materialId,
    materialName: formatTitleCaseTr(mv.materialName),
    type: mv.type,
    quantity: Number(mv.quantity),
    previousStock: Number(mv.previousStock),
    newStock: Number(mv.newStock),
    unitCost: mv.unitCost != null ? Number(mv.unitCost) : undefined,
    totalCost: mv.totalCost != null ? Number(mv.totalCost) : undefined,
    supplierId: mv.supplierId ?? undefined,
    reason: mv.reason ?? undefined,
    createdBy: formatTitleCaseTr(mv.createdBy),
    createdAt: new Date(mv.createdAt),
  }
}

export function mapPurchaseOrderDtoToPanel(po: PurchaseOrderDto): PurchaseOrder {
  return {
    id: po.id,
    supplierId: po.supplierId,
    supplierName: formatTitleCaseTr(po.supplierName),
    items: po.items.map((it) => ({
      materialId: it.materialId,
      materialName: formatTitleCaseTr(it.materialName),
      quantity: it.quantity,
      unitCost: it.unitCost,
    })),
    totalAmount: Number(po.totalAmount),
    status: po.status,
    notes: po.notes ?? undefined,
    createdBy: formatTitleCaseTr(po.createdBy),
    createdAt: new Date(po.createdAt),
    receivedAt: po.receivedAt ? new Date(po.receivedAt) : undefined,
  }
}

export function mapInventoryCountDtoToPanel(
  ic: InventoryCountDto,
): InventoryCount {
  return {
    id: ic.id,
    date: new Date(ic.date),
    countedBy: formatTitleCaseTr(ic.countedBy),
    items: ic.items.map((item) => ({
      materialId: item.materialId,
      materialName: formatTitleCaseTr(item.materialName),
      expectedStock: item.expectedStock,
      actualStock: item.actualStock,
      difference: item.difference,
    })),
    status: ic.status,
    notes: ic.notes ?? undefined,
  }
}

export function mapCampaignDtoToPanel(c: CampaignDto): Campaign {
  return {
    id: c.id,
    title: formatTitleCaseTr(c.title),
    description: c.description ?? undefined,
    image: c.imageUrl,
    discountPercent: c.discountPercent ?? undefined,
    originalPrice: c.originalPrice != null ? Number(c.originalPrice) : undefined,
    discountedPrice:
      c.discountedPrice != null ? Number(c.discountedPrice) : undefined,
    validUntil: c.validUntil ? new Date(c.validUntil) : undefined,
    isActive: c.isActive,
    order: c.order,
    createdAt: new Date(c.createdAt),
  }
}
