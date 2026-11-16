import {
  itemCountsTowardBill,
  type PanelOrder,
  type PanelSection,
  type PanelTable,
  type PanelUser,
} from "../panel-types"
import type { OrderDto, RawTableDto } from "../api"

export function mapOrderItem(i: OrderDto["items"][0]): PanelOrder["items"][0] {
  return {
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    price: i.price,
    quantity: i.quantity,
    note: i.note,
    status: (i.status as PanelOrder["items"][0]["status"]) || "sent",
    createdAt: new Date(i.createdAt),
    cancelReason: i.cancelReason,
    cancelledBy: i.cancelledBy,
    cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
  }
}

export function mapOrder(o: OrderDto): PanelOrder {
  return {
    id: o.id,
    tableId: o.tableId,
    userId: o.userId ?? "",
    userName: o.userName?.trim() || undefined,
    items: o.items.map(mapOrderItem),
    status: (o.status as PanelOrder["status"]) || "active",
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    mergedFrom: o.mergedFrom ?? undefined,
  }
}

export function mapApiOrdersToPanel(orders: OrderDto[]): PanelOrder[] {
  return orders.map(mapOrder)
}

/** On API refresh, preserve fallback client discount / split-bill fields if server did not supply them. */
export function mergeTablesPreserveClientFields(
  prev: PanelTable[],
  next: PanelTable[],
): PanelTable[] {
  return next.map((nt) => {
    const old = prev.find((p) => p.id === nt.id)
    const occupied = nt.status === "occupied" || (nt.orderCount ?? 0) > 0
    if (!old || !occupied) return nt
    return {
      ...nt,
      ...(nt.discount ? { discount: nt.discount } : old.discount ? { discount: old.discount } : {}),
      ...(nt.splitInfo ? { splitInfo: nt.splitInfo } : old.splitInfo ? { splitInfo: old.splitInfo } : {}),
    }
  })
}

/** Waiter name from staff (userId) on active orders. */
export function resolveStaffNameForTable(
  tableId: string,
  orders: PanelOrder[],
  staffUsers: PanelUser[],
): string | undefined {
  const active = orders.filter((o) => o.tableId === tableId && o.status === "active")
  if (active.length === 0) return undefined
  const sorted = [...active].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )
  for (const o of sorted) {
    const fromApi = o.userName?.trim()
    if (fromApi) return fromApi
    const uid = o.userId?.trim()
    if (!uid) continue
    const name = staffUsers.find((u) => u.id === uid)?.name
    if (name) return name
  }
  return undefined
}

export function mapApiTablesToPanel(
  apiTables: RawTableDto[],
  orders: PanelOrder[],
  staffUsers: PanelUser[],
): PanelTable[] {
  const activeOrders = orders.filter((o) => o.status === "active")
  return apiTables.map((t) => {
    const tableOrders = activeOrders.filter((o) => o.tableId === t.id)
    const billableItems = tableOrders.flatMap((o) => o.items.filter(itemCountsTowardBill))
    const rawTotal = billableItems.reduce((s, i) => s + i.price * i.quantity, 0)
    const orderCount = tableOrders.length
    const lastOrder = [...tableOrders].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]
    const waiter = resolveStaffNameForTable(t.id, orders, staffUsers)

    let discount: PanelTable["discount"] | undefined
    let totalAmount = rawTotal

    if (t.discount && orderCount > 0) {
      const discountAmount =
        t.discount.type === "percent"
          ? Math.round(rawTotal * t.discount.value) / 100
          : t.discount.type === "amount"
            ? Math.min(t.discount.value, rawTotal)
            : rawTotal
      discount = {
        type: t.discount.type,
        value: t.discount.value,
        amount: discountAmount,
        reason: t.discount.reason,
      }
      totalAmount = Math.max(0, rawTotal - discountAmount)
    }

    let splitInfo: PanelTable["splitInfo"] | undefined
    if (t.splitInfo && orderCount > 0) {
      if (t.splitInfo.type === "person" && t.splitInfo.personCount) {
        const perPersonAmount = Math.round((totalAmount / t.splitInfo.personCount) * 100) / 100
        splitInfo = {
          type: "person",
          personCount: t.splitInfo.personCount,
          perPersonAmount,
          paidShares: t.splitInfo.paidShares ?? [],
        }
      } else if (t.splitInfo.type === "items" && t.splitInfo.amounts) {
        const validAmounts: Record<string, number> = {}
        let selectedTotal = 0
        for (const [itemId, qty] of Object.entries(t.splitInfo.amounts)) {
          const item = billableItems.find((i) => i.id === itemId)
          if (item && qty > 0) {
            const validQty = Math.min(item.quantity, qty)
            validAmounts[itemId] = validQty
            selectedTotal += item.price * validQty
          }
        }
        const validItemIds = Object.keys(validAmounts)
        if (validItemIds.length > 0 && selectedTotal > 0) {
          splitInfo = {
            type: "items",
            itemIds: validItemIds,
            amounts: validAmounts,
            selectedTotal: Math.round(selectedTotal * 100) / 100,
          }
        }
      }
    }

    return {
      id: t.id,
      name: t.name,
      section: t.section,
      status: orderCount > 0 ? "occupied" : "empty",
      totalAmount,
      orderCount,
      lastUpdated: lastOrder ? lastOrder.updatedAt : undefined,
      activeOrderId: lastOrder?.id,
      waiter,
      ...(discount ? { discount } : {}),
      ...(splitInfo ? { splitInfo } : {}),
    }
  })
}

export function deriveSectionsFromTables(
  apiTables: { id: string; name: string; section: string }[],
): PanelSection[] {
  const names = Array.from(new Set(apiTables.map((t) => t.section).filter(Boolean)))
  return names.map((name, i) => ({ id: `section-${i}`, name }))
}

export function mapApiStaffToPanelUser(s: {
  id: string
  name: string
  email: string | null
  role: string
  roleLabel?: string
  roleColor?: string
  phone?: string
  isActive: boolean
  canAccessPanel?: boolean
  canAccessTerminal?: boolean
  permissions?: string[]
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  createdAt: string
}): PanelUser {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? undefined,
    phone: s.phone,
    role: s.role || "waiter",
    roleLabel: s.roleLabel,
    roleColor: s.roleColor,
    canAccessPanel: s.canAccessPanel,
    canAccessTerminal: s.canAccessTerminal,
    permissions: s.permissions,
    limits: s.limits,
    active: s.isActive,
    createdAt: new Date(s.createdAt),
  }
}
