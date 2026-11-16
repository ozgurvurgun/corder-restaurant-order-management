import { createContext, useContext } from "react"
import type {
  AuditLog,
  Branch,
  Campaign,
  CancelledItem,
  CashShift,
  CashTransaction,
  CloseCheckSplitMethod,
  ClosedTable,
  DailyReport,
  HourlyDensity,
  InventoryCount,
  LedgerCustomer,
  OpenAccount,
  OpenAccountCreateLine,
  PanelCategory,
  PanelDiscountType,
  PanelNotification,
  PanelOrder,
  PanelPaymentMethod,
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
} from "../panel-types"
import type { CompletedOrderUpdateBody } from "../api"

export type StockMovementInput = Omit<
  StockMovement,
  "id" | "createdAt" | "previousStock" | "newStock"
>

export type LogActivityFn = (entry: {
  action: string
  category: AuditLog["category"]
  details: string
  metadata?: Record<string, unknown>
}) => void

export interface PanelStore {
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
  printerDepartments: PrinterDepartment[]

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
  moveOrderItems: (
    fromTableId: string,
    toTableId: string,
    itemIds: string[],
  ) => Promise<boolean>

  // Payment & close
  closeTableWithPayment: (
    tableId: string,
    method: PanelPaymentMethod,
    discount?: { type: PanelDiscountType; value: number; reason: string },
    splitDetails?: {
      method: CloseCheckSplitMethod
      amount: number
    }[],
    opts?: {
      ledgerCustomerId?: string
      ledgerDebtAmount?: number
      tip?: number
      lines?: { itemId: string; quantity: number }[]
    },
  ) => Promise<{
    ok: boolean
    completedOrder?: ClosedTable
    tableFullyClosed?: boolean
    error?: string
  }>

  // Quick Sale (Walk-in)
  addQuickSale: (
    items: { productId: string; quantity: number; note?: string }[],
    paymentMethod: PanelPaymentMethod,
  ) => Promise<{ ok: boolean; completedOrder?: ClosedTable; error?: string }>

  createTableOrder: (
    tableId: string,
    items: { productId: string; quantity: number; note?: string }[],
  ) => Promise<{ ok: boolean; error?: string }>

  // Cancel & Ledger
  cancelOrderItem: (orderId: string, itemId: string, reason: string) => Promise<boolean>
  assignItemsToLedger: (
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
  ) => Promise<{ ok: boolean; amount?: number }>
  revertLedgerOrderItem: (
    itemId: string,
  ) => Promise<{ ok: boolean; amount?: number }>

  // Products CRUD
  addProduct: (p: Omit<PanelProduct, "id">) => void
  updateProduct: (id: string, data: Partial<PanelProduct>) => void
  deleteProduct: (id: string) => void

  // Category CRUD
  addCategory: (
    name: string,
    opts?: {
      showInTerminal?: boolean
      showInMenu?: boolean
      showInQuickSale?: boolean
      parentId?: string | null
    },
  ) => void
  updateCategory: (id: string, data: Partial<PanelCategory>) => void
  deleteCategory: (id: string) => void

  // Users CRUD
  addUser: (u: Omit<PanelUser, "id" | "createdAt">) => void
  updateUser: (id: string, data: Partial<PanelUser>) => void
  deleteUser: (id: string) => void

  // Sections & Tables CRUD
  addSection: (name: string) => void
  updateSection: (id: string, name: string) => void
  deleteSection: (id: string) => void
  addTable: (name: string, section: string) => void
  deleteTable: (id: string) => void

  // Settings & Receipt
  updateSettings: (s: Partial<RestaurantSettings>) => void
  reprintReceipt: (
    target:
      | string
      | { orderId: string }
      | {
          tableName: string
          waiterName?: string
          items: {
            productName: string
            quantity: number
            price: number
            note?: string
            productId?: string
            categoryId?: string
          }[]
          total: number
        },
  ) => Promise<void>
  updateCompletedOrder: (
    completedId: string,
    body: CompletedOrderUpdateBody,
  ) => Promise<ClosedTable | null>

  // Stock actions
  addMaterial: (m: Omit<StockMaterial, "id" | "lastUpdated">) => void
  updateMaterial: (id: string, data: Partial<StockMaterial>) => void
  deleteMaterial: (id: string) => void
  addStockMovement: (m: StockMovementInput) => Promise<void>
  setProductIngredients: (
    productId: string,
    ingredients: { materialId: string; quantity: number }[],
  ) => void
  addSupplier: (s: Omit<Supplier, "id">) => Promise<boolean>
  updateSupplier: (id: string, data: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  addPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "createdAt">) => void
  updatePurchaseOrder: (id: string, data: Partial<PurchaseOrder>) => void
  receivePurchaseOrder: (id: string) => void
  startInventoryCount: () => void
  updateInventoryItem: (
    countId: string,
    materialId: string,
    actual: number,
  ) => void
  completeInventoryCount: (countId: string) => void

  // Cash register actions
  openShift: (openingBalance: number) => void | Promise<void>
  closeShift: (closingBalance: number, notes?: string) => void | Promise<void>
  addCashTransaction: (t: {
    type: "expense" | "cash-in" | "cash-out" | "refund"
    amount: number
    description: string
    reference?: string
    createdBy?: string
  }) => Promise<boolean>

  // Open Accounts & Ledger
  addOpenAccount: (
    a: Omit<
      OpenAccount,
      "id" | "createdAt" | "status" | "paidAt" | "items" | "payments"
    > & { items?: OpenAccountCreateLine[] },
  ) => void
  payOpenAccount: (id: string, amount: number) => void
  ledgerRefresh: () => Promise<void>
  createLedgerCustomer: (body: {
    name: string
    phone?: string
    notes?: string
  }) => Promise<LedgerCustomer | null>
  addLedgerPayment: (customerId: string, amount: number) => Promise<boolean>

  // Notifications & Audit
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  addNotification: (n: Omit<PanelNotification, "id" | "createdAt" | "read">) => void
  clearAllNotifications: () => void
  addAuditLog: (log: Omit<AuditLog, "id" | "createdAt">) => void

  // Branches & Printers
  switchBranch: (id: string) => void
  addBranch: (b: Omit<Branch, "id">) => void
  updateBranch: (id: string, data: Partial<Branch>) => void
  addPrinter: (p: Omit<PrinterConfig, "id">) => void
  updatePrinter: (id: string, data: Partial<PrinterConfig>) => void
  deletePrinter: (id: string) => void
  testPrinter: (id: string) => void
  addPrinterDepartment: (pd: Omit<PrinterDepartment, "id">) => void
  updatePrinterDepartment: (id: string, data: Partial<PrinterDepartment>) => void
  deletePrinterDepartment: (id: string) => void

  // Discount & Split Bill
  applyDiscount: (
    tableId: string,
    discount: { type: PanelDiscountType; value: number; reason: string },
  ) => void | Promise<void>
  clearDiscount: (tableId: string) => void | Promise<void>
  splitBillByPerson: (tableId: string, personCount: number) => void | Promise<void>
  splitBillByItems: (
    tableId: string,
    itemIds: string[],
    amounts: Record<string, number>,
  ) => void | Promise<void>
  clearSplitBill: (tableId: string) => void | Promise<void>
  payPersonShare: (
    tableId: string,
    shareIndex: number,
    method: CloseCheckSplitMethod,
    amount: number,
    opts?: { ledgerCustomerId?: string },
  ) => Promise<{
    ok: boolean
    fullyClosed?: boolean
    completedOrder?: ClosedTable
    error?: string
  }>

  // Campaigns & Ordering
  addCampaign: (c: Omit<Campaign, "id" | "createdAt" | "order">) => void
  updateCampaign: (id: string, data: Partial<Campaign>) => void
  deleteCampaign: (id: string) => void
  reorderCampaigns: (ids: string[]) => void
  reorderCategories: (ids: string[], parentId?: string | null) => void
  reorderProducts: (ids: string[]) => void
}

export type PanelContextType = PanelStore
export type PanelStoreContextType = PanelStore

export const PanelContext = createContext<PanelStore | null>(null)

export function usePanelStore(): PanelStore {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error("usePanelStore must be used within PanelProvider")
  return ctx
}
