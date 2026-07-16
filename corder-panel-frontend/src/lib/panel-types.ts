// ==========================================
// Corder Management Panel - Type Definitions
// Comprehensive restaurant management system
// ==========================================

// ---- AUTH & USERS ----
export interface PanelUser {
  id: string
  name: string
  role: "garson" | "mudur" | "kasiyer" | "root"
  email?: string
  phone?: string
  /** Numeric PIN (4–8 digits) for terminal “next step” user selection; only from Panel. */
  pin?: string
  active: boolean
  createdAt: Date
  isRoot?: boolean // Root user cannot be edited or deleted from panel
}

// ---- CATEGORIES & PRODUCTS ----
export interface PanelCategory {
  id: string
  name: string
  slug: string
  order: number
  /** Empty or missing = root category */
  parentId?: string
  showInTerminal: boolean // Show in terminal?
  showInMenu: boolean     // Show in menu?
  showInQuickSale: boolean // Show in quick sale?
}

export interface ProductIngredient {
  materialId: string
  materialName: string
  quantity: number // amount used per product
  unit: string
}

export interface PanelProduct {
  id: string
  name: string
  price: number
  categoryId: string
  image?: string
  inStock: boolean
  description?: string
  costPrice?: number // cost price
  ingredients?: ProductIngredient[] // linked stock materials
}

// ---- ORDERS ----
export interface PanelOrderItem {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: "pending" | "sent" | "preparing" | "ready" | "served" | "cancelled" | "ledger"
  cancelReason?: string
  cancelledBy?: string
  cancelledAt?: Date
  createdAt: Date
  sentAt?: Date
}

export interface PanelOrder {
  id: string
  tableId: string
  userId: string
  /** API userName: display when register/admin user is not in staff. */
  userName?: string
  items: PanelOrderItem[]
  status: "active" | "closed" | "cancelled"
  createdAt: Date
  updatedAt: Date
  mergedFrom?: string
}

/** Lines included in table check, splits, and receipts (excludes cancelled and ledger-assigned). */
export function itemCountsTowardBill(i: { status: string }): boolean {
  return i.status !== "cancelled" && i.status !== "ledger"
}

/** Ledger-assigned, or legacy cancelled + marked 'Assigned to ledger'. */
export function itemIsLedgerLike(i: PanelOrderItem): boolean {
  if (i.status === "ledger") return true
  const r = (i.cancelReason ?? "").trim()
  if (i.status === "cancelled" && (r === "Cariye atildi" || r.includes("Cariye"))) return true
  return false
}

// ---- TABLES ----
export type PanelTableStatus = "empty" | "occupied" | "ordering"

export interface PanelTable {
  id: string
  name: string
  section: string
  status: PanelTableStatus
  activeOrderId?: string
  waiter?: string
  totalAmount: number
  orderCount: number
  lastUpdated?: Date
  discount?: {
    type: "percent" | "amount" | "ikram"
    value: number
    amount: number
    reason: string
  }
  splitInfo?: {
    type: "person" | "items"
    personCount?: number
    perPersonAmount?: number
    itemIds?: string[]
    amounts?: Record<string, number>
    selectedTotal?: number
  }
}

export interface PanelSection {
  id: string
  name: string
}

// ---- PAYMENTS ----
export type PaymentMethod = "nakit" | "kredi-karti" | "yemek-karti" | "multinet" | "coklu" | "cari"

export interface Payment {
  id: string
  tableId: string
  tableName: string
  orderIds: string[]
  amount: number
  method: PaymentMethod
  splitDetails?: { method: string; amount: number }[]
  discount?: { type: "percent" | "amount"; value: number; reason: string }
  tip?: number
  processedBy: string
  createdAt: Date
  /** Customer charged on `cari` payment (snapshot). */
  ledgerCustomerId?: string
  ledgerCustomerName?: string
}

export interface ClosedTable {
  id: string
  tableName: string
  section: string
  waiter: string
  orders: PanelOrder[]
  payment: Payment
  totalAmount: number
  discountAmount: number
  netAmount: number
  closedBy: string
  openedAt: Date
  closedAt: Date
}

// ---- OPEN ACCOUNTS (On account / credit) ----
export interface OpenAccountLine {
  id: string
  productId?: string
  productName: string
  quantity: number
  price: number
  note?: string
}

export interface OpenAccountPayment {
  id: string
  amount: number
  receivedBy: string
  receivedByUserId?: string
  note?: string
  createdAt: Date
}

export interface OpenAccount {
  id: string
  customerName: string
  customerPhone?: string
  amount: number
  description: string
  tableInfo?: string
  createdBy: string
  createdAt: Date
  paidAt?: Date
  status: "open" | "paid" | "partial"
  paidAmount?: number
  /** Check lines (API). */
  items?: OpenAccountLine[]
  /** Partial payments; `receivedBy` is the staff who collected. */
  payments?: OpenAccountPayment[]
}

/** Lines when creating an open account (no id). */
export type OpenAccountCreateLine = Pick<OpenAccountLine, "productName" | "quantity" | "price" | "productId" | "note">

// ---- LEDGER (on-account customer card + movements) ----
export interface LedgerCustomer {
  id: string
  name: string
  phone?: string
  notes?: string
  balance: number
  /** Period net movement when the register date filter is on. */
  periodNet?: number
  createdAt: Date
}

export interface LedgerEntry {
  id: string
  entryType: "debt" | "payment" | "credit"
  amount: number
  description: string
  tableId?: string
  tableName?: string
  completedOrderId?: string
  receivedBy?: string
  receivedByUserId?: string
  createdAt: Date
}

// ---- KASA (Cash Register) ----
export interface CashShift {
  id: string
  openedBy: string
  closedBy?: string
  openedAt: Date
  closedAt?: Date
  openingBalance: number
  closingBalance?: number
  expectedBalance?: number
  status: "open" | "closed"
  cashIn: number
  cashOut: number
  totalRevenue: number
  totalNakit: number
  totalKart: number
  totalYemekKarti: number
  totalMultinet: number
  transactionCount: number
  notes?: string
}

export interface CashTransaction {
  id: string
  shiftId: string
  type: "sale" | "expense" | "cash-in" | "cash-out" | "refund"
  amount: number
  method?: PaymentMethod
  description: string
  reference?: string // e.g. payment id, table name
  createdBy: string
  createdAt: Date
}

// ---- CANCELLATIONS ----
export interface CancelledItem {
  id: string
  orderItem: PanelOrderItem
  tableName: string
  orderId: string
  reason: string
  cancelledBy: string
  cancelledAt: Date
}

// ---- STOCK & MATERIALS ----
export interface StockMaterial {
  id: string
  name: string
  unit: "kg" | "lt" | "adet" | "gr" | "ml" | "paket" | "koli"
  currentStock: number
  minStock: number // alert when below this
  costPerUnit: number
  supplierId?: string
  category: string
  lastUpdated: Date
}

export interface Supplier {
  id: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  active: boolean
}

export interface StockMovement {
  id: string
  materialId: string
  materialName: string
  type: "in" | "out" | "waste" | "count-adjustment"
  quantity: number
  previousStock: number
  newStock: number
  unitCost?: number
  totalCost?: number
  supplierId?: string
  reason?: string
  createdBy: string
  createdAt: Date
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  supplierName: string
  items: { materialId: string; materialName: string; quantity: number; unitCost: number }[]
  totalAmount: number
  status: "draft" | "ordered" | "received" | "cancelled"
  notes?: string
  createdBy: string
  createdAt: Date
  receivedAt?: Date
}

export interface InventoryCount {
  id: string
  date: Date
  countedBy: string
  items: { materialId: string; materialName: string; expectedStock: number; actualStock: number; difference: number }[]
  status: "in-progress" | "completed"
  notes?: string
}

// ---- NOTIFICATIONS ----
export interface PanelNotification {
  id: string
  type: "new-order" | "order-ready" | "stock-low" | "shift-reminder" | "system" | "kitchen-alert"
  title: string
  message: string
  read: boolean
  actionUrl?: string
  createdAt: Date
}

// ---- AUDIT LOG ----
export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  category: "auth" | "order" | "payment" | "product" | "user" | "settings" | "stock" | "kasa" | "table"
  details: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ---- MULTI-BRANCH ----
export interface Branch {
  id: string
  name: string
  address?: string
  phone?: string
  isActive: boolean
  isCurrent: boolean
}

// ---- PRINTER ----
export interface PrinterConfig {
  id: string
  name: string
  type: string // dynamic printer type from printerDepartments
  connection: "usb" | "network" | "bluetooth"
  ipAddress?: string
  port?: number
  department?: string // which kitchen department
  status: "online" | "offline" | "error"
  paperWidth: 58 | 80
  autoCut: boolean
}

// ---- PRINTER DEPARTMENT ----
export interface PrinterDepartment {
  id: string
  name: string // e.g. "Cash Register Printer", "Kitchen Printer", "Bar Printer"
  code: string // e.g. "thermal", "kitchen", "bar"
  color?: string // optional color for UI
}

// ---- DAILY REPORT ----
export interface DailyReport {
  date: string
  totalRevenue: number
  totalOrders: number
  totalTables: number
  cancelledItems: CancelledItem[]
  cancelledAmount: number
  discountAmount: number
  paymentBreakdown: { method: string; total: number; count: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  waiterPerformance: { name: string; tables: number; revenue: number; orders: number }[]
  hourlyRevenue: { hour: string; revenue: number; orders: number }[]
}

// ---- ADVANCED REPORTS ----
export interface PeriodReport {
  period: string // e.g. "2026-02-W08", "2026-02", "2026"
  periodLabel: string
  totalRevenue: number
  totalOrders: number
  totalTables: number
  avgOrderValue: number
  cancelledAmount: number
  discountAmount: number
  comparisonRevenue?: number // previous period for comparison
  comparisonChange?: number // percentage change
}

export interface ProductTrend {
  productName: string
  data: { period: string; quantity: number; revenue: number }[]
}

export interface HourlyDensity {
  hour: string
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
  average: number
}

// ---- SETTINGS ----
export interface RestaurantSettings {
  name: string
  address?: string
  phone?: string
  taxId?: string
  currency: string
  currencySymbol: string
  receiptFooter?: string
  receiptHeader?: string
  // Social & Contact
  whatsapp?: string
  instagram?: string
  facebook?: string
  website?: string
  workingHours?: string
  // Display customization
  fontSize?: "small" | "medium" | "large"
  tableCardSize?: "compact" | "normal" | "large"
  showProductImages?: boolean
  sidebarCollapsed?: boolean
  quickActionsEnabled?: boolean
}

// ---- BACKUP ----
export interface BackupRecord {
  id: string
  type: "auto" | "manual"
  size: string
  createdAt: Date
  status: "success" | "failed"
  notes?: string
}

// ---- CAMPAIGNS ----
export interface Campaign {
  id: string
  title: string
  description?: string
  image: string
  originalPrice?: number
  discountedPrice?: number
  discountPercent?: number
  validUntil?: Date
  isActive: boolean
  order: number
  createdAt: Date
}
