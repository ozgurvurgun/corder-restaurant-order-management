import {
  itemCountsTowardBill,
  type CancelledItem,
  type ClosedTable,
  type DailyReport,
  type RestaurantSettings,
} from "../panel-types"
import { getRestaurant } from "../api/http-client"
import {
  endOfIstanbulDay,
  fromMinorUnits,
  getIstanbulHour,
  getIstanbulYmd,
  startOfIstanbulDay,
  toMinorUnits,
} from "../format"

let idCounter = 200

export function genId(prefix: string): string {
  return `${prefix}-${++idCounter}`
}

const CUSTOM_SECTIONS_KEY_PREFIX = "corder-panel-custom-sections"
const APPEARANCE_KEY = "corder-panel-appearance"
const READ_NOTIFS_KEY = "corder-panel-read-notifs"
const DISMISSED_NOTIFS_KEY = "corder-panel-dismissed-notifs"
const NOTIFS_CLEARED_AT_KEY = "corder-panel-notifs-cleared-at"

function resolveScopedStorageKey(prefix: string, restaurantId?: string | null): string {
  const id = (restaurantId || getRestaurant()?.id || "").trim()
  return id ? `${prefix}:${id}` : prefix
}

function resolveCustomSectionsKey(restaurantId?: string | null): string {
  return resolveScopedStorageKey(CUSTOM_SECTIONS_KEY_PREFIX, restaurantId)
}

export function getStoredCustomSections(restaurantId?: string | null): string[] {
  try {
    const key = resolveCustomSectionsKey(restaurantId)
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : []
  } catch {
    return []
  }
}

export function setStoredCustomSections(
  names: string[],
  restaurantId?: string | null,
): void {
  try {
    const key = resolveCustomSectionsKey(restaurantId)
    const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
    localStorage.setItem(key, JSON.stringify(unique))
  } catch {}
}

export function loadAppearanceSettings(): Partial<RestaurantSettings> {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<RestaurantSettings>
  } catch {
    return {}
  }
}

export function saveAppearanceSettings(s: Partial<RestaurantSettings>): void {
  try {
    const current = loadAppearanceSettings()
    const next: Partial<RestaurantSettings> = { ...current }
    if (s.fontSize !== undefined) next.fontSize = s.fontSize
    if (s.tableCardSize !== undefined) next.tableCardSize = s.tableCardSize
    if (s.showProductImages !== undefined) next.showProductImages = s.showProductImages
    if (s.quickActionsEnabled !== undefined) next.quickActionsEnabled = s.quickActionsEnabled
    if (s.sidebarCollapsed !== undefined) next.sidebarCollapsed = s.sidebarCollapsed
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next))
  } catch {}
}

export function getReadNotifIds(restaurantId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(resolveScopedStorageKey(READ_NOTIFS_KEY, restaurantId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [],
    )
  } catch {
    return new Set()
  }
}

export function saveReadNotifIds(ids: Iterable<string>, restaurantId?: string | null): void {
  try {
    localStorage.setItem(
      resolveScopedStorageKey(READ_NOTIFS_KEY, restaurantId),
      JSON.stringify(Array.from(new Set(ids))),
    )
  } catch {}
}

export function getDismissedNotifIds(restaurantId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(resolveScopedStorageKey(DISMISSED_NOTIFS_KEY, restaurantId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [],
    )
  } catch {
    return new Set()
  }
}

export function saveDismissedNotifIds(ids: Iterable<string>, restaurantId?: string | null): void {
  try {
    localStorage.setItem(
      resolveScopedStorageKey(DISMISSED_NOTIFS_KEY, restaurantId),
      JSON.stringify(Array.from(new Set(ids))),
    )
  } catch {}
}

export function getNotifsClearedAt(restaurantId?: string | null): string | null {
  try {
    const raw = localStorage.getItem(resolveScopedStorageKey(NOTIFS_CLEARED_AT_KEY, restaurantId))
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

export function saveNotifsClearedAt(isoTimestamp: string | null, restaurantId?: string | null): void {
  try {
    const key = resolveScopedStorageKey(NOTIFS_CLEARED_AT_KEY, restaurantId)
    if (!isoTimestamp) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, isoTimestamp)
    }
  } catch {}
}

export const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "",
  currency: "TRY",
  currencySymbol: "₺",
  menuTemplate: "classic",
  fontSize: "medium",
  tableCardSize: "normal",
  showProductImages: true,
  sidebarCollapsed: false,
  quickActionsEnabled: true,
  ...loadAppearanceSettings(),
}

export function computeReportForClosedTables(
  closedTables: ClosedTable[],
  cancelledItems: CancelledItem[],
  dateLabel: string = getIstanbulYmd(),
): DailyReport {
  const totalRevenueMinorUnits = closedTables.reduce(
    (s, ct) => s + toMinorUnits(ct.netAmount),
    0,
  )
  const totalOrders = closedTables.reduce(
    (s, ct) => s + (ct.orders?.length || 0),
    0,
  )
  const totalTables = closedTables.length

  const cancelledMinorUnits = cancelledItems.reduce(
    (s, ci) => s + toMinorUnits(ci.orderItem.price) * ci.orderItem.quantity,
    0,
  )
  const discountMinorUnits = closedTables.reduce(
    (s, ct) => s + toMinorUnits(ct.discountAmount),
    0,
  )

  const paymentMap = new Map<
    string,
    { method: string; totalMinorUnits: number; count: number }
  >()
  closedTables.forEach((ct) => {
    const m = ct.payment?.method || "unknown"
    if (m === "split" && ct.payment?.splitDetails?.length) {
      for (const sd of ct.payment.splitDetails) {
        const subMethod = sd.method || "unknown"
        const shareMinorUnits = toMinorUnits(sd.amount)
        if (shareMinorUnits <= 0) continue
        const prev = paymentMap.get(subMethod) || {
          method: subMethod,
          totalMinorUnits: 0,
          count: 0,
        }
        prev.totalMinorUnits += shareMinorUnits
        prev.count += 1
        paymentMap.set(subMethod, prev)
      }
      return
    }
    const prev = paymentMap.get(m) || { method: m, totalMinorUnits: 0, count: 0 }
    prev.totalMinorUnits += toMinorUnits(ct.netAmount)
    prev.count += 1
    paymentMap.set(m, prev)
  })
  const paymentBreakdown = Array.from(paymentMap.values()).map((p) => ({
    method: p.method,
    total: fromMinorUnits(p.totalMinorUnits),
    count: p.count,
  }))

  const productMap = new Map<
    string,
    { name: string; quantity: number; revenueMinorUnits: number }
  >()
  closedTables.forEach((ct) => {
    ct.orders?.forEach((o) => {
      o.items.filter(itemCountsTowardBill).forEach((i) => {
        const prev = productMap.get(i.productName) || {
          name: i.productName,
          quantity: 0,
          revenueMinorUnits: 0,
        }
        prev.quantity += i.quantity
        prev.revenueMinorUnits += toMinorUnits(i.price) * i.quantity
        productMap.set(i.productName, prev)
      })
    })
  })
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenueMinorUnits - a.revenueMinorUnits)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      quantity: p.quantity,
      revenue: fromMinorUnits(p.revenueMinorUnits),
    }))

  const waiterMap = new Map<
    string,
    { name: string; tables: number; revenueMinorUnits: number; orders: number }
  >()
  closedTables.forEach((ct) => {
    const displayName = (ct.waiter || "Bilinmiyor").trim() || "Bilinmiyor"
    const key = displayName.toLocaleLowerCase("tr-TR")
    const prev = waiterMap.get(key) || {
      name: displayName,
      tables: 0,
      revenueMinorUnits: 0,
      orders: 0,
    }
    prev.tables += 1
    prev.revenueMinorUnits += toMinorUnits(ct.netAmount)
    prev.orders += ct.orders?.length || 0
    waiterMap.set(key, prev)
  })
  const waiterPerformance = Array.from(waiterMap.values())
    .sort((a, b) => b.revenueMinorUnits - a.revenueMinorUnits)
    .map((w) => ({
      name: w.name,
      tables: w.tables,
      revenue: fromMinorUnits(w.revenueMinorUnits),
      orders: w.orders,
    }))

  const hourlyBuckets: {
    [hour: string]: { hour: string; revenueMinorUnits: number; orders: number }
  } = {}
  closedTables.forEach((ct) => {
    const h = String(getIstanbulHour(ct.closedAt)).padStart(2, "0") + ":00"
    if (!hourlyBuckets[h]) {
      hourlyBuckets[h] = { hour: h, revenueMinorUnits: 0, orders: 0 }
    }
    hourlyBuckets[h].revenueMinorUnits += toMinorUnits(ct.netAmount)
    hourlyBuckets[h].orders += ct.orders?.length || 0
  })
  const hourlyRevenue = Object.values(hourlyBuckets)
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .map((hb) => ({
      hour: hb.hour,
      revenue: fromMinorUnits(hb.revenueMinorUnits),
      orders: hb.orders,
    }))

  return {
    date: dateLabel,
    totalRevenue: fromMinorUnits(totalRevenueMinorUnits),
    totalOrders,
    totalTables,
    cancelledItems,
    cancelledAmount: fromMinorUnits(cancelledMinorUnits),
    discountAmount: fromMinorUnits(discountMinorUnits),
    paymentBreakdown,
    topProducts,
    waiterPerformance,
    hourlyRevenue,
  }
}

export function computeDailyReport(
  closedTables: ClosedTable[],
  cancelledItems: CancelledItem[],
): DailyReport {
  const todayYmd = getIstanbulYmd()
  const startToday = startOfIstanbulDay(todayYmd)
  const endToday = endOfIstanbulDay(todayYmd)

  const todaysClosed = closedTables.filter((ct) => {
    const d = new Date(ct.closedAt)
    return d >= startToday && d <= endToday
  })
  const todaysCancelled = cancelledItems.filter((ci) => {
    const d = new Date(ci.cancelledAt)
    return d >= startToday && d <= endToday
  })

  return computeReportForClosedTables(todaysClosed, todaysCancelled, todayYmd)
}
