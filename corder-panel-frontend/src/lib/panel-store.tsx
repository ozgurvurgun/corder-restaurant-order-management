import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react"
import {
  itemCountsTowardBill,
  type PanelUser,
  type PanelCategory,
  type PanelProduct,
  type PanelTable,
  type PanelSection,
  type PanelOrder,
  type Payment,
  type ClosedTable,
  type CancelledItem,
  type DailyReport,
  type RestaurantSettings,
  type PaymentMethod,
  type StockMaterial,
  type Supplier,
  type StockMovement,
  type PurchaseOrder,
  type InventoryCount,
  type CashShift,
  type CashTransaction,
  type OpenAccount,
  type OpenAccountCreateLine,
  type LedgerCustomer,
  type PanelNotification,
  type AuditLog,
  type Branch,
  type PrinterConfig,
  type BackupRecord,
  type PeriodReport,
  type ProductTrend,
  type HourlyDensity,
  type Campaign,
  type PrinterDepartment,
} from "./panel-types"
import { usePanelAuth } from "./panel-auth"
import {
  usePanelApiSync,
  mapApiProductsToPanel,
  mapApiCategoriesToPanel,
  mapShiftDtoToPanel,
  mapCompletedOrderDtoToClosedTable,
  mapOpenAccountDtoToPanel,
  resolveStaffNameForTable,
} from "./panel-api-sync"
import {
  api,
  getSessionUser,
  type CompletedOrderUpdateBody,
  type AuditLogDto,
  type BackupRecordDto,
  type PrinterConfigDto,
} from "./api"

let _idCounter = 200
function genId(prefix: string) { return `${prefix}-${++_idCounter}` }

type StockMovementInput = Omit<StockMovement, "id" | "createdAt" | "previousStock" | "newStock">

/** Stock deduction by product recipe; same materials aggregated into one line; API awaited in sequence (prevents races). */
async function runDeductStockForOrder(
  orderItems: { productId: string; quantity: number }[],
  products: PanelProduct[],
  stockMaterials: StockMaterial[],
  addStockMovement: (m: StockMovementInput) => Promise<void>,
) {
  const byMaterial = new Map<
    string,
    { materialId: string; materialName: string; quantity: number; labels: string[] }
  >()
  for (const item of orderItems) {
    const product = products.find((p) => p.id === item.productId)
    if (!product?.ingredients?.length) continue
    const ings = product.ingredients
    for (const ing of ings) {
      const totalDeduct = ing.quantity * item.quantity
      if (totalDeduct <= 0) continue
      const material = stockMaterials.find((m) => m.id === ing.materialId)
      if (!material) continue
      const name = ing.materialName || material.name
      const prev = byMaterial.get(ing.materialId)
      const label = `${product.name} x${item.quantity}`
      if (prev) {
        prev.quantity += totalDeduct
        prev.labels.push(label)
      } else {
        byMaterial.set(ing.materialId, {
          materialId: ing.materialId,
          materialName: name,
          quantity: totalDeduct,
          labels: [label],
        })
      }
    }
  }
  for (const row of byMaterial.values()) {
    const uniq = [...new Set(row.labels)]
    const reason =
      uniq.length === 1 ? `Siparis: ${uniq[0]}` : `Siparis: ${uniq.join(", ")}`
    await addStockMovement({
      materialId: row.materialId,
      materialName: row.materialName,
      type: "out",
      quantity: row.quantity,
      unitCost: undefined,
      totalCost: undefined,
      supplierId: undefined,
      reason,
      createdBy: "Sistem",
    })
  }
}

const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "",
  currency: "TRY",
  currencySymbol: "₺",
  fontSize: "medium",
  tableCardSize: "normal",
  showProductImages: true,
  sidebarCollapsed: false,
  quickActionsEnabled: true,
}

interface PanelContextType {
  // Core data
  currentUser: PanelUser | null
  users: PanelUser[]
  sections: PanelSection[]
  categories: PanelCategory[]
  products: PanelProduct[]
  tables: PanelTable[]
  orders: PanelOrder[]
  closedTables: ClosedTable[]
  cancelledItems: CancelledItem[]
  dailyReport: DailyReport
  settings: RestaurantSettings

  // Stock
  stockMaterials: StockMaterial[]
  suppliers: Supplier[]
  stockMovements: StockMovement[]
  purchaseOrders: PurchaseOrder[]
  inventoryCounts: InventoryCount[]

  // Cash register
  cashShifts: CashShift[]
  cashTransactions: CashTransaction[]
  openAccounts: OpenAccount[]
  ledgerCustomers: LedgerCustomer[]
  currentShift: CashShift | null

  // Notifications & Audit
  notifications: PanelNotification[]
  auditLogs: AuditLog[]

  // Multi-branch & Printers
  branches: Branch[]
  printers: PrinterConfig[]
  backups: BackupRecord[]

  // Advanced Reports
  periodReports: PeriodReport[]
  productTrends: ProductTrend[]
  hourlyDensity: HourlyDensity[]

  // Campaigns
  campaigns: Campaign[]

  // Auth
  setCurrentUser: (u: PanelUser) => void

  // Table
  getTableOrders: (tableId: string) => PanelOrder[]
  getTableTotal: (tableId: string) => number
  moveTable: (fromId: string, toId: string) => Promise<boolean>
  /** Opens selected lines as a new check on another table (API + mergedFrom). */
  moveOrderItems: (fromTableId: string, toTableId: string, itemIds: string[]) => Promise<boolean>

  // Payment & close
  closeTableWithPayment: (
    tableId: string,
    method: PaymentMethod,
    discount?: { type: "percent" | "amount"; value: number; reason: string },
    splitDetails?: { method: string; amount: number }[],
    opts?: { ledgerCustomerId?: string; ledgerDebtAmount?: number },
  ) => Promise<boolean>
  
  // Quick Sale (Walk-in)
  addQuickSale: (items: { productId: string; name: string; price: number; quantity: number }[], paymentMethod: PaymentMethod) => string | null

  /** Creates a new active check on the table (same API as terminal). */
  createTableOrder: (
    tableId: string,
    items: { productId: string; productName: string; price: number; quantity: number; note?: string }[],
  ) => Promise<{ ok: boolean; error?: string }>

  // Cancel
  cancelOrderItem: (orderId: string, itemId: string, reason: string) => void

  /** Posts selected check lines as ledger debt (API; items leave the check). */
  assignItemsToLedger: (
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
  ) => Promise<{ ok: boolean; amount?: number }>

  /** Returns a ledger-assigned line back to the check (API). */
  revertLedgerOrderItem: (itemId: string) => Promise<{ ok: boolean; amount?: number }>

  // Products CRUD
  addProduct: (p: Omit<PanelProduct, "id">) => void
  updateProduct: (id: string, data: Partial<PanelProduct>) => void
  deleteProduct: (id: string) => void

  // Category CRUD
  addCategory: (
    name: string,
    opts?: { showInTerminal?: boolean; showInMenu?: boolean; parentId?: string | null },
  ) => void
  updateCategory: (id: string, data: Partial<PanelCategory>) => void
  deleteCategory: (id: string) => void

  // Users CRUD
  addUser: (u: Omit<PanelUser, "id" | "createdAt">) => void
  updateUser: (id: string, data: Partial<PanelUser>) => void
  deleteUser: (id: string) => void

  // Sections CRUD
  addSection: (name: string) => void
  updateSection: (id: string, name: string) => void
  deleteSection: (id: string) => void

  // Table CRUD
  addTable: (name: string, section: string) => void
  deleteTable: (id: string) => void

  // Settings
  updateSettings: (s: Partial<RestaurantSettings>) => void

  /** Table: `tableId`. Single check (with notes): `{ orderId }`. Walk-in sale: `{ tableName, items, total, ... }`. */
  reprintReceipt: (
    target:
      | string
      | { orderId: string }
      | {
          tableName: string
          waiterName?: string
          items: { productName: string; quantity: number; price: number; note?: string; productId?: string; categoryId?: string }[]
          total: number
        },
  ) => Promise<void>

  /** Completed check correction (API + register cash delta). Root JWT only. */
  updateCompletedOrder: (
    completedId: string,
    body: CompletedOrderUpdateBody,
    meta: { previousNet: number; previousMethod: PaymentMethod },
  ) => Promise<ClosedTable | null>

  // Stock actions
  addMaterial: (m: Omit<StockMaterial, "id" | "lastUpdated">) => void
  updateMaterial: (id: string, data: Partial<StockMaterial>) => void
  deleteMaterial: (id: string) => void
  addStockMovement: (m: StockMovementInput) => Promise<void>
  setProductIngredients: (productId: string, ingredients: { materialId: string; quantity: number }[]) => void
  deductStockForOrder: (orderItems: { productId: string; quantity: number }[]) => Promise<void>
  addSupplier: (s: Omit<Supplier, "id">) => Promise<boolean>
  updateSupplier: (id: string, data: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  addPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "createdAt">) => void
  updatePurchaseOrder: (id: string, data: Partial<PurchaseOrder>) => void
  receivePurchaseOrder: (id: string) => void
  startInventoryCount: () => void
  updateInventoryItem: (countId: string, materialId: string, actual: number) => void
  completeInventoryCount: (countId: string) => void

  // Cash register actions
  openShift: (openingBalance: number) => void | Promise<void>
  closeShift: (closingBalance: number, notes?: string) => void | Promise<void>
  addCashTransaction: (t: Omit<CashTransaction, "id" | "createdAt" | "shiftId">) => Promise<void> | void

  // Open Accounts
  addOpenAccount: (
    a: Omit<OpenAccount, "id" | "createdAt" | "status" | "paidAt" | "items" | "payments"> & { items?: OpenAccountCreateLine[] },
  ) => void
  payOpenAccount: (id: string, amount: number) => void

  ledgerRefresh: () => Promise<void>
  createLedgerCustomer: (body: { name: string; phone?: string; notes?: string }) => Promise<LedgerCustomer | null>
  addLedgerPayment: (customerId: string, amount: number) => Promise<boolean>

  // Notifications
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  addNotification: (n: Omit<PanelNotification, "id" | "createdAt" | "read">) => void

  // Audit
  addAuditLog: (log: Omit<AuditLog, "id" | "createdAt">) => void

  // Branches
  switchBranch: (id: string) => void
  addBranch: (b: Omit<Branch, "id">) => void
  updateBranch: (id: string, data: Partial<Branch>) => void

  // Printers
  addPrinter: (p: Omit<PrinterConfig, "id">) => void
  updatePrinter: (id: string, data: Partial<PrinterConfig>) => void
  deletePrinter: (id: string) => void
  testPrinter: (id: string) => void
  
  // Printer Departments
  printerDepartments: PrinterDepartment[]
  addPrinterDepartment: (pd: Omit<PrinterDepartment, "id">) => void
  updatePrinterDepartment: (id: string, data: Partial<PrinterDepartment>) => void
  deletePrinterDepartment: (id: string) => void

  // Backups
  createBackup: () => void
  
  // Discount
  applyDiscount: (tableId: string, discount: { type: "percent" | "amount" | "ikram"; value: number; reason: string }) => void
  clearDiscount: (tableId: string) => void
  
  // Split Bill
  splitBillByPerson: (tableId: string, personCount: number) => void
  splitBillByItems: (tableId: string, itemIds: string[], amounts: Record<string, number>) => void
  
  // Clear Notifications
  clearAllNotifications: () => void

  // Campaigns
  addCampaign: (c: Omit<Campaign, "id" | "createdAt" | "order">) => void
  updateCampaign: (id: string, data: Partial<Campaign>) => void
  deleteCampaign: (id: string) => void
  reorderCampaigns: (ids: string[]) => void

  // Menu ordering
  reorderCategories: (ids: string[], parentId?: string | null) => void
  reorderProducts: (ids: string[]) => void
}

const PanelContext = createContext<PanelContextType | null>(null)

export function usePanelStore() {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error("usePanelStore must be used within PanelProvider")
  return ctx
}

export function PanelProvider({ children }: { children: ReactNode }) {
  const { token } = usePanelAuth()

  const [currentUser, setCurrentUser] = useState<PanelUser | null>(null)
  const [users, setUsers] = useState<PanelUser[]>([])
  const [sections, setSections] = useState<PanelSection[]>([])
  const [categories, setCategories] = useState<PanelCategory[]>([])
  const [products, setProducts] = useState<PanelProduct[]>([])
  const [tables, setTables] = useState<PanelTable[]>([])
  const [orders, setOrders] = useState<PanelOrder[]>([])
  const [closedTables, setClosedTables] = useState<ClosedTable[]>([])
  const [cancelledItems, setCancelledItems] = useState<CancelledItem[]>([])
  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT_SETTINGS)
  const [cashShifts, setCashShifts] = useState<CashShift[]>([])

  // ---- Stock ----
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([])
  const addStockMovementRef = useRef<((m: StockMovementInput) => Promise<void>) | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCount[]>([])

  // ---- Cash register ----
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([])
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([])
  const [ledgerCustomers, setLedgerCustomers] = useState<LedgerCustomer[]>([])

  // ---- Notifications & Audit ----
  const [notifications, setNotifications] = useState<PanelNotification[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // ---- Multi-branch & Printers ----
  const [branches, setBranches] = useState<Branch[]>([])
  const [printers, setPrinters] = useState<PrinterConfig[]>([])
  const [printerDepartments, setPrinterDepartments] = useState<PrinterDepartment[]>([])
  const [backups, setBackups] = useState<BackupRecord[]>([])

  // ---- Advanced Reports ----
  const [periodReports] = useState<PeriodReport[]>([])
  const [productTrends] = useState<ProductTrend[]>([])
  const [hourlyDensity] = useState<HourlyDensity[]>([])

  // ---- Campaigns ----
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      return
    }
    const su = getSessionUser()
    if (su) {
      setCurrentUser({
        id: su.id,
        name: su.name,
        email: su.email,
        role: su.role as PanelUser["role"],
        active: true,
        createdAt: new Date(0),
      })
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        waiter: resolveStaffNameForTable(t.id, orders, users),
      })),
    )
  }, [token, orders, users])

  // Load restaurant settings from backend
  useEffect(() => {
    if (!token) {
      setSettings(DEFAULT_SETTINGS)
      return
    }
    api.restaurant.getSettings(token)
      .then((s) => {
        setSettings((prev) => ({
          ...prev,
          name: s.name ?? prev.name,
          address: s.address ?? prev.address,
          phone: s.phone ?? prev.phone,
          taxId: s.taxId ?? prev.taxId,
          whatsapp: s.whatsapp ?? prev.whatsapp,
          instagram: s.instagram ?? prev.instagram,
          facebook: s.facebook ?? prev.facebook,
          website: s.website ?? prev.website,
          workingHours: s.workingHours ?? prev.workingHours,
        }))
      })
      .catch(console.error)
  }, [token])

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
  )

  const addAuditLog = useCallback((log: Omit<AuditLog, "id" | "createdAt">) => {
    setAuditLogs((prev) => [{ ...log, id: genId("al"), createdAt: new Date() }, ...prev].slice(0, 1000))
    if (!token) return
    api.technical.createAuditLog(token, {
      action: log.action,
      category: log.category,
      details: log.details,
      metadata: log.metadata,
      userId: log.userId,
      userName: log.userName,
    }).catch(console.error)
  }, [token])

  const logActivity = useCallback((entry: {
    action: string
    category: AuditLog["category"]
    details: string
    metadata?: Record<string, unknown>
  }) => {
    addAuditLog({
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "Sistem",
      action: entry.action,
      category: entry.category,
      details: entry.details,
      metadata: entry.metadata,
    })
  }, [addAuditLog, currentUser?.id, currentUser?.name])

  useEffect(() => {
    if (!token) return
    void Promise.all([
      api.technical.listAuditLogs(token, { limit: 1000 }).catch(() => [] as AuditLogDto[]),
      api.technical.listBackups(token).catch(() => [] as BackupRecordDto[]),
      api.technical.listPrinters(token).catch(() => [] as PrinterConfigDto[]),
    ]).then(([logs, bks, prs]) => {
      setAuditLogs(
        logs.map((l) => ({
          id: l.id,
          userId: l.userId,
          userName: l.userName,
          action: l.action,
          category: l.category as AuditLog["category"],
          details: l.details,
          metadata: l.metadata ?? undefined,
          createdAt: new Date(l.createdAt),
        })),
      )
      setBackups(
        bks.map((b) => ({
          id: b.id,
          type: b.type,
          size: b.size,
          createdAt: new Date(b.createdAt),
          status: b.status,
          notes: b.notes ?? undefined,
        })),
      )
      setPrinters(
        prs.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          connection: p.connection,
          ipAddress: p.ipAddress ?? undefined,
          port: p.port ?? undefined,
          department: p.department ?? undefined,
          status: p.status,
          paperWidth: p.paperWidth === 58 ? 58 : 80,
          autoCut: p.autoCut,
        })),
      )
    }).catch(console.error)
  }, [token])

  const ledgerRefresh = useCallback(async () => {
    if (!token) return
    try {
      const list = await api.ledgerCustomers.list(token)
      setLedgerCustomers(
        list.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? undefined,
          notes: c.notes ?? undefined,
          balance: Number(c.balance),
          createdAt: new Date(c.createdAt),
        })),
      )
    } catch (e) {
      console.error("ledgerRefresh", e)
    }
  }, [token])

  const createLedgerCustomer = useCallback(
    async (body: { name: string; phone?: string; notes?: string }): Promise<LedgerCustomer | null> => {
      const name = body.name.trim()
      if (!name) return null
      if (!token) {
        const local: LedgerCustomer = {
          id: genId("lc"),
          name,
          phone: body.phone?.trim() || undefined,
          notes: body.notes?.trim() || undefined,
          balance: 0,
          createdAt: new Date(),
        }
        setLedgerCustomers((prev) => [...prev, local].sort((a, b) => a.name.localeCompare(b.name, "tr")))
        return local
      }
      try {
        const c = await api.ledgerCustomers.create(token, {
          name,
          phone: body.phone?.trim(),
          notes: body.notes?.trim(),
        })
        const mapped: LedgerCustomer = {
          id: c.id,
          name: c.name,
          phone: c.phone ?? undefined,
          notes: c.notes ?? undefined,
          balance: Number(c.balance),
          createdAt: new Date(c.createdAt),
        }
        setLedgerCustomers((prev) =>
          [...prev.filter((x) => x.id !== mapped.id), mapped].sort((a, b) => a.name.localeCompare(b.name, "tr")),
        )
        logActivity({
          action: "ledger_customer_created",
          category: "payment",
          details: `Cari hesap olusturuldu: ${mapped.name}`,
          metadata: { customerId: mapped.id, name: mapped.name, phone: mapped.phone },
        })
        return mapped
      } catch {
        return null
      }
    },
    [token, logActivity],
  )

  const addLedgerPayment = useCallback(
    async (customerId: string, amount: number): Promise<boolean> => {
      if (!token) return false
      const pay = Number(amount)
      if (!Number.isFinite(pay) || pay <= 0) return false
      try {
        const updated = await api.ledgerCustomers.pay(token, customerId, pay)
        setLedgerCustomers((prev) =>
          prev.map((x) =>
            x.id === customerId
              ? {
                  ...x,
                  balance: Number(updated.balance),
                }
              : x,
          ),
        )
        const customerName = ledgerCustomers.find((c) => c.id === customerId)?.name || customerId
        logActivity({
          action: "ledger_payment_added",
          category: "payment",
          details: `${customerName} carisine odeme eklendi: ${pay}`,
          metadata: { customerId, amount: pay },
        })
        return true
      } catch {
        return false
      }
    },
    [token, ledgerCustomers, logActivity],
  )

  // ---- Derived ----
  const currentShift = cashShifts.find((s) => s.status === "open") || null

  const dailyReport: DailyReport = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaysClosed = closedTables.filter((ct) => new Date(ct.closedAt) >= today)
    const todaysCancelled = cancelledItems.filter((ci) => new Date(ci.cancelledAt) >= today)

    const totalRevenue = todaysClosed.reduce((s, ct) => s + (ct.netAmount || 0), 0)
    const totalOrders = todaysClosed.reduce((s, ct) => s + (ct.orders?.length || 0), 0)
    const totalTables = todaysClosed.length

    const cancelledAmount = todaysCancelled.reduce(
      (s, ci) => s + ci.orderItem.price * ci.orderItem.quantity,
      0,
    )
    const discountAmount = todaysClosed.reduce((s, ct) => s + (ct.discountAmount || 0), 0)

    const paymentMap = new Map<
      string,
      { method: string; total: number; count: number }
    >()
    todaysClosed.forEach((ct) => {
      const m = ct.payment?.method || "bilinmiyor"
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
        o.items
          .filter(itemCountsTowardBill)
          .forEach((i) => {
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

    const hourlyBuckets: { [hour: string]: { hour: string; revenue: number; orders: number } } = {}
    todaysClosed.forEach((ct) => {
      const d = new Date(ct.closedAt)
      const h = d.getHours().toString().padStart(2, "0") + ":00"
      if (!hourlyBuckets[h]) {
        hourlyBuckets[h] = { hour: h, revenue: 0, orders: 0 }
      }
      hourlyBuckets[h].revenue += ct.netAmount || 0
      hourlyBuckets[h].orders += ct.orders?.length || 0
    })
    const hourlyRevenue = Object.values(hourlyBuckets).sort(
      (a, b) => a.hour.localeCompare(b.hour),
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
  }, [closedTables, cancelledItems])

  // ========== TABLE OPERATIONS ==========
  const getTableOrders = useCallback((tableId: string) =>
    orders.filter((o) => o.tableId === tableId && o.status === "active"), [orders])

  const getTableTotal = useCallback((tableId: string) => {
    return orders
      .filter((o) => o.tableId === tableId && o.status === "active")
      .reduce((sum, o) => sum + o.items
        .filter(itemCountsTowardBill)
        .reduce((s, i) => s + i.price * i.quantity, 0), 0)
  }, [orders])

  const moveTable = useCallback(async (fromId: string, toId: string): Promise<boolean> => {
    if (!token) return false
    try {
      await api.orders.move(token, fromId, toId)
    } catch {
      return false
    }
    const fromName = tables.find((t) => t.id === fromId)?.name || fromId
    setOrders((prev) => prev.map((o) =>
      o.tableId === fromId && o.status === "active" ? { ...o, tableId: toId, mergedFrom: fromName } : o))
    setTables((prev) => {
      const from = prev.find((t) => t.id === fromId)
      const to = prev.find((t) => t.id === toId)
      if (!from) return prev
      return prev.map((t) => {
        if (t.id === fromId) return { ...t, status: "empty" as const, waiter: undefined, totalAmount: 0, orderCount: 0, lastUpdated: undefined, activeOrderId: undefined, discount: undefined, splitInfo: undefined }
        if (t.id === toId) {
          if (to?.status === "occupied") return { ...t, totalAmount: (to.totalAmount || 0) + from.totalAmount, orderCount: (to.orderCount || 0) + from.orderCount, lastUpdated: new Date() }
          return { ...t, status: from.status, waiter: from.waiter, totalAmount: from.totalAmount, orderCount: from.orderCount, lastUpdated: new Date(), activeOrderId: from.activeOrderId }
        }
        return t
      })
    })
    logActivity({
      action: "table_moved",
      category: "table",
      details: `${fromName} masasindaki adisyon ${toId} masaya tasindi`,
      metadata: { fromId, toId },
    })
    return true
  }, [token, tables, logActivity])

  const moveOrderItems = useCallback(
    async (fromTableId: string, toTableId: string, itemIds: string[]): Promise<boolean> => {
      if (!token || itemIds.length === 0) return false
      try {
        await api.orders.moveItems(token, {
          fromTableId,
          toTableId,
          itemIds,
          userId: currentUser?.id,
          actorDisplayName: currentUser?.name?.trim() || undefined,
        })
        logActivity({
          action: "order_items_moved",
          category: "order",
          details: `${itemIds.length} kalem baska masaya tasindi`,
          metadata: { fromTableId, toTableId, itemIds },
        })
        return true
      } catch {
        return false
      }
    },
    [token, currentUser?.id, currentUser?.name, logActivity],
  )

  const openShift = useCallback(async (openingBalance: number) => {
    if (!token) return
    const res = await api.shifts.open(token, openingBalance)
    setCashShifts((prev) => [...prev, mapShiftDtoToPanel(res)])
    logActivity({
      action: "shift_opened",
      category: "kasa",
      details: `Vardiya acildi. Acilis bakiyesi: ${openingBalance}`,
      metadata: { shiftId: res.id, openingBalance },
    })
  }, [token, logActivity])

  const closeShift = useCallback(async (closingBalance: number, notes?: string) => {
    if (!token || !currentShift) return
    const res = await api.shifts.close(token, currentShift.id, closingBalance, notes)
    setCashShifts((prev) => prev.map((s) => (s.id === currentShift.id ? mapShiftDtoToPanel(res) : s)))
    logActivity({
      action: "shift_closed",
      category: "kasa",
      details: `Vardiya kapatildi. Kapanis bakiyesi: ${closingBalance}${notes ? ` (${notes})` : ""}`,
      metadata: { shiftId: currentShift.id, closingBalance, notes },
    })
  }, [token, currentShift, logActivity])

  const addCashTransaction = useCallback(async (t: Omit<CashTransaction, "id" | "createdAt" | "shiftId">) => {
    if (!currentShift) return
    if (token) {
      try {
        const res = await api.cashTransactions.create(token, {
          type: t.type,
          amount: t.amount,
          description: t.description,
          reference: t.reference,
          createdBy: t.createdBy,
        })
        const dto = res.transaction
        const tx: CashTransaction = {
          id: dto.id,
          shiftId: dto.shiftId,
          type: dto.type,
          amount: dto.amount,
          description: dto.description,
          reference: dto.reference ?? undefined,
          createdBy: dto.createdBy,
          createdAt: new Date(dto.createdAt),
        }
        setCashTransactions((prev) => [...prev, tx])
        setCashShifts((prev) => prev.map((s) => (s.id === res.shift.id ? mapShiftDtoToPanel(res.shift) : s)))
        logActivity({
          action: "cash_transaction_created",
          category: "kasa",
          details: `${t.type} islemi: ${t.amount} - ${t.description}`,
          metadata: { shiftId: res.shift.id, type: t.type, amount: t.amount, reference: t.reference },
        })
        return
      } catch (e) {
        console.error(e)
      }
    }
    const fallback: CashTransaction = { ...t, id: genId("ctx"), shiftId: currentShift.id, createdAt: new Date() }
    setCashTransactions((prev) => [...prev, fallback])
    if (t.type === "cash-in" || t.type === "sale") {
      setCashShifts((prev) =>
        prev.map((s) =>
          s.id === currentShift.id
            ? { ...s, cashIn: s.cashIn + t.amount, transactionCount: s.transactionCount + 1 }
            : s,
        ),
      )
    } else if (t.type === "expense" || t.type === "cash-out" || t.type === "refund") {
      setCashShifts((prev) =>
        prev.map((s) =>
          s.id === currentShift.id
            ? { ...s, cashOut: s.cashOut + t.amount, transactionCount: s.transactionCount + 1 }
            : s,
        ),
      )
    }
  }, [currentShift, token, logActivity])

  // ========== PAYMENT ==========
  const closeTableWithPayment = useCallback(async (
    tableId: string, method: PaymentMethod,
    discount?: { type: "percent" | "amount"; value: number; reason: string },
    splitDetails?: { method: string; amount: number }[],
    opts?: { ledgerCustomerId?: string; ledgerDebtAmount?: number },
  ): Promise<boolean> => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return false
    const tableOrders = orders.filter((o) => o.tableId === tableId && o.status === "active")
    if (tableOrders.length === 0) return false
    if (method === "cari" && !opts?.ledgerCustomerId) return false
    const now = new Date()
    const rawTotal = tableOrders.reduce((s, o) => s + o.items.filter(itemCountsTowardBill).reduce((a, i) => a + i.price * i.quantity, 0), 0)

    /** Prefer discount from Close Check modal if present; otherwise the table discount from the Discount modal (reflected in the API snapshot). */
    let discountAmount = 0
    let effectiveDiscount: { type: "percent" | "amount"; value: number; reason: string } | undefined
    if (discount) {
      discountAmount = discount.type === "percent" ? Math.round(rawTotal * discount.value / 100) : discount.value
      effectiveDiscount = discount
    } else if (table.discount) {
      const td = table.discount
      if (td.type === "ikram") {
        discountAmount = rawTotal
        effectiveDiscount = { type: "percent", value: 100, reason: td.reason }
      } else if (td.type === "percent") {
        discountAmount = Math.round(rawTotal * td.value / 100)
        effectiveDiscount = { type: "percent", value: td.value, reason: td.reason }
      } else {
        discountAmount = Math.min(td.value, rawTotal)
        effectiveDiscount = { type: "amount", value: td.value, reason: td.reason }
      }
    }
    const netAmount = Math.max(0, rawTotal - discountAmount)

    const waiterLabel =
      table.waiter ||
      resolveStaffNameForTable(tableId, tableOrders, users) ||
      "Bilinmiyor"

    const ledgerPaymentSnap =
      method === "cari" && opts?.ledgerCustomerId
        ? {
            ledgerCustomerId: opts.ledgerCustomerId,
            ledgerCustomerName:
              ledgerCustomers.find((c) => c.id === opts.ledgerCustomerId)?.name?.trim() || undefined,
          }
        : {}

    const payment: Payment = {
      id: genId("pay"), tableId, tableName: table.name,
      orderIds: tableOrders.map((o) => o.id), amount: netAmount,
      method, discount: effectiveDiscount, splitDetails,
      processedBy: currentUser?.id || "pu1", createdAt: now,
      ...ledgerPaymentSnap,
    }

    const billLines = tableOrders.flatMap((o) => o.items.filter(itemCountsTowardBill))
    const qtyByProduct = new Map<string, number>()
    for (const it of billLines) {
      qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.quantity)
    }
    const stockDeductionPayload = [...qtyByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }))

    if (token) {
      try {
        const body = {
          tableName: table.name,
          section: table.section,
          waiter: waiterLabel,
          orders: tableOrders.map((o) => ({
            id: o.id,
            tableId: o.tableId,
            userId: o.userId,
            userName: o.userName?.trim() || users.find((u) => u.id === o.userId)?.name,
            mergedFrom: o.mergedFrom,
            items: o.items.map((i) => ({
              id: i.id,
              productId: i.productId,
              productName: i.productName,
              price: i.price,
              quantity: i.quantity,
              note: i.note,
              status: i.status,
              createdAt: i.createdAt.toISOString(),
              ...(i.status === "cancelled"
                ? {
                    cancelReason: i.cancelReason,
                    cancelledBy: i.cancelledBy,
                    cancelledAt: i.cancelledAt?.toISOString(),
                  }
                : {}),
            })),
            status: o.status,
            createdAt: o.createdAt.toISOString(),
            updatedAt: o.updatedAt.toISOString(),
          })),
          payment: {
            id: payment.id,
            tableId: payment.tableId,
            tableName: payment.tableName,
            orderIds: payment.orderIds,
            amount: payment.amount,
            method: payment.method,
            splitDetails: payment.splitDetails,
            discount: effectiveDiscount
              ? {
                  type: effectiveDiscount.type,
                  value: effectiveDiscount.value,
                  reason: effectiveDiscount.reason,
                }
              : undefined,
            tip: payment.tip,
            processedBy: payment.processedBy,
            createdAt: now.toISOString(),
            ...ledgerPaymentSnap,
          },
          totalAmount: rawTotal,
          discountAmount,
          netAmount,
          closedBy: currentUser?.name || "Sistem",
          openedAt: (tableOrders[0]?.createdAt || now).toISOString(),
          closedAt: now.toISOString(),
          ...(opts?.ledgerCustomerId ? { ledgerCustomerId: opts.ledgerCustomerId } : {}),
          ...(opts?.ledgerDebtAmount != null && Number.isFinite(opts.ledgerDebtAmount)
            ? { ledgerDebtAmount: opts.ledgerDebtAmount }
            : {}),
        }
        const created = await api.completedOrders.create(token, body)
        const mapped = mapCompletedOrderDtoToClosedTable(created)
        setClosedTables((prev) => [mapped, ...prev])
        await api.orders.close(token, tableId)
        if (opts?.ledgerCustomerId) void ledgerRefresh()
      } catch {
        return false
      }
    } else {
      const closed: ClosedTable = {
        id: genId("ct"), tableName: table.name, section: table.section,
        waiter: waiterLabel, orders: tableOrders, payment,
        totalAmount: rawTotal, discountAmount, netAmount,
        closedBy: currentUser?.name || "Sistem",
        openedAt: tableOrders[0]?.createdAt || now, closedAt: now,
      }
      setClosedTables((prev) => [closed, ...prev])
    }
    setOrders((prev) => prev.map((o) => o.tableId === tableId && o.status === "active" ? { ...o, status: "closed" as const } : o))
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, status: "empty" as const, waiter: undefined, totalAmount: 0, orderCount: 0, lastUpdated: undefined, activeOrderId: undefined, discount: undefined, splitInfo: undefined } : t))

    // Add cash transaction (for reporting & expected cash)
    if (currentShift && method === "nakit") {
      await addCashTransaction({
        type: "sale",
        amount: netAmount,
        description: `${table.name} - Hesap`,
        reference: table.name,
        createdBy: currentUser?.name || "Sistem",
      })
    } else if (currentShift && method === "coklu" && splitDetails?.length) {
      const nakitPart = splitDetails
        .filter((s) => s.method === "nakit")
        .reduce((s, x) => s + (Number(x.amount) || 0), 0)
      if (nakitPart > 0) {
        await addCashTransaction({
          type: "sale",
          amount: nakitPart,
          description: `${table.name} - Hesap (karma nakit)`,
          reference: table.name,
          createdBy: currentUser?.name || "Sistem",
        })
      }
    }
    if (stockDeductionPayload.length > 0) {
      const mv = addStockMovementRef.current
      if (mv) {
        try {
          await runDeductStockForOrder(stockDeductionPayload, products, stockMaterials, mv)
        } catch (e) {
          console.error("Stok dusumu basarisiz (hesap kapatildi):", e)
        }
      }
    }
    logActivity({
      action: "table_closed_with_payment",
      category: "payment",
      details: `${table.name} kapatildi. Yontem: ${method}, Net: ${netAmount}`,
      metadata: {
        tableId,
        tableName: table.name,
        method,
        rawTotal,
        discountAmount,
        netAmount,
        orderCount: tableOrders.length,
      },
    })
    return true
  }, [
    token,
    tables,
    orders,
    users,
    currentUser,
    settings,
    currentShift,
    ledgerRefresh,
    addCashTransaction,
    logActivity,
    ledgerCustomers,
    products,
    stockMaterials,
  ])

  // ========== CANCEL ==========
  const cancelOrderItem = useCallback((orderId: string, itemId: string, reason: string) => {
    const order = orders.find((o) => o.id === orderId)
    const item = order?.items.find((i) => i.id === itemId)
    if (!order || !item) return
    const table = tables.find((t) => t.id === order.tableId)
    const cancelled: CancelledItem = {
      id: genId("ci"), orderItem: { ...item, status: "cancelled", cancelReason: reason, cancelledBy: currentUser?.name, cancelledAt: new Date() },
      tableName: table?.name || "?", orderId, reason, cancelledBy: currentUser?.name || "Sistem", cancelledAt: new Date(),
    }
    setCancelledItems((prev) => [cancelled, ...prev])
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, items: o.items.map((i) => i.id === itemId ? { ...i, status: "cancelled" as const, cancelReason: reason, cancelledBy: currentUser?.name, cancelledAt: new Date() } : i) } : o))
    const cancelledAmount = item.price * item.quantity
    setTables((prev) => prev.map((t) => t.id === order.tableId ? { ...t, totalAmount: Math.max(0, t.totalAmount - cancelledAmount) } : t))

    if (token) {
      void api.orders.cancelItem(token, { itemId, reason }).catch((err) => {
        console.error("cancel-item API:", err)
      })
    }
    logActivity({
      action: "order_item_cancelled",
      category: "order",
      details: `${table?.name || "Masa"} - ${item.productName} iptal edildi (${reason})`,
      metadata: { orderId, itemId, tableId: order.tableId, quantity: item.quantity, price: item.price, reason },
    })
  }, [orders, tables, currentUser, token, logActivity])

  const assignItemsToLedger = useCallback(
    async (
      lines: { itemId: string; quantity?: number }[],
      ledgerCustomerId: string,
    ): Promise<{ ok: boolean; amount?: number }> => {
      if (!token || lines.length === 0 || !ledgerCustomerId) return { ok: false }
      try {
        const res = await api.orders.assignToLedger(token, { lines, ledgerCustomerId })
        void ledgerRefresh()
        logActivity({
          action: "order_items_assigned_to_ledger",
          category: "payment",
          details: `${lines.length} kalem cariye aktarildi`,
          metadata: { ledgerCustomerId, lineCount: lines.length, amount: res.amount },
        })
        return { ok: true, amount: res.amount }
      } catch (e) {
        console.error("assign-to-ledger:", e)
        return { ok: false }
      }
    },
    [token, ledgerRefresh, logActivity],
  )

  const revertLedgerOrderItem = useCallback(
    async (itemId: string): Promise<{ ok: boolean; amount?: number }> => {
      if (!token || !itemId) return { ok: false }
      try {
        const res = await api.orders.revertLedgerItem(token, { itemId })
        void ledgerRefresh()
        logActivity({
          action: "ledger_item_reverted_to_order",
          category: "payment",
          details: "Cariye yazilan kalem adisyona geri alindi",
          metadata: { itemId, amount: res.amount },
        })
        return { ok: true, amount: res.amount }
      } catch (e) {
        console.error("revert-ledger-item:", e)
        return { ok: false }
      }
    },
    [token, ledgerRefresh, logActivity],
  )

  // ========== PRODUCTS CRUD ==========
  const addProduct = useCallback((p: Omit<PanelProduct, "id">) => {
    if (token) {
      api.products
        .create(token, {
          categoryId: p.categoryId,
          name: p.name,
          price: p.price,
          description: p.description,
          imageUrl: p.image,
          inStock: p.inStock ?? true,
          ingredients:
            p.ingredients?.map((i) => ({ materialId: i.materialId, quantity: i.quantity })) ?? undefined,
        })
        .then((created) => {
          setProducts((prev) => [...prev, mapApiProductsToPanel([created], stockMaterials)[0]])
          logActivity({
            action: "product_created",
            category: "product",
            details: `Urun eklendi: ${created.name}`,
            metadata: { productId: created.id, categoryId: created.categoryId, price: created.price },
          })
        })
        .catch(console.error)
    } else {
      setProducts((prev) => [...prev, { ...p, id: genId("pp") }])
      logActivity({
        action: "product_created",
        category: "product",
        details: `Urun eklendi: ${p.name}`,
        metadata: { categoryId: p.categoryId, price: p.price },
      })
    }
  }, [token, stockMaterials, logActivity])
  const updateProduct = useCallback((id: string, data: Partial<PanelProduct>) => {
    if (token) {
      const body: Parameters<typeof api.products.update>[2] = {}
      if (data.name !== undefined) body.name = data.name
      if (data.description !== undefined) body.description = data.description
      if (data.price !== undefined) body.price = data.price
      if (data.image !== undefined) body.imageUrl = data.image
      if (data.inStock !== undefined) body.inStock = data.inStock
      if (data.ingredients !== undefined) {
        body.ingredients =
          data.ingredients.length > 0
            ? data.ingredients.map((i) => ({ materialId: i.materialId, quantity: i.quantity }))
            : []
      }
      if (Object.keys(body).length === 0) return
      api.products
        .update(token, id, body)
        .then((updated) => {
          setProducts((prev) => prev.map((p) => (p.id === id ? mapApiProductsToPanel([updated], stockMaterials)[0] : p)))
          logActivity({
            action: "product_updated",
            category: "product",
            details: `Urun guncellendi: ${updated.name}`,
            metadata: { productId: id, fields: Object.keys(body) },
          })
        })
        .catch(console.error)
    } else {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
      logActivity({
        action: "product_updated",
        category: "product",
        details: `Urun guncellendi: ${id}`,
        metadata: { productId: id, fields: Object.keys(data) },
      })
    }
  }, [token, stockMaterials, logActivity])
  const deleteProduct = useCallback((id: string) => {
    if (token) {
      api.products.delete(token, id).then(() => {
        setProducts((prev) => prev.filter((p) => p.id !== id))
        logActivity({ action: "product_deleted", category: "product", details: `Urun silindi: ${id}`, metadata: { productId: id } })
      }).catch(console.error)
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id))
      logActivity({ action: "product_deleted", category: "product", details: `Urun silindi: ${id}`, metadata: { productId: id } })
    }
  }, [token, logActivity])

  // ========== CATEGORY CRUD ==========
  const addCategory = useCallback(
    (name: string, opts?: { showInTerminal?: boolean; showInMenu?: boolean; parentId?: string | null }) => {
      const showInTerminal = opts?.showInTerminal ?? true
      const showInMenu = opts?.showInMenu ?? true
      const parentId = opts?.parentId?.trim() || undefined
      if (token) {
        api.categories.create(token, {
          name,
          showInTerminal,
          showInMenu,
          ...(parentId ? { parentId } : {}),
        })
          .then((created) => {
            setCategories((prev) => [...prev, mapApiCategoriesToPanel([created])[0]])
            logActivity({
              action: "category_created",
              category: "product",
              details: `Kategori eklendi: ${created.name}`,
              metadata: { categoryId: created.id, parentId: created.parentId ?? undefined },
            })
          })
          .catch(console.error)
      } else {
        setCategories((prev) => [
          ...prev,
          {
            id: genId("pc"),
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            order: prev.length + 1,
            parentId,
            showInTerminal,
            showInMenu,
            showInQuickSale: true,
          },
        ])
      }
    },
    [token, logActivity],
  )
  const updateCategory = useCallback((id: string, data: Partial<PanelCategory>) => {
    if (token) {
      const payload: {
        name?: string
        showInTerminal?: boolean
        showInMenu?: boolean
        parentId?: string | null
      } = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.showInTerminal !== undefined) payload.showInTerminal = data.showInTerminal
      if (data.showInMenu !== undefined) payload.showInMenu = data.showInMenu
      if (data.parentId !== undefined) payload.parentId = data.parentId?.trim() || null
      api.categories
        .update(token, id, payload)
        .then((updated) => {
          setCategories((prev) => prev.map((c) => (c.id === id ? mapApiCategoriesToPanel([updated])[0] : c)))
          logActivity({
            action: "category_updated",
            category: "product",
            details: `Kategori guncellendi: ${updated.name}`,
            metadata: { categoryId: id, fields: Object.keys(payload) },
          })
        })
        .catch(console.error)
    } else {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                ...data,
                slug: data.name ? data.name.toLowerCase().replace(/\s+/g, "-") : c.slug,
                parentId: data.parentId !== undefined ? data.parentId?.trim() || undefined : c.parentId,
              }
            : c,
        ),
      )
    }
  }, [token, logActivity])
  const deleteCategory = useCallback((id: string) => {
    if (token) {
      api.categories.delete(token, id).then(() => {
        setCategories((prev) => prev.filter((c) => c.id !== id))
        logActivity({ action: "category_deleted", category: "product", details: `Kategori silindi: ${id}`, metadata: { categoryId: id } })
      }).catch(console.error)
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id))
      logActivity({ action: "category_deleted", category: "product", details: `Kategori silindi: ${id}`, metadata: { categoryId: id } })
    }
  }, [token, logActivity])

  // ========== USERS CRUD (staff API) ==========
  const addUser = useCallback((u: Omit<PanelUser, "id" | "createdAt">) => {
    if (!token) return
    const role = u.role === "root" ? "mudur" : u.role
    const pin = (u.pin ?? "").trim()
    if (!pin) return
    api.staff.create(token, { name: u.name, pin, role, phone: u.phone })
      .then((created) => {
        setUsers((prev) => [...prev, { id: created.id, name: created.name, phone: created.phone, pin: created.pin ?? undefined, role: created.role as PanelUser["role"], active: created.isActive, createdAt: new Date(created.createdAt) }])
        logActivity({
          action: "staff_created",
          category: "user",
          details: `Kullanici eklendi: ${created.name}`,
          metadata: { userId: created.id, role: created.role },
        })
      })
      .catch(console.error)
  }, [token, logActivity])
  const updateUser = useCallback((id: string, data: Partial<PanelUser>) => {
    if (!token) return
    const payload: { name?: string; pin?: string; role?: "mudur" | "kasiyer" | "garson"; phone?: string; isActive?: boolean } = {}
    if (data.name != null) payload.name = data.name
    if (data.pin != null && data.pin !== "") payload.pin = data.pin
    if (data.role != null && data.role !== "root") payload.role = data.role
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.active !== undefined) payload.isActive = data.active
    api.staff.update(token, id, payload)
      .then((updated) => {
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, name: updated.name, phone: updated.phone, pin: updated.pin ?? undefined, role: updated.role as PanelUser["role"], active: updated.isActive } : u))
        logActivity({
          action: "staff_updated",
          category: "user",
          details: `Kullanici guncellendi: ${updated.name}`,
          metadata: { userId: id, fields: Object.keys(payload) },
        })
      })
      .catch(console.error)
  }, [token, logActivity])
  const deleteUser = useCallback((id: string) => {
    if (!token) return
    api.staff.delete(token, id).then(() => {
      setUsers((prev) => prev.filter((u) => u.id !== id))
      logActivity({ action: "staff_deleted", category: "user", details: `Kullanici silindi: ${id}`, metadata: { userId: id } })
    }).catch(console.error)
  }, [token, logActivity])

  // ========== SECTIONS CRUD ==========
  const addSection = useCallback((name: string) => { setSections((prev) => [...prev, { id: genId("ps"), name }]) }, [])
  const updateSection = useCallback((id: string, name: string) => { setSections((prev) => prev.map((s) => s.id === id ? { ...s, name } : s)) }, [])
  const deleteSection = useCallback((id: string) => { setSections((prev) => prev.filter((s) => s.id !== id)) }, [])

  // ========== TABLE CRUD ==========
  const addTable = useCallback((name: string, section: string) => {
    if (token) {
      api.tables.create(token, { name, section })
        .then((created) => {
          setTables((prev) => [...prev, { id: created.id, name: created.name, section: created.section, status: "empty", totalAmount: 0, orderCount: 0 }])
          logActivity({ action: "table_created", category: "table", details: `Masa eklendi: ${created.name}`, metadata: { tableId: created.id, section: created.section } })
        }).catch(console.error)
    } else {
      setTables((prev) => [...prev, { id: genId("pt"), name, section, status: "empty" as const, totalAmount: 0, orderCount: 0 }])
      logActivity({ action: "table_created", category: "table", details: `Masa eklendi: ${name}`, metadata: { section } })
    }
  }, [token, logActivity])
  const deleteTable = useCallback((id: string) => {
    if (token) {
      api.tables.delete(token, id).then(() => {
        setTables((prev) => prev.filter((t) => t.id !== id))
        logActivity({ action: "table_deleted", category: "table", details: `Masa silindi: ${id}`, metadata: { tableId: id } })
      }).catch(console.error)
    } else {
      setTables((prev) => prev.filter((t) => t.id !== id))
      logActivity({ action: "table_deleted", category: "table", details: `Masa silindi: ${id}`, metadata: { tableId: id } })
    }
  }, [token, logActivity])

  // ========== SETTINGS ==========
  const updateSettings = useCallback((s: Partial<RestaurantSettings>) => {
    setSettings((prev) => ({ ...prev, ...s }))
    if (!token) return
    api.restaurant.updateSettings(token, {
      name: s.name,
      address: s.address,
      phone: s.phone,
      taxId: s.taxId,
      whatsapp: s.whatsapp,
      instagram: s.instagram,
      facebook: s.facebook,
      website: s.website,
      workingHours: s.workingHours,
    }).then(() => {
      logActivity({
        action: "settings_updated",
        category: "settings",
        details: "Restoran ayarlari guncellendi",
        metadata: { fields: Object.keys(s) },
      })
    }).catch(console.error)
  }, [token, logActivity])
  const reprintReceipt = useCallback(
    async (
      target:
        | string
        | { orderId: string }
        | {
            tableName: string
            waiterName?: string
            items: { productName: string; quantity: number; price: number; note?: string; productId?: string; categoryId?: string }[]
            total: number
          },
    ) => {
      if (!token) return
      try {
        if (typeof target === "string") {
          await api.orders.printReceipt(token, { tableId: target })
        } else if ("orderId" in target) {
          await api.orders.printReceipt(token, { orderId: target.orderId })
        } else {
          await api.orders.printReceipt(token, target)
        }
      } catch (e) {
        console.error("printReceipt", e)
      }
    },
    [token],
  )

  // ========== STOCK ==========
  const addMaterial = useCallback((m: Omit<StockMaterial, "id" | "lastUpdated">) => {
    if (token) {
      api.stock.materials
        .create(token, {
          name: m.name,
          unit: m.unit,
          currentStock: m.currentStock,
          minStock: m.minStock,
          costPerUnit: m.costPerUnit,
          supplierId: m.supplierId,
          category: m.category,
        })
        .then((created) => {
          setStockMaterials((prev) => [
            ...prev,
            {
              id: created.id,
              name: created.name,
              unit: created.unit as StockMaterial["unit"],
              currentStock: created.currentStock,
              minStock: created.minStock,
              costPerUnit: created.costPerUnit,
              supplierId: created.supplierId ?? undefined,
              category: created.category,
              lastUpdated: new Date(created.updatedAt),
            },
          ])
          logActivity({
            action: "material_created",
            category: "stock",
            details: `Malzeme eklendi: ${created.name}`,
            metadata: { materialId: created.id, stock: created.currentStock, unit: created.unit },
          })
        })
        .catch(console.error)
    } else {
      setStockMaterials((prev) => [
        ...prev,
        { ...m, id: genId("sm"), lastUpdated: new Date() },
      ])
      logActivity({
        action: "material_created",
        category: "stock",
        details: `Malzeme eklendi: ${m.name}`,
        metadata: { stock: m.currentStock, unit: m.unit },
      })
    }
  }, [token, logActivity])

  const updateMaterial = useCallback((id: string, data: Partial<StockMaterial>) => {
    if (token) {
      const body: {
        name?: string
        unit?: string
        currentStock?: number
        minStock?: number
        costPerUnit?: number
        supplierId?: string | null
        category?: string
      } = {
        name: data.name,
        unit: data.unit,
        currentStock: data.currentStock,
        minStock: data.minStock,
        costPerUnit: data.costPerUnit,
        supplierId: data.supplierId,
        category: data.category,
      }
      api.stock.materials
        .update(token, id, body)
        .then((updated) => {
          setStockMaterials((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    id: updated.id,
                    name: updated.name,
                    unit: updated.unit as StockMaterial["unit"],
                    currentStock: updated.currentStock,
                    minStock: updated.minStock,
                    costPerUnit: updated.costPerUnit,
                    supplierId: updated.supplierId ?? undefined,
                    category: updated.category,
                    lastUpdated: new Date(updated.updatedAt),
                  }
                : m,
            ),
          )
          logActivity({
            action: "material_updated",
            category: "stock",
            details: `Malzeme guncellendi: ${updated.name}`,
            metadata: { materialId: id, fields: Object.keys(body) },
          })
        })
        .catch(console.error)
    } else {
      setStockMaterials((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, ...data, lastUpdated: new Date() } : m,
        ),
      )
      logActivity({
        action: "material_updated",
        category: "stock",
        details: `Malzeme guncellendi: ${id}`,
        metadata: { materialId: id, fields: Object.keys(data) },
      })
    }
  }, [token, logActivity])

  const deleteMaterial = useCallback((id: string) => {
    if (token) {
      api.stock.materials
        .delete(token, id)
        .then(() => {
          setStockMaterials((prev) => prev.filter((m) => m.id !== id))
          logActivity({ action: "material_deleted", category: "stock", details: `Malzeme silindi: ${id}`, metadata: { materialId: id } })
        })
        .catch(console.error)
    } else {
      setStockMaterials((prev) => prev.filter((m) => m.id !== id))
      logActivity({ action: "material_deleted", category: "stock", details: `Malzeme silindi: ${id}`, metadata: { materialId: id } })
    }
  }, [token, logActivity])

  const addStockMovement = useCallback(
    (m: StockMovementInput): Promise<void> => {
      const material = stockMaterials.find((sm) => sm.id === m.materialId)
      if (!material) return Promise.resolve()
      if (token) {
        return api.stock.movements
          .create(token, {
            materialId: m.materialId,
            materialName: m.materialName,
            type: m.type,
            quantity: m.quantity,
            unitCost: m.unitCost,
            totalCost: m.totalCost,
            supplierId: m.supplierId,
            reason: m.reason,
            createdBy: m.createdBy,
          })
          .then((created) => {
            setStockMovements((prev) => [
              {
                id: created.id,
                materialId: created.materialId,
                materialName: created.materialName,
                type: created.type,
                quantity: created.quantity,
                previousStock: created.previousStock,
                newStock: created.newStock,
                unitCost: created.unitCost ?? undefined,
                totalCost: created.totalCost ?? undefined,
                supplierId: created.supplierId ?? undefined,
                reason: created.reason ?? undefined,
                createdBy: created.createdBy,
                createdAt: new Date(created.createdAt),
              },
              ...prev,
            ])
            setStockMaterials((mats) =>
              mats.map((sm) =>
                sm.id === created.materialId
                  ? {
                      ...sm,
                      currentStock: created.newStock,
                      lastUpdated: new Date(created.createdAt),
                    }
                  : sm,
              ),
            )
            logActivity({
              action: "stock_movement_created",
              category: "stock",
              details: `${created.materialName} icin ${created.type} hareketi (${created.quantity})`,
              metadata: { movementId: created.id, materialId: created.materialId, type: created.type, quantity: created.quantity },
            })
          })
          .catch((e) => {
            console.error(e)
            throw e
          })
      }
      const prev = material.currentStock
      const next = m.type === "in" ? prev + m.quantity : Math.max(0, prev - m.quantity)
      setStockMaterials((mats) =>
        mats.map((sm) =>
          sm.id === m.materialId
            ? { ...sm, currentStock: next, lastUpdated: new Date() }
            : sm,
        ),
      )
      setStockMovements((mvs) => [
        {
          ...m,
          id: genId("smv"),
          previousStock: prev,
          newStock: next,
          createdAt: new Date(),
        },
        ...mvs,
      ])
      logActivity({
        action: "stock_movement_created",
        category: "stock",
        details: `${m.materialName} icin ${m.type} hareketi (${m.quantity})`,
        metadata: { materialId: m.materialId, type: m.type, quantity: m.quantity, reason: m.reason },
      })
      return Promise.resolve()
    },
    [stockMaterials, token, logActivity],
  )
  addStockMovementRef.current = addStockMovement

  const deductStockForOrder = useCallback(
    (orderItems: { productId: string; quantity: number }[]) =>
      runDeductStockForOrder(orderItems, products, stockMaterials, addStockMovement),
    [products, stockMaterials, addStockMovement],
  )

  // Set ingredients for a product (permanent: API + product snapshot for stock deduction)
  const setProductIngredients = useCallback(
    (productId: string, ingredients: { materialId: string; quantity: number }[]) => {
      const payload = ingredients.filter((i) => i.materialId && i.quantity > 0)
      if (token) {
        void api.products
          .update(token, productId, {
            ingredients: payload.map((i) => ({ materialId: i.materialId, quantity: i.quantity })),
          })
          .then((updated) =>
            setProducts((prev) =>
              prev.map((p) => (p.id === productId ? mapApiProductsToPanel([updated], stockMaterials)[0] : p)),
            ),
          )
          .then(() => {
            logActivity({
              action: "product_ingredients_updated",
              category: "stock",
              details: `Urun-malzeme eslestirmesi guncellendi`,
              metadata: { productId, ingredientCount: payload.length },
            })
          })
          .catch(console.error)
      } else {
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p
            const newIngredients = payload.map((ing) => {
              const material = stockMaterials.find((m) => m.id === ing.materialId)
              return {
                materialId: ing.materialId,
                materialName: material?.name || "",
                quantity: ing.quantity,
                unit: material?.unit || "adet",
              }
            })
            return { ...p, ingredients: newIngredients }
          }),
        )
      }
    },
    [stockMaterials, token, logActivity],
  )

  // ========== QUICK SALE (Walk-in) ==========
  const addQuickSale = useCallback((
    items: { productId: string; name: string; price: number; quantity: number }[],
    method: PaymentMethod
  ): string | null => {
    if (!currentShift || items.length === 0) return null
    
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const saleId = genId("qs")
    const now = new Date()
    
    const orderItems = items.map((item, idx) => ({
      id: `${saleId}-item-${idx}`,
      productId: item.productId,
      productName: item.name,
      price: item.price,
      quantity: item.quantity,
      status: "served" as const,
      createdAt: now,
    }))
    
    const quickOrder: PanelOrder = {
      id: `${saleId}-order`,
      tableId: "quick-sale",
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "Kasa",
      items: orderItems,
      status: "closed",
      createdAt: now,
      updatedAt: now,
    }
    
    const payment: Payment = {
      id: genId("pay"), tableId: "quick-sale", tableName: "Elden Satis",
      orderIds: [quickOrder.id], amount: totalAmount,
      method, processedBy: currentUser?.id || "pu1", createdAt: now,
    }

    if (token) {
      const body = {
        tableName: "Elden Satis",
        section: "Kasa",
        waiter: currentUser?.name || "Kasa",
        orders: [{
          id: quickOrder.id,
          tableId: quickOrder.tableId,
          userId: quickOrder.userId,
          userName: quickOrder.userName,
          items: quickOrder.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            productName: i.productName,
            price: i.price,
            quantity: i.quantity,
            note: i.note,
            status: i.status,
            createdAt: i.createdAt.toISOString(),
          })),
          status: quickOrder.status,
          createdAt: quickOrder.createdAt.toISOString(),
          updatedAt: quickOrder.updatedAt.toISOString(),
        }],
        payment: {
          id: payment.id,
          tableId: payment.tableId,
          tableName: payment.tableName,
          orderIds: payment.orderIds,
          amount: payment.amount,
          method: payment.method,
          splitDetails: payment.splitDetails,
          discount: payment.discount
            ? {
                type: payment.discount.type,
                value: payment.discount.value,
                reason: payment.discount.reason,
              }
            : undefined,
          tip: payment.tip,
          processedBy: payment.processedBy,
          createdAt: now.toISOString(),
        },
        totalAmount,
        discountAmount: 0,
        netAmount: totalAmount,
        closedBy: currentUser?.name || "Sistem",
        openedAt: now.toISOString(),
        closedAt: now.toISOString(),
      }
      api.completedOrders.create(token, body)
        .then((created) => {
          const mapped = mapCompletedOrderDtoToClosedTable(created)
          setClosedTables((prev) => [mapped, ...prev])
        })
        .catch(console.error)
    } else {
      const closed: ClosedTable = {
        id: saleId, tableName: "Elden Satis", section: "Kasa",
        waiter: currentUser?.name || "Kasa", orders: [quickOrder], payment,
        totalAmount, discountAmount: 0, netAmount: totalAmount,
        closedBy: currentUser?.name || "Sistem",
        openedAt: now, closedAt: now,
      }
      setClosedTables((prev) => [closed, ...prev])
    }
    
    if (method === "nakit") {
      void addCashTransaction({
        type: "sale",
        amount: totalAmount,
        description: `Elden Satis - ${items.length} urun`,
        reference: "Elden Satis",
        createdBy: currentUser?.name || "Sistem",
      })
    }
    
    void deductStockForOrder(items.map((item) => ({ productId: item.productId, quantity: item.quantity })))

    return saleId
  }, [currentShift, currentUser, token, deductStockForOrder, addCashTransaction])

  const createTableOrder = useCallback(
    async (
      tableId: string,
      items: { productId: string; productName: string; price: number; quantity: number; note?: string }[],
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!token) return { ok: false, error: "Oturum gerekli" }
      if (!currentShift) return { ok: false, error: "Once kasayi acin" }
      if (items.length === 0) return { ok: false, error: "Sepet bos" }
      const table = tables.find((t) => t.id === tableId)
      if (table?.status === "checkout") {
        return { ok: false, error: "Masa hesap kesiminde. Hesap penceresi kapatilmadan siparis gonderilemez." }
      }
      try {
        await api.orders.create(token, {
          tableId,
          userId: currentUser?.id,
          items,
        })
        logActivity({
          action: "table_order_created",
          category: "order",
          details: `${table?.name ?? tableId} masasina ${items.length} kalemli siparis`,
          metadata: { tableId, itemCount: items.length },
        })
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Siparis gonderilemedi" }
      }
    },
    [token, currentShift, currentUser?.id, tables, logActivity],
  )
  
  const addSupplier = useCallback((s: Omit<Supplier, "id">): Promise<boolean> => {
    if (token) {
      return api.stock.suppliers
        .create(token, {
          name: s.name,
          contactPerson: s.contactPerson,
          phone: s.phone,
          email: s.email,
          address: s.address,
          notes: s.notes,
        })
        .then((created) => {
          setSuppliers((prev) => [
            ...prev,
            {
              id: created.id,
              name: created.name,
              contactPerson: created.contactPerson ?? undefined,
              phone: created.phone ?? undefined,
              email: created.email ?? undefined,
              address: created.address ?? undefined,
              notes: created.notes ?? undefined,
              active: created.active,
            },
          ])
          logActivity({
            action: "supplier_created",
            category: "stock",
            details: `Tedarikci eklendi: ${created.name}`,
            metadata: { supplierId: created.id, phone: created.phone ?? undefined },
          })
          return true
        })
        .catch((e) => {
          console.error(e)
          return false
        })
    }
    setSuppliers((prev) => [...prev, { ...s, id: genId("sup") }])
    logActivity({
      action: "supplier_created",
      category: "stock",
      details: `Tedarikci eklendi: ${s.name}`,
    })
    return Promise.resolve(true)
  }, [token, logActivity])

  const updateSupplier = useCallback((id: string, data: Partial<Supplier>) => {
    if (token) {
      api.stock.suppliers
        .update(token, id, {
          name: data.name,
          contactPerson: data.contactPerson,
          phone: data.phone,
          email: data.email,
          address: data.address,
          notes: data.notes,
          active: data.active,
        })
        .then((updated) => {
          setSuppliers((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    id: updated.id,
                    name: updated.name,
                    contactPerson: updated.contactPerson ?? undefined,
                    phone: updated.phone ?? undefined,
                    email: updated.email ?? undefined,
                    address: updated.address ?? undefined,
                    notes: updated.notes ?? undefined,
                    active: updated.active,
                  }
                : s,
            ),
          )
          logActivity({
            action: "supplier_updated",
            category: "stock",
            details: `Tedarikci guncellendi: ${updated.name}`,
            metadata: { supplierId: id, fields: Object.keys(data) },
          })
        })
        .catch(console.error)
    } else {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data } : s)),
      )
      logActivity({
        action: "supplier_updated",
        category: "stock",
        details: `Tedarikci guncellendi: ${id}`,
        metadata: { supplierId: id, fields: Object.keys(data) },
      })
    }
  }, [token, logActivity])

  const deleteSupplier = useCallback((id: string) => {
    if (token) {
      api.stock.suppliers
        .delete(token, id)
        .then(() => {
          setSuppliers((prev) => prev.filter((s) => s.id !== id))
          logActivity({ action: "supplier_deleted", category: "stock", details: `Tedarikci silindi: ${id}`, metadata: { supplierId: id } })
        })
        .catch(console.error)
    } else {
      setSuppliers((prev) => prev.filter((s) => s.id !== id))
      logActivity({ action: "supplier_deleted", category: "stock", details: `Tedarikci silindi: ${id}`, metadata: { supplierId: id } })
    }
  }, [token, logActivity])

  const addPurchaseOrder = useCallback((po: Omit<PurchaseOrder, "id" | "createdAt">) => {
    if (token) {
      api.stock.purchaseOrders
        .create(token, {
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          items: po.items,
          notes: po.notes,
          status: po.status,
        })
        .then((created) => {
          setPurchaseOrders((prev) => [
            {
              id: created.id,
              supplierId: created.supplierId,
              supplierName: created.supplierName,
              items: created.items,
              totalAmount: created.totalAmount,
              status: created.status,
              notes: created.notes ?? undefined,
              createdBy: created.createdBy,
              createdAt: new Date(created.createdAt),
              receivedAt: created.receivedAt ? new Date(created.receivedAt) : undefined,
            },
            ...prev,
          ])
        })
        .catch(console.error)
    } else {
      setPurchaseOrders((prev) => [
        ...prev,
        { ...po, id: genId("po-buy"), createdAt: new Date() },
      ])
    }
  }, [token])

  const updatePurchaseOrder = useCallback((id: string, data: Partial<PurchaseOrder>) => {
    // Only local updates (notes/status tweak) for now
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, ...data } : po)),
    )
  }, [])

  const receivePurchaseOrder = useCallback((id: string) => {
    const po = purchaseOrders.find((p) => p.id === id)
    if (!po) return
    if (token) {
      api.stock.purchaseOrders
        .receive(token, id)
        .then((updated) => {
          setPurchaseOrders((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    id: updated.id,
                    supplierId: updated.supplierId,
                    supplierName: updated.supplierName,
                    items: updated.items,
                    totalAmount: updated.totalAmount,
                    status: updated.status,
                    notes: updated.notes ?? undefined,
                    createdBy: updated.createdBy,
                    createdAt: new Date(updated.createdAt),
                    receivedAt: updated.receivedAt
                      ? new Date(updated.receivedAt)
                      : undefined,
                  }
                : p,
            ),
          )
          // Movements + stock already handled on backend; reload via next sync or optimistic adjust not needed
        })
        .catch(console.error)
    } else {
      po.items.forEach((item) => {
        const material = stockMaterials.find((m) => m.id === item.materialId)
        if (material) {
          const prev = material.currentStock
          const next = prev + item.quantity
          setStockMaterials((mats) =>
            mats.map((m) =>
              m.id === item.materialId
                ? { ...m, currentStock: next, lastUpdated: new Date() }
                : m,
            ),
          )
          setStockMovements((mvs) => [
            {
              id: genId("smv"),
              materialId: item.materialId,
              materialName: item.materialName,
              type: "in" as const,
              quantity: item.quantity,
              previousStock: prev,
              newStock: next,
              unitCost: item.unitCost,
              totalCost: item.quantity * item.unitCost,
              supplierId: po.supplierId,
              createdBy: currentUser?.name || "Sistem",
              createdAt: new Date(),
            },
            ...mvs,
          ])
        }
      })
      setPurchaseOrders((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: "received" as const, receivedAt: new Date() }
            : p,
        ),
      )
    }
  }, [purchaseOrders, stockMaterials, currentUser, token])

  const startInventoryCount = useCallback(() => {
    if (token) {
      api.stock.inventoryCounts
        .start(token)
        .then((created) => {
          const ic: InventoryCount = {
            id: created.id,
            date: new Date(created.date),
            countedBy: created.countedBy,
            items: created.items.map((item) => ({
              materialId: item.materialId,
              materialName: item.materialName,
              expectedStock: item.expectedStock,
              actualStock: item.actualStock,
              difference: item.difference,
            })),
            status: created.status,
            notes: created.notes ?? undefined,
          }
          setInventoryCounts((prev) => [ic, ...prev])
        })
        .catch(console.error)
    } else {
      const items = stockMaterials.map((m) => ({
        materialId: m.id,
        materialName: m.name,
        expectedStock: m.currentStock,
        actualStock: m.currentStock,
        difference: 0,
      }))
      setInventoryCounts((prev) => [
        {
          id: genId("ic"),
          date: new Date(),
          countedBy: currentUser?.name || "Sistem",
          items,
          status: "in-progress" as const,
        },
        ...prev,
      ])
    }
  }, [stockMaterials, currentUser, token])

  const updateInventoryItem = useCallback(
    (countId: string, materialId: string, actual: number) => {
      if (token) {
        api.stock.inventoryCounts
          .updateItem(token, countId, { materialId, actual })
          .then((updated) => {
            const ic: InventoryCount = {
              id: updated.id,
              date: new Date(updated.date),
              countedBy: updated.countedBy,
              items: updated.items.map((item) => ({
                materialId: item.materialId,
                materialName: item.materialName,
                expectedStock: item.expectedStock,
                actualStock: item.actualStock,
                difference: item.difference,
              })),
              status: updated.status,
              notes: updated.notes ?? undefined,
            }
            setInventoryCounts((prev) =>
              prev.map((c) => (c.id === countId ? ic : c)),
            )
          })
          .catch(console.error)
      } else {
        setInventoryCounts((prev) =>
          prev.map((ic) =>
            ic.id === countId
              ? {
                  ...ic,
                  items: ic.items.map((it) =>
                    it.materialId === materialId
                      ? {
                          ...it,
                          actualStock: actual,
                          difference: actual - it.expectedStock,
                        }
                      : it,
                  ),
                }
              : ic,
          ),
        )
      }
    },
    [token],
  )

  const completeInventoryCount = useCallback(
    (countId: string) => {
      if (token) {
        api.stock.inventoryCounts
          .complete(token, countId)
          .then((updated) => {
            const ic: InventoryCount = {
              id: updated.id,
              date: new Date(updated.date),
              countedBy: updated.countedBy,
              items: updated.items.map((item) => ({
                materialId: item.materialId,
                materialName: item.materialName,
                expectedStock: item.expectedStock,
                actualStock: item.actualStock,
                difference: item.difference,
              })),
              status: updated.status,
              notes: updated.notes ?? undefined,
            }
            setInventoryCounts((prev) =>
              prev.map((c) => (c.id === countId ? ic : c)),
            )
            // related stockMaterials/movements already updated in backend; next sync will reflect it
          })
          .catch(console.error)
      } else {
        const count = inventoryCounts.find((ic) => ic.id === countId)
        if (!count) return
        count.items.forEach((item) => {
          if (item.difference !== 0) {
            setStockMaterials((mats) =>
              mats.map((m) =>
                m.id === item.materialId
                  ? {
                      ...m,
                      currentStock: item.actualStock,
                      lastUpdated: new Date(),
                    }
                  : m,
              ),
            )
            setStockMovements((mvs) => [
              {
                id: genId("smv"),
                materialId: item.materialId,
                materialName: item.materialName,
                type: "count-adjustment" as const,
                quantity: Math.max(item.difference, -item.difference),
                previousStock: item.expectedStock,
                newStock: item.actualStock,
                reason: `Sayim farki: ${item.difference > 0 ? "+" : ""}${
                  item.difference
                }`,
                createdBy: currentUser?.name || "Sistem",
                createdAt: new Date(),
              },
              ...mvs,
            ])
          }
        })
        setInventoryCounts((prev) =>
          prev.map((ic) =>
            ic.id === countId ? { ...ic, status: "completed" as const } : ic,
          ),
        )
      }
    },
    [inventoryCounts, currentUser, token],
  )

  const updateCompletedOrder = useCallback(
    async (
      completedId: string,
      body: CompletedOrderUpdateBody,
      meta: { previousNet: number; previousMethod: PaymentMethod },
    ): Promise<ClosedTable | null> => {
      if (!token) return null
      try {
        const updated = await api.completedOrders.update(token, completedId, body)
        const mapped = mapCompletedOrderDtoToClosedTable(updated)
        setClosedTables((prev) => prev.map((c) => (c.id === completedId ? mapped : c)))
        const delta = mapped.netAmount - meta.previousNet
        if (
          delta !== 0 &&
          meta.previousMethod === "nakit" &&
          mapped.payment.method === "nakit" &&
          currentShift
        ) {
          if (delta > 0) {
            await addCashTransaction({
              type: "sale",
              amount: delta,
              description: `${mapped.tableName} — tamamlanan hesap duzeltmesi`,
              reference: mapped.id,
              createdBy: currentUser?.name || "Yonetici",
            })
          } else {
            await addCashTransaction({
              type: "refund",
              amount: Math.abs(delta),
              description: `${mapped.tableName} — tamamlanan hesap duzeltmesi (iade)`,
              reference: mapped.id,
              createdBy: currentUser?.name || "Yonetici",
            })
          }
        }
        return mapped
      } catch (e) {
        console.error(e)
        return null
      }
    },
    [token, currentShift, currentUser?.name, addCashTransaction],
  )

  // ========== OPEN ACCOUNTS ==========
  const addOpenAccount = useCallback(
    (
      a: Omit<OpenAccount, "id" | "createdAt" | "status" | "paidAt" | "items" | "payments"> & {
        items?: OpenAccountCreateLine[]
      },
    ) => {
      if (!token) {
        const lines = a.items?.filter((it) => (it.productName || "").trim()) ?? []
        const fromLines = lines.length > 0
          ? lines.reduce((s, it) => s + Math.max(1, Math.floor(Number(it.quantity) || 1)) * Number(it.price || 0), 0)
          : 0
        const amount = lines.length > 0 ? fromLines : a.amount
        const description =
          lines.length > 0 ? (a.description?.trim() || "Adisyon") : a.description
        const items: OpenAccount["items"] =
          lines.length > 0
            ? lines.map((it, idx) => ({
                id: genId(`oal-${idx}`),
                productId: it.productId,
                productName: (it.productName || "").trim(),
                quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
                price: Number(it.price),
                note: it.note,
              }))
            : undefined
        setOpenAccounts((prev) => [
          ...prev,
          {
            ...a,
            amount,
            description,
            items,
            payments: [],
            id: genId("oa"),
            createdAt: new Date(),
            status: "open",
          },
        ])
        return
      }
      api.openAccounts
        .create(token, {
          customerName: a.customerName,
          customerPhone: a.customerPhone,
          amount: a.items?.length ? undefined : a.amount,
          description: a.items?.length ? a.description || undefined : a.description,
          createdBy: a.createdBy,
          items: a.items?.length
            ? a.items.map((it) => ({
                productName: it.productName,
                quantity: it.quantity,
                price: it.price,
                productId: it.productId,
                note: it.note,
              }))
            : undefined,
        })
        .then((created) => {
          setOpenAccounts((prev) => [...prev, mapOpenAccountDtoToPanel(created)])
          logActivity({
            action: "open_account_created",
            category: "payment",
            details: `Veresiye hesap olusturuldu: ${created.customerName}`,
            metadata: { accountId: created.id, amount: created.amount },
          })
        })
        .catch(console.error)
    },
    [token, logActivity],
  )
  const payOpenAccount = useCallback(
    (id: string, amount: number) => {
      if (!token) {
        setOpenAccounts((prev) =>
          prev.map((a) => {
            if (a.id !== id) return a
            const totalPaid = (a.paidAmount || 0) + amount
            const status = totalPaid >= a.amount ? ("paid" as const) : ("partial" as const)
            const payRow: NonNullable<OpenAccount["payments"]>[0] = {
              id: genId("oap"),
              amount,
              receivedBy: currentUser?.name || "Sistem",
              receivedByUserId: currentUser?.id,
              createdAt: new Date(),
            }
            return {
              ...a,
              paidAmount: totalPaid,
              status,
              paidAt: status === "paid" ? new Date() : undefined,
              payments: [...(a.payments ?? []), payRow],
            }
          }),
        )
        return
      }
      api.openAccounts
        .pay(token, id, amount)
        .then((updated) => {
          setOpenAccounts((prev) => prev.map((a) => (a.id === updated.id ? mapOpenAccountDtoToPanel(updated) : a)))
          logActivity({
            action: "open_account_payment_received",
            category: "payment",
            details: `Veresiye tahsilat alindi: ${updated.customerName} - ${amount}`,
            metadata: { accountId: id, amount },
          })
        })
        .catch(console.error)
    },
    [token, currentUser?.name, currentUser?.id, logActivity],
  )

  // ========== NOTIFICATIONS ==========
  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }, [])
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])
  const addNotification = useCallback((n: Omit<PanelNotification, "id" | "createdAt" | "read">) => {
    setNotifications((prev) => [{ ...n, id: genId("n"), createdAt: new Date(), read: false }, ...prev])
  }, [])

  // ========== AUDIT LOG ==========
  // addAuditLog is declared near sync hooks so all actions can reuse it.

  // ========== BRANCHES ==========
  const switchBranch = useCallback((id: string) => {
    setBranches((prev) => prev.map((b) => ({ ...b, isCurrent: b.id === id })))
    logActivity({ action: "branch_switched", category: "settings", details: `Sube degistirildi: ${id}`, metadata: { branchId: id } })
  }, [logActivity])
  const addBranch = useCallback((b: Omit<Branch, "id">) => {
    setBranches((prev) => [...prev, { ...b, id: genId("br") }])
    logActivity({ action: "branch_created", category: "settings", details: `Sube eklendi: ${b.name}` })
  }, [logActivity])
  const updateBranch = useCallback((id: string, data: Partial<Branch>) => {
    setBranches((prev) => prev.map((b) => b.id === id ? { ...b, ...data } : b))
    logActivity({ action: "branch_updated", category: "settings", details: `Sube guncellendi: ${id}`, metadata: { branchId: id, fields: Object.keys(data) } })
  }, [logActivity])

  // ========== PRINTERS ==========
  const addPrinter = useCallback((p: Omit<PrinterConfig, "id">) => {
    if (token) {
      api.technical.createPrinter(token, {
        name: p.name,
        type: p.type,
        connection: p.connection,
        ipAddress: p.ipAddress,
        port: p.port,
        department: p.department,
        paperWidth: p.paperWidth,
        autoCut: p.autoCut,
      }).then((created) => {
        setPrinters((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            type: created.type,
            connection: created.connection,
            ipAddress: created.ipAddress ?? undefined,
            port: created.port ?? undefined,
            department: created.department ?? undefined,
            status: created.status,
            paperWidth: created.paperWidth,
            autoCut: created.autoCut,
          },
        ])
        logActivity({
          action: "printer_created",
          category: "settings",
          details: `Yazici eklendi: ${created.name}`,
          metadata: { printerId: created.id, type: created.type, connection: created.connection },
        })
      }).catch(console.error)
    } else {
      setPrinters((prev) => [...prev, { ...p, id: genId("pr") }])
      logActivity({
        action: "printer_created",
        category: "settings",
        details: `Yazici eklendi: ${p.name}`,
        metadata: { type: p.type, connection: p.connection },
      })
    }
  }, [token, logActivity])

  const updatePrinter = useCallback((id: string, data: Partial<PrinterConfig>) => {
    setPrinters((prev) => prev.map((p) => p.id === id ? { ...p, ...data } : p))
    logActivity({
      action: "printer_updated",
      category: "settings",
      details: `Yazici guncellendi: ${id}`,
      metadata: { printerId: id, fields: Object.keys(data) },
    })
    if (!token) return
    api.technical.updatePrinter(token, id, {
      name: data.name,
      type: data.type,
      connection: data.connection,
      ipAddress: data.ipAddress ?? null,
      port: data.port ?? null,
      department: data.department ?? null,
      status: data.status,
      paperWidth: data.paperWidth,
      autoCut: data.autoCut,
    }).catch(console.error)
  }, [token, logActivity])

  const deletePrinter = useCallback((id: string) => {
    setPrinters((prev) => prev.filter((p) => p.id !== id))
    logActivity({ action: "printer_deleted", category: "settings", details: `Yazici silindi: ${id}`, metadata: { printerId: id } })
    if (!token) return
    api.technical.deletePrinter(token, id).catch(console.error)
  }, [token, logActivity])

  const testPrinter = useCallback((id: string) => {
    const pr = printers.find((p) => p.id === id)
    if (!pr || !token) return
    // No real test endpoint here, so for now we only mark the status as online.
    setPrinters((prev) => prev.map((p) => p.id === id ? { ...p, status: "online" } : p))
    logActivity({ action: "printer_tested", category: "settings", details: `Yazici test edildi: ${pr.name}`, metadata: { printerId: id } })
  }, [printers, token, logActivity])
  
  // ========== PRINTER DEPARTMENTS ==========
  const addPrinterDepartment = useCallback((pd: Omit<PrinterDepartment, "id">) => { 
    setPrinterDepartments((prev) => [...prev, { ...pd, id: genId("pd") }]) 
  }, [])
  const updatePrinterDepartment = useCallback((id: string, data: Partial<PrinterDepartment>) => { 
    setPrinterDepartments((prev) => prev.map((pd) => pd.id === id ? { ...pd, ...data } : pd)) 
  }, [])
  const deletePrinterDepartment = useCallback((id: string) => { 
    setPrinterDepartments((prev) => prev.filter((pd) => pd.id !== id)) 
  }, [])
  
  // ========== BACKUPS ==========
  const createBackup = useCallback(() => {
    if (token) {
      api.technical.createBackup(token, {
        type: "manual",
        notes: "Manuel yedekleme",
      }).then((b) => {
        setBackups((prev) => [
          {
            id: b.id,
            type: b.type,
            size: b.size,
            createdAt: new Date(b.createdAt),
            status: b.status,
            notes: b.notes ?? undefined,
          },
          ...prev,
        ])
        logActivity({
          action: "backup_created",
          category: "settings",
          details: `Manuel yedek alindi (${b.size})`,
          metadata: { backupId: b.id, status: b.status, size: b.size },
        })
      }).catch(console.error)
    } else {
      setBackups((prev) => [{ id: genId("bk"), type: "manual", size: "12.6 MB", createdAt: new Date(), status: "success", notes: "Manuel yedekleme" }, ...prev])
      logActivity({
        action: "backup_created",
        category: "settings",
        details: "Manuel yedek alindi",
      })
    }
  }, [token, logActivity])

  // ========== DISCOUNT ==========
  const applyDiscount = useCallback((tableId: string, discount: { type: "percent" | "amount" | "ikram"; value: number; reason: string }) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const rawTotal = orders
      .filter((o) => o.tableId === tableId && o.status === "active")
      .reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0)
    let discountAmount = 0
    if (discount.type === "percent") {
      discountAmount = Math.round(rawTotal * discount.value / 100)
    } else if (discount.type === "amount") {
      discountAmount = Math.min(discount.value, rawTotal)
    } else if (discount.type === "ikram") {
      discountAmount = rawTotal
    }
    setTables((prev) => prev.map((t) => t.id === tableId ? {
      ...t,
      discount: { type: discount.type, value: discount.value, amount: discountAmount, reason: discount.reason },
      totalAmount: Math.max(0, rawTotal - discountAmount),
    } : t))
    addAuditLog({
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "Sistem",
      action: "discount_applied",
      category: "payment",
      details: `${table.name}: ${discount.type === "percent" ? `%${discount.value}` : discount.type === "ikram" ? "Tam Ikram" : `${discount.value} TL`} indirim uygulandi. Neden: ${discount.reason}`,
    })
  }, [tables, orders, currentUser, addAuditLog])

  const clearDiscount = useCallback((tableId: string) => {
    const rawTotal = orders
      .filter((o) => o.tableId === tableId && o.status === "active")
      .reduce((sum, o) => sum + o.items.filter(itemCountsTowardBill).reduce((s, i) => s + i.price * i.quantity, 0), 0)
    const table = tables.find((t) => t.id === tableId)
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, discount: undefined, totalAmount: rawTotal } : t)))
    if (table) {
      addAuditLog({
        userId: currentUser?.id || "system",
        userName: currentUser?.name || "Sistem",
        action: "discount_cleared",
        category: "payment",
        details: `${table.name}: Indirim kaldirildi`,
      })
    }
  }, [orders, tables, currentUser, addAuditLog])

  // ========== SPLIT BILL ==========
  const splitBillByPerson = useCallback((tableId: string, personCount: number) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    // Store split info for payment processing
    setTables((prev) => prev.map((t) => t.id === tableId ? {
      ...t,
      splitInfo: { type: "person", personCount, perPersonAmount: Math.ceil((t.totalAmount || 0) / personCount) }
    } : t))
    addAuditLog({
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "Sistem",
      action: "bill_split",
      category: "payment",
      details: `${table.name}: Hesap ${personCount} kisiye bolundu`,
    })
  }, [tables, currentUser, addAuditLog])

  const splitBillByItems = useCallback((tableId: string, itemIds: string[], amounts: Record<string, number>) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const tableOrders = orders.filter((o) => o.tableId === tableId && o.status === "active")
    const allItems = tableOrders.flatMap((o) => o.items.filter(itemCountsTowardBill))
    const selectedTotal = Object.entries(amounts).reduce((sum, [itemId, qty]) => {
      const item = allItems.find((i) => i.id === itemId)
      return sum + (item ? item.price * qty : 0)
    }, 0)
    // Store split info for payment processing
    setTables((prev) => prev.map((t) => t.id === tableId ? {
      ...t,
      splitInfo: { type: "items", itemIds, amounts, selectedTotal }
    } : t))
    addAuditLog({
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "Sistem",
      action: "bill_split_items",
      category: "payment",
      details: `${table.name}: ${itemIds.length} urun ayri hesaba ayrildi. Tutar: ${selectedTotal} TL`,
    })
  }, [tables, orders, currentUser, addAuditLog])

  // ========== CLEAR NOTIFICATIONS ==========
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // ========== CAMPAIGNS ==========
  const addCampaign = useCallback((c: Omit<Campaign, "id" | "createdAt" | "order">) => {
    if (!token) {
      setCampaigns((prev) => [...prev, { ...c, id: genId("camp"), createdAt: new Date(), order: prev.length + 1 }])
      return
    }
    api.campaigns.create(token, {
      title: c.title,
      description: c.description,
      imageUrl: c.image,
      discountPercent: c.discountPercent,
      originalPrice: c.originalPrice,
      discountedPrice: c.discountedPrice,
      validUntil: c.validUntil ? c.validUntil.toISOString() : undefined,
      isActive: c.isActive,
    }).then((created) => {
      setCampaigns((prev) => [...prev, {
        id: created.id,
        title: created.title,
        description: created.description ?? undefined,
        image: created.imageUrl,
        discountPercent: created.discountPercent ?? undefined,
        originalPrice: created.originalPrice != null ? Number(created.originalPrice) : undefined,
        discountedPrice: created.discountedPrice != null ? Number(created.discountedPrice) : undefined,
        validUntil: created.validUntil ? new Date(created.validUntil) : undefined,
        isActive: created.isActive,
        order: created.order,
        createdAt: new Date(created.createdAt),
      }])
      logActivity({
        action: "campaign_created",
        category: "settings",
        details: `Kampanya eklendi: ${created.title}`,
        metadata: { campaignId: created.id, isActive: created.isActive },
      })
    }).catch(console.error)
  }, [token, logActivity])
  const updateCampaign = useCallback((id: string, data: Partial<Campaign>) => {
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, ...data } : c))
    logActivity({
      action: "campaign_updated",
      category: "settings",
      details: `Kampanya guncellendi: ${id}`,
      metadata: { campaignId: id, fields: Object.keys(data) },
    })
    if (!token) return
    api.campaigns.update(token, id, {
      title: data.title,
      description: data.description,
      imageUrl: data.image,
      discountPercent: data.discountPercent,
      originalPrice: data.originalPrice,
      discountedPrice: data.discountedPrice,
      validUntil: data.validUntil ? data.validUntil.toISOString() : undefined,
      isActive: data.isActive,
    }).catch(console.error)
  }, [token, logActivity])
  const deleteCampaign = useCallback((id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    logActivity({ action: "campaign_deleted", category: "settings", details: `Kampanya silindi: ${id}`, metadata: { campaignId: id } })
    if (!token) return
    api.campaigns.delete(token, id).catch(console.error)
  }, [token, logActivity])
  const reorderCampaigns = useCallback((ids: string[]) => {
    setCampaigns((prev) => ids.map((id, i) => ({ ...prev.find((c) => c.id === id)!, order: i + 1 })))
    logActivity({
      action: "campaigns_reordered",
      category: "settings",
      details: `Kampanya sirasi guncellendi (${ids.length} adet)`,
      metadata: { ids },
    })
    if (!token) return
    api.campaigns.reorder(token, ids).catch(console.error)
  }, [token, logActivity])

  const reorderCategories = useCallback((ids: string[], parentId?: string | null) => {
    setCategories((prev) =>
      prev.map((c) => {
        const idx = ids.indexOf(c.id)
        if (idx === -1) return c
        return { ...c, order: idx + 1 }
      }),
    )
    if (!token) return
    const body: { ids: string[]; parentId?: string | null } = { ids }
    if (parentId !== undefined) body.parentId = parentId
    logActivity({
      action: "categories_reordered",
      category: "product",
      details: `Kategori sirasi guncellendi (${ids.length} adet)`,
      metadata: { ids, parentId },
    })
    api.categories.reorder(token, body).catch(console.error)
  }, [token, logActivity])

  const reorderProducts = useCallback((ids: string[]) => {
    setProducts((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]))
      const reordered: PanelProduct[] = []
      ids.forEach((id, index) => {
        const p = map.get(id)
        if (p) {
          reordered.push({ ...p, order: index + 1 })
          map.delete(id)
        }
      })
      return [...reordered, ...Array.from(map.values())]
    })
    if (!token) return
    logActivity({
      action: "products_reordered",
      category: "product",
      details: `Urun sirasi guncellendi (${ids.length} adet)`,
      metadata: { ids },
    })
    api.products.reorder(token, ids).catch(console.error)
  }, [token, logActivity])

  return (
    <PanelContext.Provider value={{
      currentUser, users, sections, categories, products, tables, orders,
      closedTables, cancelledItems, dailyReport, settings,
      stockMaterials, suppliers, stockMovements, purchaseOrders, inventoryCounts,
      cashShifts, cashTransactions, openAccounts, ledgerCustomers, currentShift,
      notifications, auditLogs, branches, printers, backups,
      periodReports, productTrends, hourlyDensity, campaigns,
      setCurrentUser, getTableOrders, getTableTotal, moveTable, moveOrderItems,
      closeTableWithPayment, addQuickSale, createTableOrder, cancelOrderItem, assignItemsToLedger, revertLedgerOrderItem,
      addProduct, updateProduct, deleteProduct,
      addCategory, updateCategory, deleteCategory,
      addUser, updateUser, deleteUser,
      addSection, updateSection, deleteSection,
      addTable, deleteTable, updateSettings, reprintReceipt, updateCompletedOrder,
      addMaterial, updateMaterial, deleteMaterial, addStockMovement, setProductIngredients, deductStockForOrder,
      addSupplier, updateSupplier, deleteSupplier,
      addPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder,
      startInventoryCount, updateInventoryItem, completeInventoryCount,
      openShift, closeShift, addCashTransaction,
      addOpenAccount, payOpenAccount,
      ledgerRefresh, createLedgerCustomer, addLedgerPayment,
      markNotificationRead, markAllNotificationsRead, addNotification,
      addAuditLog, switchBranch, addBranch, updateBranch,
  addPrinter, updatePrinter, deletePrinter, testPrinter,
  printerDepartments, addPrinterDepartment, updatePrinterDepartment, deletePrinterDepartment,
  createBackup,
      applyDiscount, clearDiscount, splitBillByPerson, splitBillByItems, clearAllNotifications,
      addCampaign, updateCampaign, deleteCampaign, reorderCampaigns, reorderCategories, reorderProducts,
    }}>
      {children}
    </PanelContext.Provider>
  )
}
