import {
  itemCountsTowardBill,
  type PanelOrder,
  type PanelSection,
  type PanelTable,
  type PanelTableStatus,
  type PanelUser,
} from "../panel-types"
import type { OrderDto, RawTableDto } from "../api"
import { computeDiscountMinorUnits, formatTitleCase, fromMinorUnits, toMinorUnits } from "../format"
import { getStoredCustomSections } from "../store/panel-local-storage"

export function mapOrderItem(i: OrderDto["items"][0]): PanelOrder["items"][0] {
  return {
    id: i.id,
    productId: i.productId,
    productName: formatTitleCase(i.productName),
    price: Number(i.price),
    quantity: Number(i.quantity),
    note: i.note,
    status: (i.status as PanelOrder["items"][0]["status"]) || "sent",
    createdAt: new Date(i.createdAt),
    cancelReason: i.cancelReason,
    cancelledBy: i.cancelledBy ? formatTitleCase(i.cancelledBy) : undefined,
    cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
  }
}

export function mapOrder(o: OrderDto): PanelOrder {
  return {
    id: o.id,
    tableId: o.tableId,
    userId: o.userId ?? "",
    userName: o.userName?.trim() ? formatTitleCase(o.userName) : undefined,
    items: o.items.filter((i) => i.status !== "paid").map(mapOrderItem),
    status: (o.status as PanelOrder["status"]) || "active",
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    mergedFrom: o.mergedFrom ?? undefined,
  }
}

export function mapApiOrdersToPanel(orders: OrderDto[]): PanelOrder[] {
  return orders.map(mapOrder)
}

/**
 * Preserve live socket presence lock fields if the HTTP response did not include them,
 * while strictly trusting server-authoritative `status`, `discount`, and `splitInfo`.
 */
export function mergeTablesPreserveClientFields(
  prev: PanelTable[],
  next: PanelTable[],
): PanelTable[] {
  return next.map((nt) => {
    const old = prev.find((p) => p.id === nt.id)
    if (!old) return nt
    return {
      ...nt,
      ...(nt.lockedByStaffId
        ? {}
        : old.lockedByStaffId
          ? {
              lockedByStaffId: old.lockedByStaffId,
              lockedByStaffName: old.lockedByStaffName,
            }
          : {}),
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
    const uid = o.userId?.trim()
    if (uid) {
      const name = staffUsers.find((u) => u.id === uid)?.name?.trim()
      if (name) return name
    }
    const fromApi = o.userName?.trim()
    if (fromApi) return fromApi
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
    const rawMinorUnits = billableItems.reduce(
      (s, i) => s + toMinorUnits(i.price) * i.quantity,
      0,
    )
    const orderCount = tableOrders.length
    const lastOrder = [...tableOrders].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]
    const waiter =
      resolveStaffNameForTable(t.id, orders, staffUsers) ||
      (orderCount > 0 && t.sessionStaffName?.trim()
        ? formatTitleCase(t.sessionStaffName)
        : undefined)

    let discount: PanelTable["discount"] | undefined
    let totalMinorUnits = rawMinorUnits

    if (t.discount && orderCount > 0) {
      const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, t.discount)
      discount = {
        type: t.discount.type,
        value: t.discount.value,
        amount: fromMinorUnits(discountMinorUnits),
        reason: t.discount.reason,
        ...(t.discount.appliedBy ? { appliedBy: formatTitleCase(t.discount.appliedBy) } : {}),
      }
      totalMinorUnits = Math.max(0, rawMinorUnits - discountMinorUnits)
    }

    const totalAmount = fromMinorUnits(totalMinorUnits)

    let splitInfo: PanelTable["splitInfo"] | undefined
    if (t.splitInfo && orderCount > 0) {
      if (t.splitInfo.type === "person" && t.splitInfo.personCount) {
        const perPersonAmount = fromMinorUnits(
          Math.round(totalMinorUnits / t.splitInfo.personCount),
        )
        splitInfo = {
          type: "person",
          personCount: t.splitInfo.personCount,
          perPersonAmount,
          paidShares: t.splitInfo.paidShares ?? [],
        }
      } else if (t.splitInfo.type === "items" && t.splitInfo.amounts) {
        const validAmounts: Record<string, number> = {}
        let selectedMinorUnits = 0
        for (const [itemId, qty] of Object.entries(t.splitInfo.amounts)) {
          const item = billableItems.find((i) => i.id === itemId)
          if (item && qty > 0) {
            const validQty = Math.min(item.quantity, qty)
            validAmounts[itemId] = validQty
            selectedMinorUnits += toMinorUnits(item.price) * validQty
          }
        }
        const validItemIds = Object.keys(validAmounts)
        if (validItemIds.length > 0 && selectedMinorUnits > 0) {
          splitInfo = {
            type: "items",
            itemIds: validItemIds,
            amounts: validAmounts,
            selectedTotal: fromMinorUnits(selectedMinorUnits),
          }
        }
      }
    }

    let status: PanelTableStatus = "empty"
    if (orderCount > 0) {
      if (t.status === "checkout") status = "checkout"
      else if (t.status === "ordering") status = "ordering"
      else status = "occupied"
    }

    return {
      id: t.id,
      name: t.name,
      section: t.section,
      status,
      ...(t.qrToken ? { qrToken: t.qrToken } : {}),
      ...(t.capacity != null ? { capacity: Number(t.capacity) } : {}),
      totalAmount,
      orderCount,
      lastUpdated: lastOrder ? lastOrder.updatedAt : undefined,
      activeOrderId: lastOrder?.id,
      waiter,
      lockedByStaffId: t.sessionStaffId ?? undefined,
      lockedByStaffName: t.sessionStaffName?.trim()
        ? formatTitleCase(t.sessionStaffName)
        : undefined,
      ...(discount ? { discount } : {}),
      ...(splitInfo ? { splitInfo } : {}),
    }
  })
}

export function deriveSectionsFromTables(
  apiTables: { id: string; name: string; section: string }[],
  restaurantId?: string | null,
): PanelSection[] {
  const fromTables = apiTables.map((t) => t.section).filter(Boolean)
  const stored = getStoredCustomSections(restaurantId)
  const names = Array.from(new Set([...fromTables, ...stored]))
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
  hasPin?: boolean
  hasPassword?: boolean
  canAccessPanel?: boolean
  canAccessTerminal?: boolean
  permissions?: string[]
  grantedPermissions?: string[]
  revokedPermissions?: string[]
  maxDiscountPercentOverride?: number | null
  maxDiscountAmountOverride?: number | null
  shiftRestrictionEnabled?: boolean
  shiftStartTime?: string | null
  shiftEndTime?: string | null
  shiftCutoffOffsetMinutes?: number
  effectiveShiftEndTime?: string | null
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  createdAt: string
}): PanelUser {
  return {
    id: s.id,
    name: formatTitleCase(s.name),
    email: s.email ?? undefined,
    phone: s.phone,
    role: s.role || "waiter",
    roleLabel: s.roleLabel,
    roleColor: s.roleColor,
    hasPin: s.hasPin,
    hasPassword: s.hasPassword,
    canAccessPanel: s.canAccessPanel,
    canAccessTerminal: s.canAccessTerminal,
    permissions: s.permissions,
    grantedPermissions: s.grantedPermissions ?? [],
    revokedPermissions: s.revokedPermissions ?? [],
    maxDiscountPercentOverride: s.maxDiscountPercentOverride ?? null,
    maxDiscountAmountOverride: s.maxDiscountAmountOverride ?? null,
    shiftRestrictionEnabled: Boolean(s.shiftRestrictionEnabled),
    shiftStartTime: s.shiftStartTime ?? null,
    shiftEndTime: s.shiftEndTime ?? null,
    shiftCutoffOffsetMinutes: Number(s.shiftCutoffOffsetMinutes ?? 0),
    effectiveShiftEndTime: s.effectiveShiftEndTime ?? null,
    limits: s.limits,
    active: s.isActive,
    createdAt: new Date(s.createdAt),
  }
}
