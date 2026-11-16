import {
  itemCountsTowardBill,
  type PanelOrder,
  type PanelSection,
  type PanelTable,
  type PanelUser,
  type PanelUserRole,
} from "../panel-types"
import type { OrderDto } from "../api"

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

/** On API refresh, preserve client-only discount / split-bill fields. */
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
      ...(old.discount ? { discount: old.discount } : {}),
      ...(old.splitInfo ? { splitInfo: old.splitInfo } : {}),
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
  apiTables: { id: string; name: string; section: string; status: string }[],
  orders: PanelOrder[],
  staffUsers: PanelUser[],
): PanelTable[] {
  const activeOrders = orders.filter((o) => o.status === "active")
  return apiTables.map((t) => {
    const tableOrders = activeOrders.filter((o) => o.tableId === t.id)
    const totalAmount = tableOrders.reduce(
      (sum, o) =>
        sum +
        o.items
          .filter(itemCountsTowardBill)
          .reduce((s, i) => s + i.price * i.quantity, 0),
      0,
    )
    const orderCount = tableOrders.length
    const lastOrder = [...tableOrders].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]
    const waiter = resolveStaffNameForTable(t.id, orders, staffUsers)
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
  phone?: string
  isActive: boolean
  createdAt: string
}): PanelUser {
  const role: PanelUserRole =
    s.role === "manager" || s.role === "cashier" || s.role === "waiter"
      ? s.role
      : "waiter"
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? undefined,
    phone: s.phone,
    role,
    active: s.isActive,
    createdAt: new Date(s.createdAt),
  }
}
