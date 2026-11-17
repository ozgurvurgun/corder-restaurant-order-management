import { useMemo, useState, type ReactNode } from "react"
import type {
  AuditLog,
  Branch,
  Campaign,
  CancelledItem,
  CashShift,
  CashTransaction,
  ClosedTable,
  HourlyDensity,
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
  PeriodReport,
  PrinterConfig,
  PrinterDepartment,
  ProductTrend,
  PurchaseOrder,
  RestaurantSettings,
  StockMaterial,
  StockMovement,
  Supplier,
} from "./panel-types"
import { usePanelAuth } from "./panel-auth"
import {
  PanelContext,
  usePanelStore,
  type PanelContextType,
  type PanelStoreContextType,
  type PanelStore,
} from "./store/panel-store-context"
import {
  computeDailyReport,
  DEFAULT_SETTINGS,
} from "./store/panel-local-storage"
import {
  usePanelApiSync,
  usePanelHydration,
} from "./store/use-panel-hydration"
import { useSystemActions } from "./store/use-system-actions"
import { useBillingActions } from "./store/use-billing-actions"
import { useTableOrderActions } from "./store/use-table-order-actions"
import { useCatalogActions } from "./store/use-catalog-actions"
import { useInventoryActions } from "./store/use-inventory-actions"

export { usePanelStore, type PanelStore, type PanelContextType, type PanelStoreContextType }

export function PanelProvider({ children }: { children: ReactNode }) {
  const { token, currentBusiness, switchBusiness, hasPermission } = usePanelAuth()
  const restaurantId = currentBusiness?.id ?? null

  const [currentUser, setCurrentUser] = useState<PanelUser | null>(null)
  const [users, setUsers] = useState<PanelUser[]>([])
  const [sections, setSections] = useState<PanelSection[]>([])
  const [categories, setCategories] = useState<PanelCategory[]>([])
  const [products, setProducts] = useState<PanelProduct[]>([])
  const [tables, setTables] = useState<PanelTable[]>([])
  const [orders, setOrders] = useState<PanelOrder[]>([])
  const [closedTables, setClosedTables] = useState<ClosedTable[]>([])
  const [cancelledItems, setCancelledItems] = useState<CancelledItem[]>([])
  const [settings, setSettings] =
    useState<RestaurantSettings>(DEFAULT_SETTINGS)
  const [cashShifts, setCashShifts] = useState<CashShift[]>([])

  // Stock
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCount[]>([])

  // Cash register
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(
    [],
  )
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([])
  const [ledgerCustomers, setLedgerCustomers] = useState<LedgerCustomer[]>([])

  // Notifications & Audit
  const [notifications, setNotifications] = useState<PanelNotification[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Multi-branch & Printers
  const [branches, setBranches] = useState<Branch[]>([])
  const [printers, setPrinters] = useState<PrinterConfig[]>([])
  const [printerDepartments, setPrinterDepartments] = useState<
    PrinterDepartment[]
  >([])

  // Advanced Reports
  const [periodReports] = useState<PeriodReport[]>([])
  const [productTrends] = useState<ProductTrend[]>([])
  const [hourlyDensity] = useState<HourlyDensity[]>([])

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  usePanelHydration({
    token,
    restaurantId,
    orders,
    users,
    setCurrentUser,
    setSettings,
    setTables,
    setAuditLogs,
    setPrinters,
  })

  usePanelApiSync(
    token,
    setTables,
    setOrders,
    setCategories,
    setProducts,
    setSections,
    setUsers,
    setCashShifts,
    setClosedTables,
    setStockMaterials,
    setSuppliers,
    setStockMovements,
    setPurchaseOrders,
    setInventoryCounts,
    setCashTransactions,
    setOpenAccounts,
    setCampaigns,
    setLedgerCustomers,
    setCancelledItems,
    setNotifications,
    restaurantId,
  )

  const currentShift = cashShifts.find((s) => s.status === "open") || null

  const dailyReport = useMemo(
    () => computeDailyReport(closedTables, cancelledItems),
    [closedTables, cancelledItems],
  )

  const systemActions = useSystemActions({
    token,
    currentUser,
    printers,
    setUsers,
    setSettings,
    setNotifications,
    setAuditLogs,
    setBranches,
    setPrinters,
    setPrinterDepartments,
    switchBusiness,
  })

  const billingActions = useBillingActions({
    token,
    currentUser,
    currentShift,
    ledgerCustomers,
    setCashShifts,
    setCashTransactions,
    setClosedTables,
    setStockMovements,
    setStockMaterials,
    setOpenAccounts,
    setLedgerCustomers,
    logActivity: systemActions.logActivity,
  })

  const tableOrderActions = useTableOrderActions({
    token,
    restaurantId,
    currentUser,
    currentShift,
    tables,
    orders,
    users,
    sections,
    setTables,
    setOrders,
    setSections,
    setCancelledItems,
    applyCloseCheckResult: billingActions.applyCloseCheckResult,
    ledgerRefresh: billingActions.ledgerRefresh,
    logActivity: systemActions.logActivity,
    addAuditLog: systemActions.addAuditLog,
  })

  const catalogActions = useCatalogActions({
    token,
    stockMaterials,
    setCategories,
    setProducts,
    setCampaigns,
    logActivity: systemActions.logActivity,
  })

  const inventoryActions = useInventoryActions({
    token,
    stockMaterials,
    purchaseOrders,
    setStockMaterials,
    setSuppliers,
    setStockMovements,
    setPurchaseOrders,
    setInventoryCounts,
    setProducts,
    logActivity: systemActions.logActivity,
  })

  return (
    <PanelContext.Provider
      value={{
        currentUser,
        users,
        sections,
        categories,
        products,
        tables,
        orders,
        closedTables,
        cancelledItems,
        dailyReport,
        settings,
        stockMaterials,
        suppliers,
        stockMovements,
        purchaseOrders,
        inventoryCounts,
        cashShifts,
        cashTransactions,
        openAccounts,
        ledgerCustomers,
        currentShift,
        notifications,
        auditLogs,
        branches,
        printers,
        printerDepartments,
        periodReports,
        productTrends,
        hourlyDensity,
        campaigns,
        setCurrentUser,
        hasPermission,
        ...tableOrderActions,
        ...billingActions,
        ...catalogActions,
        ...inventoryActions,
        ...systemActions,
      }}
    >
      {children}
    </PanelContext.Provider>
  )
}

export const PanelStoreProvider = PanelProvider
