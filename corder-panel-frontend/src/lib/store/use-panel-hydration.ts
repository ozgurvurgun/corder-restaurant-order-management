import { useEffect, useRef } from "react"
import {
  itemCountsTowardBill,
  type AuditLog, type Campaign, type CashShift, type CashTransaction, type ClosedTable,
  type InventoryCount, type LedgerCustomer, type OpenAccount, type PanelCategory,
  type PanelOrder, type PanelProduct, type PanelSection, type PanelTable, type PanelUser,
  type PrinterConfig, type PurchaseOrder, type RestaurantSettings, type StockMaterial,
  type StockMovement, type Supplier,
} from "../panel-types"
import {
  api, getBase, getSessionUser,
  type AuditLogDto, type CampaignDto, type CashTransactionDto, type InventoryCountDto,
  type LedgerCustomerDto, type OpenAccountDto, type OrderDto, type PrinterConfigDto,
  type PurchaseOrderDto, type StockMaterialDto, type StockMovementDto, type SupplierDto,
} from "../api"
import {
  deriveSectionsFromTables, mapApiOrdersToPanel, mapApiStaffToPanelUser,
  mapApiTablesToPanel, mapOrder, mergeTablesPreserveClientFields, resolveStaffNameForTable,
} from "../mappers/orders-tables.mapper"
import {
  mapCashTransactionDtoToPanel, mapCompletedOrderDtoToClosedTable,
  mapLedgerCustomerDtoToPanel, mapOpenAccountDtoToPanel, mapShiftDtoToPanel,
} from "../mappers/billing.mapper"
import {
  mapApiCategoriesToPanel, mapApiProductsToPanel, mapCampaignDtoToPanel,
  mapInventoryCountDtoToPanel, mapPurchaseOrderDtoToPanel,
  mapStockMaterialDtoToPanel, mapStockMovementDtoToPanel, mapSupplierDtoToPanel,
} from "../mappers/catalog-inventory.mapper"
import { DEFAULT_SETTINGS } from "./panel-local-storage"

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
) {
  const socketRef = useRef<{ disconnect: () => void } | null>(null)
  const loadRef = useRef<() => Promise<void>>(null!)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const load = async () => {
      try {
        const [
          apiTables, ordersRes, categoriesRes, productsRes, staffRes,
          currentShiftRes, shiftsListRes, completedOrdersRes, openAccountsRes,
          ledgerCustomersRes, campaignsRes, materialsRes, suppliersRes,
          movementsRes, purchaseOrdersRes, inventoryCountsRes,
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
        const categories = mapApiCategoriesToPanel(categoriesRes)
        const mats = (materialsRes as StockMaterialDto[]).map(mapStockMaterialDtoToPanel)
        const products = mapApiProductsToPanel(productsRes, mats)
        const tables = mapApiTablesToPanel(apiTables, orders, users)
        const sections = deriveSectionsFromTables(apiTables)
        const shifts = currentShiftRes
          ? [mapShiftDtoToPanel(currentShiftRes), ...shiftsListRes.filter((s) => s.id !== currentShiftRes.id).map(mapShiftDtoToPanel)]
          : shiftsListRes.map(mapShiftDtoToPanel)

        setOrders(orders)
        setCategories(categories)
        setProducts(products)
        setTables((prev) => mergeTablesPreserveClientFields(prev, tables))
        setSections(sections)
        setUsers(users)
        setCashShifts(shifts)
        setClosedTables(completedOrdersRes.map(mapCompletedOrderDtoToClosedTable))
        setStockMaterials?.(mats)
        setSuppliers?.((suppliersRes as SupplierDto[]).map(mapSupplierDtoToPanel))
        setStockMovements?.((movementsRes as StockMovementDto[]).map(mapStockMovementDtoToPanel))
        setPurchaseOrders?.((purchaseOrdersRes as PurchaseOrderDto[]).map(mapPurchaseOrderDtoToPanel))
        setInventoryCounts?.((inventoryCountsRes as InventoryCountDto[]).map(mapInventoryCountDtoToPanel))
        setOpenAccounts?.((openAccountsRes as OpenAccountDto[]).map(mapOpenAccountDtoToPanel))
        setLedgerCustomers?.((ledgerCustomersRes as LedgerCustomerDto[]).map(mapLedgerCustomerDtoToPanel))
        setCampaigns?.((campaignsRes as CampaignDto[]).map(mapCampaignDtoToPanel))

        if (setCashTransactions && currentShiftRes?.id) {
          try {
            const cashTxRes = await api.cashTransactions.list(token, currentShiftRes.id)
            setCashTransactions((cashTxRes as CashTransactionDto[]).map(mapCashTransactionDtoToPanel))
          } catch (e) { console.error("Load cash transactions error:", e) }
        }
      } catch (e) { console.error("Panel API load error:", e) }
    }
    loadRef.current = load
    void load()
    return () => { cancelled = true }
  }, [
    token, setTables, setOrders, setCategories, setProducts, setSections, setUsers,
    setCashShifts, setClosedTables, setOpenAccounts, setLedgerCustomers,
    setStockMaterials, setSuppliers, setStockMovements, setPurchaseOrders,
    setInventoryCounts, setCashTransactions, setCampaigns,
  ])

  useEffect(() => {
    if (!token) return
    const onVis = () => { if (document.visibilityState === "visible") void loadRef.current?.() }
    const onOnline = () => void loadRef.current?.()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("online", onOnline)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }
    const baseUrl = getBase()
    if (!baseUrl) return
    let cancelled = false
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return
      const socket = io(baseUrl, { path: "/ws", auth: { token }, transports: ["websocket", "polling"], reconnectionAttempts: Infinity, reconnectionDelayMax: 10000, timeout: 20000 })
      socketRef.current = socket
      socket.on("order:created", (payload: OrderDto) => {
        const mapped = mapOrder(payload)
        setOrders((prev) => {
          if (prev.some((o) => o.id === mapped.id)) return prev
          const lineTotal = mapped.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0)
          setTables((pt) => pt.map((t) => (t.id === mapped.tableId ? { ...t, status: "occupied" as const, totalAmount: (t.totalAmount || 0) + lineTotal, orderCount: t.orderCount + 1, lastUpdated: mapped.updatedAt, activeOrderId: mapped.id } : t)))
          return [mapped, ...prev]
        })
      })
      socket.on("orders:moved", () => void loadRef.current?.())
      socket.on("orders:updated", () => void loadRef.current?.())
      socket.on("reconnect", () => void loadRef.current?.())
    })
    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [token, setOrders, setTables])
}

export function usePanelHydration(params: {
  token: string | null
  orders: PanelOrder[]
  users: PanelUser[]
  setCurrentUser: (u: PanelUser | null) => void
  setSettings: (v: RestaurantSettings | ((prev: RestaurantSettings) => RestaurantSettings)) => void
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
  setAuditLogs: (v: AuditLog[]) => void
  setPrinters: (v: PrinterConfig[]) => void
}) {
  const { token, orders, users, setCurrentUser, setSettings, setTables, setAuditLogs, setPrinters } = params

  useEffect(() => {
    if (!token) { setCurrentUser(null); return }
    const su = getSessionUser()
    if (su) setCurrentUser({ id: su.id, name: su.name, email: su.email, role: su.role as PanelUser["role"], active: true, createdAt: new Date(0) })
  }, [token, setCurrentUser])

  useEffect(() => {
    if (!token) return
    setTables((prev) => prev.map((t) => ({ ...t, waiter: resolveStaffNameForTable(t.id, orders, users) })))
  }, [token, orders, users, setTables])

  useEffect(() => {
    if (!token) { setSettings(DEFAULT_SETTINGS); return }
    api.restaurant.getSettings(token).then((s) => {
      setSettings((prev) => ({
        ...prev,
        name: s.name ?? prev.name, address: s.address ?? prev.address, phone: s.phone ?? prev.phone,
        taxId: s.taxId ?? prev.taxId, whatsapp: s.whatsapp ?? prev.whatsapp, instagram: s.instagram ?? prev.instagram,
        facebook: s.facebook ?? prev.facebook, website: s.website ?? prev.website, workingHours: s.workingHours ?? prev.workingHours,
      }))
    }).catch(console.error)
  }, [token, setSettings])

  useEffect(() => {
    if (!token) return
    void Promise.all([
      api.technical.listAuditLogs(token, { limit: 1000 }).catch(() => [] as AuditLogDto[]),
      api.technical.listPrinters(token).catch(() => [] as PrinterConfigDto[]),
    ]).then(([logs, prs]) => {
      setAuditLogs(logs.map((l) => ({ id: l.id, userId: l.userId, userName: l.userName, action: l.action, category: l.category as AuditLog["category"], details: l.details, metadata: l.metadata ?? undefined, createdAt: new Date(l.createdAt) })))
      setPrinters(prs.map((p) => ({ id: p.id, name: p.name, type: p.type, connection: p.connection, ipAddress: p.ipAddress ?? undefined, port: p.port ?? undefined, department: p.department ?? undefined, status: p.status, paperWidth: p.paperWidth === 58 ? 58 : 80, autoCut: p.autoCut })))
    }).catch(console.error)
  }, [token, setAuditLogs, setPrinters])
}
