import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import {
  itemCountsTowardBill,
  itemIsLedgerLike,
  type Campaign,
  type CancelledItem,
  type CashShift,
  type CashTransaction,
  type ClosedTable,
  type InventoryCount,
  type LedgerCustomer,
  type OpenAccount,
  type PanelCategory,
  type PanelNotification,
  type PanelOrder,
  type PanelProduct,
  type PanelSection,
  type PanelTable,
  type PanelUser,
  type PurchaseOrder,
  type StockMaterial,
  type StockMovement,
  type Supplier,
} from "../panel-types"
import {
  api,
  clearToken,
  getBase,
  type CampaignDto,
  type CashTransactionDto,
  type InventoryCountDto,
  type LedgerCustomerDto,
  type OpenAccountDto,
  type OrderDto,
  type PurchaseOrderDto,
  type StockMaterialDto,
  type StockMovementDto,
  type SupplierDto,
} from "../api"
import { computeDiscountMinorUnits, fromMinorUnits, toMinorUnits } from "../format"
import {
  deriveSectionsFromTables,
  mapApiOrdersToPanel,
  mapApiStaffToPanelUser,
  mapApiTablesToPanel,
  mapOrder,
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
import { getReadNotifIds } from "./panel-local-storage"

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
      if (it.status === "cancelled" && !itemIsLedgerLike(it) && !seenCancelIds.has(it.id)) {
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
        if (it.status === "cancelled" && !itemIsLedgerLike(it) && !seenCancelIds.has(it.id)) {
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
  return hydratedCancelled.sort((a, b) => new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime())
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
  const socketRef = useRef<Socket | null>(null)
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

    const updateDerivedNotifications = (mats: StockMaterial[], cancelledList: CancelledItem[]) => {
      if (!setNotifications) return
      const readIds = getReadNotifIds()
      const lowStockNotifs: PanelNotification[] = mats
        .filter((m) => m.currentStock <= m.minStock)
        .map((m) => ({
          id: `notif-stock-${m.id}`,
          type: "stock-low",
          title: "Kritik Stok Uyarısı",
          message: `${m.name} kritik seviyede (${m.currentStock} ${m.unit} / Min: ${m.minStock} ${m.unit})`,
          read: readIds.has(`notif-stock-${m.id}`),
          createdAt: m.lastUpdated,
        }))
      const cancelNotifs: PanelNotification[] = cancelledList.slice(0, 20).map((ci) => ({
        id: `notif-cancel-${ci.id}`,
        type: "kitchen-alert",
        title: "Sipariş İptali",
        message: `${ci.tableName} — ${ci.orderItem.productName} iptal edildi (${ci.reason})`,
        read: readIds.has(`notif-cancel-${ci.id}`),
        createdAt: ci.cancelledAt,
      }))
      setNotifications(
        [...lowStockNotifs, ...cancelNotifs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      )
    }

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
            updateDerivedNotifications(materialsCacheRef.current, hydratedCancelled)
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
          apiTables,
          ordersRes,
          categoriesRes,
          productsRes,
          staffRes,
          currentShiftRes,
          shiftsListRes,
          completedOrdersRes,
          openAccountsRes,
          ledgerCustomersRes,
          campaignsRes,
          materialsRes,
          suppliersRes,
          movementsRes,
          purchaseOrdersRes,
          inventoryCountsRes,
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
        ])
        if (cancelled) return
        const orders = mapApiOrdersToPanel(ordersRes)
        const users = staffRes.map(mapApiStaffToPanelUser)
        usersCacheRef.current = users
        const categories = mapApiCategoriesToPanel(categoriesRes)
        const mats = (materialsRes as StockMaterialDto[]).map(mapStockMaterialDtoToPanel)
        materialsCacheRef.current = mats
        const products = mapApiProductsToPanel(productsRes, mats)
        const tables = mapApiTablesToPanel(apiTables, orders, users)
        const sections = deriveSectionsFromTables(apiTables, restaurantId)
        const shifts = currentShiftRes
          ? [mapShiftDtoToPanel(currentShiftRes), ...shiftsListRes.filter((s) => s.id !== currentShiftRes.id).map(mapShiftDtoToPanel)]
          : shiftsListRes.map(mapShiftDtoToPanel)
        const closed = completedOrdersRes.map(mapCompletedOrderDtoToClosedTable)

        setOrders(orders)
        setCategories(categories)
        setProducts(products)
        setTables((prev) => mergeTablesPreserveClientFields(prev, tables))
        setSections(sections)
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
        updateDerivedNotifications(mats, hydratedCancelled)

        if (setCashTransactions && currentShiftRes?.id) {
          try {
            const cashTxRes = await api.cashTransactions.list(token, currentShiftRes.id)
            if (!cancelled) setCashTransactions((cashTxRes as CashTransactionDto[]).map(mapCashTransactionDtoToPanel))
          } catch (e) {
            console.error("Load cash transactions error:", e)
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
    token,
    restaurantId,
    setTables,
    setOrders,
    setCategories,
    setProducts,
    setSections,
    setUsers,
    setCashShifts,
    setClosedTables,
    setOpenAccounts,
    setLedgerCustomers,
    setStockMaterials,
    setSuppliers,
    setStockMovements,
    setPurchaseOrders,
    setInventoryCounts,
    setCashTransactions,
    setCampaigns,
    setCancelledItems,
    setNotifications,
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

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }
    const baseUrl = getBase()
    const socket = io(baseUrl || undefined, {
      path: "/ws",
      auth: { token, ...(restaurantId ? { restaurantId } : {}) },
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    })
    socketRef.current = socket
    let connectedOnce = false

    const handleConnect = () => {
      if (connectedOnce) void refreshPosRef.current?.()
      connectedOnce = true
    }
    const handleReconnect = () => void refreshPosRef.current?.()

    const handleOrderCreated = (payload: OrderDto) => {
      const mapped = mapOrder(payload)
      const lineMinorUnits = mapped.items.filter(itemCountsTowardBill).reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0)
      setOrders((prev) => (prev.some((o) => o.id === mapped.id) ? prev : [mapped, ...prev]))
      setTables((pt) =>
        pt.map((t) => {
          if (t.id !== mapped.tableId || t.activeOrderId === mapped.id) return t
          const rawMinorUnits = toMinorUnits(t.totalAmount || 0) + toMinorUnits(t.discount?.amount || 0) + lineMinorUnits
          const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, t.discount)
          const nextTotal = fromMinorUnits(Math.max(0, rawMinorUnits - discountMinorUnits))
          return {
            ...t,
            status: t.status === "checkout" ? "checkout" : "occupied",
            totalAmount: nextTotal,
            ...(t.discount ? { discount: { ...t.discount, amount: fromMinorUnits(discountMinorUnits) } } : {}),
            orderCount: t.orderCount + 1,
            lastUpdated: mapped.updatedAt,
            activeOrderId: mapped.id,
            waiter: mapped.userName || t.waiter,
          }
        }),
      )
      void refreshPosRef.current?.()
    }

    const handleOrdersMoved = () => void refreshPosRef.current?.()
    const handleOrdersUpdated = () => void refreshPosRef.current?.()
    const handleTablesPresence = (presenceMap: Record<string, { staffId: string; staffName: string }>) => {
      if (!presenceMap || typeof presenceMap !== "object") return
      setTables((prev) =>
        prev.map((t) => {
          const hit = presenceMap[t.id]
          return { ...t, lockedByStaffId: hit?.staffId, lockedByStaffName: hit?.staffName }
        }),
      )
    }

    const handleAuthExpired = () => clearToken()

    socket.on("connect", handleConnect)
    socket.io.on("reconnect", handleReconnect)
    socket.on("auth:expired", handleAuthExpired)
    socket.on("order:created", handleOrderCreated)
    socket.on("orders:moved", handleOrdersMoved)
    socket.on("orders:updated", handleOrdersUpdated)
    socket.on("tables:presence", handleTablesPresence)

    return () => {
      socket.off("connect", handleConnect)
      socket.io.off("reconnect", handleReconnect)
      socket.off("auth:expired", handleAuthExpired)
      socket.off("order:created", handleOrderCreated)
      socket.off("orders:moved", handleOrdersMoved)
      socket.off("orders:updated", handleOrdersUpdated)
      socket.off("tables:presence", handleTablesPresence)
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, restaurantId, setOrders, setTables])
}
