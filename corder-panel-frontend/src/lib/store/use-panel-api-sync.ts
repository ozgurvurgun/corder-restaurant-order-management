import { useEffect, useRef } from "react"
import type {
  AuditLog,
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
  type AuditLogDto,
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
  buildDerivedNotifications,
  buildHydratedCancelledItems,
  mergeDerivedAndRealtimeNotifications,
  syncServerNotificationState,
} from "./panel-notification-sync.helper"
import { formatTitleCase } from "../format"
import { usePanelSocket } from "./use-panel-socket"

function mapAuditLogDtos(logs: AuditLogDto[]): AuditLog[] {
  return logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: formatTitleCase(l.userName),
    action: l.action,
    category: l.category as AuditLog["category"],
    details: l.details,
    metadata: l.metadata ?? undefined,
    createdAt: new Date(l.createdAt),
  }))
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
  setAuditLogs?: (v: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => void,
) {
  const loadRef = useRef<() => Promise<void>>(null!)
  const refreshPosRef = useRef<() => Promise<void>>(null!)
  const refreshActivePosRef = useRef<() => Promise<void>>(null!)
  const usersCacheRef = useRef<PanelUser[]>([])
  const materialsCacheRef = useRef<StockMaterial[]>([])
  const closedCacheByIdRef = useRef<Map<string, { sig: string; mapped: ClosedTable }>>(new Map())
  const inFlightFullRef = useRef(false)
  const inFlightPosRef = useRef(false)
  const pendingPosRef = useRef(false)
  const inFlightActiveRef = useRef(false)
  const pendingActiveRef = useRef(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const mapCompletedOrdersCached = (list: Parameters<typeof mapCompletedOrderDtoToClosedTable>[0][]) => {
      const nextMap = new Map<string, { sig: string; mapped: ClosedTable }>()
      const out = list.map((dto) => {
        const editCount = Array.isArray(dto.editHistory) ? dto.editHistory.length : 0
        const sig = `${dto.closedAt}|${dto.netAmount}|${dto.totalAmount}|${dto.paymentMethod}|${editCount}`
        const hit = closedCacheByIdRef.current.get(dto.id)
        if (hit && hit.sig === sig) {
          nextMap.set(dto.id, hit)
          return hit.mapped
        }
        const mapped = mapCompletedOrderDtoToClosedTable(dto)
        nextMap.set(dto.id, { sig, mapped })
        return mapped
      })
      closedCacheByIdRef.current = nextMap
      return out
    }

    const refreshActivePos = async () => {
      if (inFlightActiveRef.current) {
        pendingActiveRef.current = true
        return
      }
      inFlightActiveRef.current = true
      try {
        const [apiTables, ordersRes] = await Promise.all([
          api.tables.list(token).catch(() => null),
          api.orders.list(token).catch(() => null),
        ])
        if (cancelled) return
        const nextOrders = ordersRes ? mapApiOrdersToPanel(ordersRes) : null
        if (nextOrders) setOrders(nextOrders)
        if (apiTables && nextOrders) {
          const mappedTables = mapApiTablesToPanel(apiTables, nextOrders, usersCacheRef.current)
          setTables((prev) => mergeTablesPreserveClientFields(prev, mappedTables))
          setSections(deriveSectionsFromTables(apiTables, restaurantId))
        }
      } catch (e) {
        console.error("Panel active POS refresh error:", e)
      } finally {
        inFlightActiveRef.current = false
        if (pendingActiveRef.current && !cancelled) {
          pendingActiveRef.current = false
          void refreshActivePos()
        }
      }
    }

    const refreshPos = async () => {
      if (inFlightPosRef.current) {
        pendingPosRef.current = true
        return
      }
      inFlightPosRef.current = true
      try {
        const [
          apiTables,
          ordersRes,
          currentShiftRes,
          shiftsListRes,
          completedOrdersRes,
          openAccountsRes,
          ledgerCustomersRes,
          cashTxRes,
          auditLogsRes,
        ] = await Promise.all([
          api.tables.list(token).catch(() => null),
          api.orders.list(token).catch(() => null),
          api.shifts.getCurrent(token).catch(() => null),
          api.shifts.list(token).catch(() => null),
          api.completedOrders.list(token, { limit: 500 }).catch(() => null),
          api.openAccounts.list(token).catch(() => null),
          api.ledgerCustomers.list(token).catch(() => null),
          setCashTransactions ? api.cashTransactions.list(token, undefined, { limit: 500 }).catch(() => null) : Promise.resolve(null),
          setAuditLogs ? api.technical.listAuditLogs(token, { limit: 1000 }).catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return

        const nextOrders = ordersRes ? mapApiOrdersToPanel(ordersRes) : null
        if (nextOrders) setOrders(nextOrders)

        if (apiTables && nextOrders) {
          const mappedTables = mapApiTablesToPanel(apiTables, nextOrders, usersCacheRef.current)
          setTables((prev) => mergeTablesPreserveClientFields(prev, mappedTables))
          setSections(deriveSectionsFromTables(apiTables, restaurantId))

          if (completedOrdersRes) {
            const closed = mapCompletedOrdersCached(completedOrdersRes)
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

        if (shiftsListRes) {
          const shifts = currentShiftRes
            ? [
                mapShiftDtoToPanel(currentShiftRes),
                ...shiftsListRes
                  .filter((s) => s.id !== currentShiftRes.id)
                  .map(mapShiftDtoToPanel),
              ]
            : shiftsListRes.map(mapShiftDtoToPanel)
          setCashShifts(shifts)
        } else if (currentShiftRes) {
          const mappedShift = mapShiftDtoToPanel(currentShiftRes)
          setCashShifts((prev) =>
            prev.some((s) => s.id === mappedShift.id)
              ? prev.map((s) => (s.id === mappedShift.id ? mappedShift : s))
              : [mappedShift, ...prev],
          )
        }
        if (setCashTransactions && cashTxRes) {
          setCashTransactions(cashTxRes.map(mapCashTransactionDtoToPanel))
        }
        if (setAuditLogs && auditLogsRes) {
          setAuditLogs(mapAuditLogDtos(auditLogsRes))
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
        const closed = mapCompletedOrdersCached(completedOrdersRes)

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

        if (setCashTransactions) {
          const cashTxRes = await api.cashTransactions.list(token, undefined, { limit: 500 }).catch(() => null)
          if (!cancelled && cashTxRes) {
            setCashTransactions((cashTxRes as CashTransactionDto[]).map(mapCashTransactionDtoToPanel))
          }
        }
      } catch (e) {
        console.error("Panel API load error:", e)
      } finally {
        inFlightFullRef.current = false
      }
    }

    loadRef.current = load
    refreshPosRef.current = refreshPos
    refreshActivePosRef.current = refreshActivePos
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
    refreshActivePosRef,
    setOrders,
    setTables,
    setNotifications,
  })
}
