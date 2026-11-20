import { useEffect, useRef } from "react"
import type {
  Campaign,
  CancelledItem,
  CashShift,
  CashTransaction,
  ClosedTable,
  InventoryCount,
  LedgerCustomer,
  OpenAccount,
  PanelCategory,
  PanelNotification,
  PanelOrder,
  PanelProduct,
  PanelSection,
  PanelTable,
  PanelUser,
  PurchaseOrder,
  StockMaterial,
  StockMovement,
  Supplier,
} from "../panel-types"
import {
  api,
  type CampaignDto,
  type CashTransactionDto,
  type InventoryCountDto,
  type LedgerCustomerDto,
  type OpenAccountDto,
  type PurchaseOrderDto,
  type StockMaterialDto,
  type StockMovementDto,
  type SupplierDto,
} from "../api"
import {
  deriveSectionsFromTables,
  mapApiOrdersToPanel,
  mapApiStaffToPanelUser,
  mapApiTablesToPanel,
  mergeTablesPreserveClientFields,
} from "../mappers/orders-tables.mapper"
import {
  mapCashTransactionDtoToPanel,
  mapCompletedOrderDtoToClosedTable,
  mapLedgerCustomerDtoToPanel,
  mapOpenAccountDtoToPanel,
  mapShiftDtoToPanel,
} from "../mappers/billing.mapper"
import {
  mapApiCategoriesToPanel,
  mapApiProductsToPanel,
  mapCampaignDtoToPanel,
  mapInventoryCountDtoToPanel,
  mapPurchaseOrderDtoToPanel,
  mapStockMaterialDtoToPanel,
  mapStockMovementDtoToPanel,
  mapSupplierDtoToPanel,
} from "../mappers/catalog-inventory.mapper"
import {
  getDismissedNotifIds,
  getNotifsClearedAt,
  getReadNotifIds,
  saveDismissedNotifIds,
  saveNotifsClearedAt,
} from "./panel-local-storage"
import { usePanelSocket } from "./use-panel-socket"
import { formatTitleCase } from "../format"

function buildHydratedCancelledItems(
  orders: PanelOrder[],
  tables: PanelTable[],
  closed: ClosedTable[],
): CancelledItem[] {
  const hydratedCancelled: CancelledItem[] = []
  const seenCancelIds = new Set<string>()
  for (const o of orders) {
    const tName = tables.find((t) => t.id === o.tableId)?.name || o.tableId
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

function syncServerNotificationState(
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

function buildDerivedNotifications(
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

function mergeDerivedAndRealtimeNotifications(
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

export function usePanelApiSync(
  token: string | null,
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void,
  setOrders: (v: PanelOrder[] | ((prev: PanelOrder[]) => PanelOrder[])) => void,
  setCategories: (v: PanelCategory[] | ((prev: PanelCategory[]) => PanelCategory[])) => void,
  setProducts: (v: PanelProduct[] | ((prev: PanelProduct[]) => PanelProduct[])) => void,
  setSections: (v: PanelSection[] | ((prev: PanelSection[]) => PanelSection[])) => void,
  setUsers: (v: PanelUser[] | ((prev: PanelUser[]) => PanelUser[])) => void,
  setCashShifts: (v: CashShift[] | ((prev: CashShift[]) => CashShift[])) => void,
  setClosedTables: (v: ClosedTable[] | ((prev: ClosedTable[]) => ClosedTable[])) => void,
  setStockMaterials?: (v: StockMaterial[] | ((prev: StockMaterial[]) => StockMaterial[])) => void,
  setSuppliers?: (v: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void,
  setStockMovements?: (v: StockMovement[] | ((prev: StockMovement[]) => StockMovement[])) => void,
  setPurchaseOrders?: (v: PurchaseOrder[] | ((prev: PurchaseOrder[]) => PurchaseOrder[])) => void,
  setInventoryCounts?: (v: InventoryCount[] | ((prev: InventoryCount[]) => InventoryCount[])) => void,
  setCashTransactions?: (v: CashTransaction[] | ((prev: CashTransaction[]) => CashTransaction[])) => void,
  setOpenAccounts?: (v: OpenAccount[] | ((prev: OpenAccount[]) => OpenAccount[])) => void,
  setCampaigns?: (v: Campaign[] | ((prev: Campaign[]) => Campaign[])) => void,
  setLedgerCustomers?: (v: LedgerCustomer[] | ((prev: LedgerCustomer[]) => LedgerCustomer[])) => void,
  setCancelledItems?: (v: CancelledItem[] | ((prev: CancelledItem[]) => CancelledItem[])) => void,
  setNotifications?: (v: PanelNotification[] | ((prev: PanelNotification[]) => PanelNotification[])) => void,
  restaurantId?: string | null,
) {
  const loadRef = useRef<() => Promise<void>>(null!)
  const refreshPosRef = useRef<() => Promise<void>>(null!)
  const usersCacheRef = useRef<PanelUser[]>([])
  const materialsCacheRef = useRef<StockMaterial[]>([])
  const inFlightFullRef = useRef(false)
  const inFlightPosRef = useRef(false)
  const pendingPosRef = useRef(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const refreshPos = async () => {
      if (inFlightPosRef.current) {
        pendingPosRef.current = true
        return
      }
      inFlightPosRef.current = true
      try {
        const [apiTables, ordersRes, currentShiftRes, completedOrdersRes, openAccountsRes, ledgerCustomersRes] =
          await Promise.all([
            api.tables.list(token).catch(() => null),
            api.orders.list(token).catch(() => null),
            api.shifts.getCurrent(token).catch(() => null),
            api.completedOrders.list(token, { limit: 500 }).catch(() => null),
            api.openAccounts.list(token).catch(() => null),
            api.ledgerCustomers.list(token).catch(() => null),
          ])
        if (cancelled) return

        const nextOrders = ordersRes ? mapApiOrdersToPanel(ordersRes) : null
        if (nextOrders) setOrders(nextOrders)

        if (apiTables && nextOrders) {
          const mappedTables = mapApiTablesToPanel(apiTables, nextOrders, usersCacheRef.current)
          setTables((prev) => mergeTablesPreserveClientFields(prev, mappedTables))
          setSections(deriveSectionsFromTables(apiTables, restaurantId))

          if (completedOrdersRes) {
            const closed = completedOrdersRes.map(mapCompletedOrderDtoToClosedTable)
            setClosedTables(closed)
            const hydratedCancelled = buildHydratedCancelledItems(nextOrders, mappedTables, closed)
            setCancelledItems?.(hydratedCancelled)
            const derived = buildDerivedNotifications(
              materialsCacheRef.current,
              hydratedCancelled,
              undefined,
              undefined,
              restaurantId,
            )
            setNotifications?.((prev) => mergeDerivedAndRealtimeNotifications(prev, derived, restaurantId))
          }
        }

        if (currentShiftRes) {
          const mappedShift = mapShiftDtoToPanel(currentShiftRes)
          setCashShifts((prev) =>
            prev.some((s) => s.id === mappedShift.id)
              ? prev.map((s) => (s.id === mappedShift.id ? mappedShift : s))
              : [mappedShift, ...prev],
          )
          if (setCashTransactions) {
            const cashTxRes = await api.cashTransactions.list(token, currentShiftRes.id).catch(() => null)
            if (!cancelled && cashTxRes) setCashTransactions(cashTxRes.map(mapCashTransactionDtoToPanel))
          }
        }

        if (openAccountsRes) setOpenAccounts?.(openAccountsRes.map(mapOpenAccountDtoToPanel))
        if (ledgerCustomersRes) setLedgerCustomers?.(ledgerCustomersRes.map(mapLedgerCustomerDtoToPanel))
      } catch (e) {
        console.error("Panel POS refresh error:", e)
      } finally {
        inFlightPosRef.current = false
        if (pendingPosRef.current && !cancelled) {
          pendingPosRef.current = false
          void refreshPos()
        }
      }
    }

    const load = async () => {
      if (inFlightFullRef.current) return
      inFlightFullRef.current = true
      try {
        const [
          apiTables, ordersRes, categoriesRes, productsRes, staffRes,
          currentShiftRes, shiftsListRes, completedOrdersRes, openAccountsRes,
          ledgerCustomersRes, campaignsRes, materialsRes, suppliersRes,
          movementsRes, purchaseOrdersRes, inventoryCountsRes, notifStateRes,
        ] = await Promise.all([
          api.tables.list(token).catch(() => []),
          api.orders.list(token).catch(() => []),
          api.categories.list(token).catch(() => []),
          api.products.list(token).catch(() => []),
          api.staff.list(token).catch(() => []),
          api.shifts.getCurrent(token).catch(() => null),
          api.shifts.list(token).catch(() => []),
          api.completedOrders.list(token, { limit: 500 }).catch(() => []),
          api.openAccounts.list(token).catch(() => []),
          api.ledgerCustomers.list(token).catch(() => [] as LedgerCustomerDto[]),
          api.campaigns.list(token).catch(() => []),
          api.stock.materials.list(token).catch(() => []),
          api.stock.suppliers.list(token).catch(() => [] as SupplierDto[]),
          api.stock.movements.list(token, 200).catch(() => []),
          api.stock.purchaseOrders.list(token).catch(() => []),
          api.stock.inventoryCounts.list(token).catch(() => []),
          api.notifications.getState(token).catch(() => null),
        ])
        if (cancelled) return
        syncServerNotificationState(notifStateRes, restaurantId)
        const orders = mapApiOrdersToPanel(ordersRes)
        const users = staffRes.map(mapApiStaffToPanelUser)
        usersCacheRef.current = users
        const mats = (materialsRes as StockMaterialDto[]).map(mapStockMaterialDtoToPanel)
        materialsCacheRef.current = mats
        const tables = mapApiTablesToPanel(apiTables, orders, users)
        const shifts = currentShiftRes
          ? [mapShiftDtoToPanel(currentShiftRes), ...shiftsListRes.filter((s) => s.id !== currentShiftRes.id).map(mapShiftDtoToPanel)]
          : shiftsListRes.map(mapShiftDtoToPanel)
        const closed = completedOrdersRes.map(mapCompletedOrderDtoToClosedTable)

        setOrders(orders)
        setCategories(mapApiCategoriesToPanel(categoriesRes))
        setProducts(mapApiProductsToPanel(productsRes, mats))
        setTables((prev) => mergeTablesPreserveClientFields(prev, tables))
        setSections(deriveSectionsFromTables(apiTables, restaurantId))
        setUsers(users)
        setCashShifts(shifts)
        setClosedTables(closed)
        setStockMaterials?.(mats)
        setSuppliers?.((suppliersRes as SupplierDto[]).map(mapSupplierDtoToPanel))
        setStockMovements?.((movementsRes as StockMovementDto[]).map(mapStockMovementDtoToPanel))
        setPurchaseOrders?.((purchaseOrdersRes as PurchaseOrderDto[]).map(mapPurchaseOrderDtoToPanel))
        setInventoryCounts?.((inventoryCountsRes as InventoryCountDto[]).map(mapInventoryCountDtoToPanel))
        setOpenAccounts?.((openAccountsRes as OpenAccountDto[]).map(mapOpenAccountDtoToPanel))
        setLedgerCustomers?.((ledgerCustomersRes as LedgerCustomerDto[]).map(mapLedgerCustomerDtoToPanel))
        setCampaigns?.((campaignsRes as CampaignDto[]).map(mapCampaignDtoToPanel))

        const hydratedCancelled = buildHydratedCancelledItems(orders, tables, closed)
        setCancelledItems?.(hydratedCancelled)
        const derived = buildDerivedNotifications(
          mats,
          hydratedCancelled,
          notifStateRes?.waiterCalls,
          notifStateRes?.platformNotifications,
          restaurantId,
        )
        setNotifications?.((prev) => mergeDerivedAndRealtimeNotifications(prev, derived, restaurantId))

        if (setCashTransactions && currentShiftRes?.id) {
          const cashTxRes = await api.cashTransactions.list(token, currentShiftRes.id).catch(() => null)
          if (!cancelled && cashTxRes) {
            setCashTransactions((cashTxRes as CashTransactionDto[]).map(mapCashTransactionDtoToPanel))
          }
        } else if (setCashTransactions && !currentShiftRes) {
          setCashTransactions([])
        }
      } catch (e) {
        console.error("Panel API load error:", e)
      } finally {
        inFlightFullRef.current = false
      }
    }

    loadRef.current = load
    refreshPosRef.current = refreshPos
    void load()
    return () => {
      cancelled = true
    }
  }, [
    token, restaurantId, setTables, setOrders, setCategories, setProducts,
    setSections, setUsers, setCashShifts, setClosedTables, setOpenAccounts,
    setLedgerCustomers, setStockMaterials, setSuppliers, setStockMovements,
    setPurchaseOrders, setInventoryCounts, setCashTransactions, setCampaigns,
    setCancelledItems, setNotifications,
  ])

  useEffect(() => {
    if (!token) return
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshPosRef.current?.()
    }
    const onOnline = () => void loadRef.current?.()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("online", onOnline)
    }
  }, [token, restaurantId])

  usePanelSocket({
    token,
    restaurantId,
    refreshPosRef,
    setOrders,
    setTables,
    setNotifications,
  })
}
