import type {
  CancelledItem,
  ClosedTable,
  PanelNotification,
  PanelOrder,
  PanelTable,
  StockMaterial,
} from "../panel-types"
import {
  getDismissedNotifIds,
  getNotifsClearedAt,
  getReadNotifIds,
  saveDismissedNotifIds,
  saveNotifsClearedAt,
} from "./panel-local-storage"
import { formatTitleCase } from "../format"

export function buildHydratedCancelledItems(
  orders: PanelOrder[],
  tables: PanelTable[],
  closed: ClosedTable[],
): CancelledItem[] {
  const hydratedCancelled: CancelledItem[] = []
  const seenCancelIds = new Set<string>()
  const tableNameById = new Map(tables.map((t) => [t.id, t.name]))
  for (const o of orders) {
    const tName = tableNameById.get(o.tableId) || o.tableId
    for (const it of o.items) {
      if (it.status === "cancelled" && !seenCancelIds.has(it.id)) {
        seenCancelIds.add(it.id)
        hydratedCancelled.push({
          id: `ci-${it.id}`,
          orderItem: it,
          tableName: tName,
          orderId: o.id,
          reason: it.cancelReason || "İptal",
          cancelledBy: it.cancelledBy || o.userName || "Sistem",
          cancelledAt: it.cancelledAt || o.updatedAt,
        })
      }
    }
  }
  for (const ct of closed) {
    for (const o of ct.orders) {
      for (const it of o.items) {
        if (it.status === "cancelled" && !seenCancelIds.has(it.id)) {
          seenCancelIds.add(it.id)
          hydratedCancelled.push({
            id: `ci-${it.id}`,
            orderItem: it,
            tableName: ct.tableName,
            orderId: o.id,
            reason: it.cancelReason || "İptal",
            cancelledBy: it.cancelledBy || ct.closedBy || "Sistem",
            cancelledAt: it.cancelledAt || ct.closedAt,
          })
        }
      }
    }
  }
  return hydratedCancelled.sort(
    (a, b) => new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime(),
  )
}

export function syncServerNotificationState(
  state?: {
    clearedAt: string | null
    dismissedIds: string[]
    waiterCalls?: Array<{
      id: string
      tableId: string
      tableName: string
      sectionName?: string
      requestType?: string
      note?: string
      createdAt: string
    }>
  } | null,
  restaurantId?: string | null,
): void {
  if (!state) return
  if (Array.isArray(state.dismissedIds) && state.dismissedIds.length > 0) {
    const merged = getDismissedNotifIds(restaurantId)
    state.dismissedIds.forEach((id) => merged.add(id))
    saveDismissedNotifIds(merged, restaurantId)
  }
  if (state.clearedAt) {
    const localCleared = getNotifsClearedAt(restaurantId)
    if (
      !localCleared ||
      new Date(state.clearedAt).getTime() > new Date(localCleared).getTime()
    ) {
      saveNotifsClearedAt(state.clearedAt, restaurantId)
    }
  }
  const latestUpdate = (state as { latestSystemUpdate?: { id?: string } | null })
    .latestSystemUpdate
  if (latestUpdate?.id && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("corder:system-update", { detail: latestUpdate }))
  }
}

export function buildDerivedNotifications(
  mats: StockMaterial[],
  cancelledList: CancelledItem[],
  serverWaiterCalls?: Array<{
    id: string
    tableId: string
    tableName: string
    sectionName?: string
    requestType?: string
    note?: string
    createdAt: string
  }>,
  serverPlatformNotifications?: Array<{
    id: string
    title: string
    message: string
    level: string
    targetApps: string[]
    sentAt: string
    createdAt: string
  }>,
  restaurantId?: string | null,
): PanelNotification[] {
  const readIds = getReadNotifIds(restaurantId)
  const dismissedIds = getDismissedNotifIds(restaurantId)
  const clearedAtIso = getNotifsClearedAt(restaurantId)
  const clearedAtMs = clearedAtIso ? new Date(clearedAtIso).getTime() : 0

  const isVisible = (id: string, createdAt: Date) => {
    if (dismissedIds.has(id)) return false
    const t = new Date(createdAt).getTime()
    if (clearedAtMs > 0 && Number.isFinite(t) && t <= clearedAtMs) return false
    return true
  }

  const platformNotifs: PanelNotification[] = (serverPlatformNotifications ?? [])
    .filter((pn) => !Array.isArray(pn.targetApps) || pn.targetApps.includes("merchant"))
    .map((pn) => {
      const notifId = `platform:${pn.id}`
      return {
        id: notifId,
        type: "system" as const,
        title: `📢 ${pn.title}`,
        message: pn.message,
        read: readIds.has(notifId) || readIds.has(pn.id),
        createdAt: new Date(pn.sentAt || pn.createdAt),
      }
    })

  const waiterNotifs: PanelNotification[] = (serverWaiterCalls ?? []).map((wc) => {
    const isBill = wc.requestType === "bill"
    const tName = formatTitleCase(wc.tableName) || "Masa"
    const section = wc.sectionName ? formatTitleCase(wc.sectionName) : "Salon"
    return {
      id: wc.id,
      type: "waiter-call" as const,
      title: `🔔 ${tName} (${section}) - ${isBill ? "Hesap İstiyor!" : "Garson Çağırıyor!"}`,
      message: wc.note ? `Not: ${wc.note}` : `${tName} masasından ${isBill ? "hesap talebi" : "garson çağrısı"} geldi.`,
      read: readIds.has(wc.id),
      createdAt: new Date(wc.createdAt),
    }
  })

  const lowStockNotifs: PanelNotification[] = mats
    .filter((m) => m.currentStock <= m.minStock)
    .map((m) => ({
      id: `notif-stock-${m.id}`,
      type: "stock-low" as const,
      title: "Kritik Stok Uyarısı",
      message: `${m.name} kritik seviyede (${m.currentStock} ${m.unit} / Min: ${m.minStock} ${m.unit})`,
      read: readIds.has(`notif-stock-${m.id}`),
      createdAt: m.lastUpdated,
    }))
  const cancelNotifs: PanelNotification[] = cancelledList.slice(0, 20).map((ci) => ({
    id: `notif-cancel-${ci.id}`,
    type: "kitchen-alert" as const,
    title: "Sipariş İptali",
    message: `${ci.tableName} - ${ci.orderItem.productName} iptal edildi (${ci.reason})`,
    read: readIds.has(`notif-cancel-${ci.id}`),
    createdAt: ci.cancelledAt,
  }))
  return [...platformNotifs, ...waiterNotifs, ...lowStockNotifs, ...cancelNotifs]
    .filter((n) => isVisible(n.id, n.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function mergeDerivedAndRealtimeNotifications(
  prev: PanelNotification[],
  derived: PanelNotification[],
  restaurantId?: string | null,
): PanelNotification[] {
  const dismissedIds = getDismissedNotifIds(restaurantId)
  const clearedAtIso = getNotifsClearedAt(restaurantId)
  const clearedAtMs = clearedAtIso ? new Date(clearedAtIso).getTime() : 0
  const map = new Map<string, PanelNotification>()
  for (const n of derived) {
    map.set(n.id, n)
  }
  for (const p of prev) {
    if (dismissedIds.has(p.id)) continue
    const t = new Date(p.createdAt).getTime()
    if (clearedAtMs > 0 && Number.isFinite(t) && t <= clearedAtMs) continue
    if (!map.has(p.id) && (p.type === "waiter-call" || p.type === "fraud-alert" || p.type === "system")) {
      map.set(p.id, p)
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
