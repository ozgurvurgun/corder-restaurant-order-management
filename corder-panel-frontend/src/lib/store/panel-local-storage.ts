import {
  itemCountsTowardBill,
  type CancelledItem,
  type ClosedTable,
  type DailyReport,
  type RestaurantSettings,
} from "../panel-types"

let idCounter = 200

export function genId(prefix: string): string {
  return `${prefix}-${++idCounter}`
}

export const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "",
  currency: "TRY",
  currencySymbol: "₺",
  fontSize: "medium",
  tableCardSize: "normal",
  showProductImages: true,
  sidebarCollapsed: false,
  quickActionsEnabled: true,
}

export function computeDailyReport(
  closedTables: ClosedTable[],
  cancelledItems: CancelledItem[],
): DailyReport {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todaysClosed = closedTables.filter(
    (ct) => new Date(ct.closedAt) >= today,
  )
  const todaysCancelled = cancelledItems.filter(
    (ci) => new Date(ci.cancelledAt) >= today,
  )

  const totalRevenue = todaysClosed.reduce(
    (s, ct) => s + (ct.netAmount || 0),
    0,
  )
  const totalOrders = todaysClosed.reduce(
    (s, ct) => s + (ct.orders?.length || 0),
    0,
  )
  const totalTables = todaysClosed.length

  const cancelledAmount = todaysCancelled.reduce(
    (s, ci) => s + ci.orderItem.price * ci.orderItem.quantity,
    0,
  )
  const discountAmount = todaysClosed.reduce(
    (s, ct) => s + (ct.discountAmount || 0),
    0,
  )

  const paymentMap = new Map<
    string,
    { method: string; total: number; count: number }
  >()
  todaysClosed.forEach((ct) => {
    const m = ct.payment?.method || "unknown"
    const prev = paymentMap.get(m) || { method: m, total: 0, count: 0 }
    prev.total += ct.netAmount || 0
    prev.count += 1
    paymentMap.set(m, prev)
  })
  const paymentBreakdown = Array.from(paymentMap.values())

  const productMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >()
  todaysClosed.forEach((ct) => {
    ct.orders?.forEach((o) => {
      o.items.filter(itemCountsTowardBill).forEach((i) => {
        const prev = productMap.get(i.productName) || {
          name: i.productName,
          quantity: 0,
          revenue: 0,
        }
        prev.quantity += i.quantity
        prev.revenue += i.price * i.quantity
        productMap.set(i.productName, prev)
      })
    })
  })
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const waiterMap = new Map<
    string,
    { name: string; tables: number; revenue: number; orders: number }
  >()
  todaysClosed.forEach((ct) => {
    const name = ct.waiter || "Bilinmiyor"
    const prev = waiterMap.get(name) || {
      name,
      tables: 0,
      revenue: 0,
      orders: 0,
    }
    prev.tables += 1
    prev.revenue += ct.netAmount || 0
    prev.orders += ct.orders?.length || 0
    waiterMap.set(name, prev)
  })
  const waiterPerformance = Array.from(waiterMap.values()).sort(
    (a, b) => b.revenue - a.revenue,
  )

  const hourlyBuckets: {
    [hour: string]: { hour: string; revenue: number; orders: number }
  } = {}
  todaysClosed.forEach((ct) => {
    const d = new Date(ct.closedAt)
    const h = d.getHours().toString().padStart(2, "0") + ":00"
    if (!hourlyBuckets[h]) {
      hourlyBuckets[h] = { hour: h, revenue: 0, orders: 0 }
    }
    hourlyBuckets[h].revenue += ct.netAmount || 0
    hourlyBuckets[h].orders += ct.orders?.length || 0
  })
  const hourlyRevenue = Object.values(hourlyBuckets).sort((a, b) =>
    a.hour.localeCompare(b.hour),
  )

  return {
    date: today.toISOString().slice(0, 10),
    totalRevenue,
    totalOrders,
    totalTables,
    cancelledItems: todaysCancelled,
    cancelledAmount,
    discountAmount,
    paymentBreakdown,
    topProducts,
    waiterPerformance,
    hourlyRevenue,
  }
}
