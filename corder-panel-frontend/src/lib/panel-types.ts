// ==========================================
// Corder Management Panel - Type Definitions
// ==========================================

export type PanelUserRole = "manager" | "cashier" | "waiter"
export type PanelViewId = "dashboard" | "tables" | "cash-register" | "quick-sale" | "live-orders" | "products" | "campaigns" | "stock" | "reports" | "users" | "settings" | "technical"
export type PanelDiscountType = "percent" | "amount" | "complimentary"
export type CloseCheckPaymentMethod = "cash" | "credit-card" | "meal-card" | "multinet" | "split" | "ledger"
export type PanelPaymentMethod = CloseCheckPaymentMethod
export type PaymentMethod = PanelPaymentMethod
export type CloseCheckSplitMethod = "cash" | "credit-card" | "meal-card" | "multinet" | "ledger"

export interface PanelUser {
  id: string
  name: string
  role: PanelUserRole | "root"
  email?: string
  phone?: string
  pin?: string
  active: boolean
  createdAt: Date
  isRoot?: boolean
}

export interface PanelCategory {
  id: string
  name: string
  slug: string
  order: number
  parentId?: string | null
  showInTerminal: boolean
  showInMenu: boolean
  showInQuickSale: boolean
}

export interface ProductIngredient {
  materialId: string
  materialName: string
  quantity: number
  unit: string
}

export interface PanelProduct {
  id: string
  name: string
  price: number
  categoryId: string
  image?: string
  inStock: boolean
  order?: number
  description?: string
  costPrice?: number
  ingredients?: ProductIngredient[]
}

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
  userName?: string
  items: PanelOrderItem[]
  status: "active" | "closed" | "cancelled"
  createdAt: Date
  updatedAt: Date
  mergedFrom?: string
}

export function itemCountsTowardBill(i: { status: string }): boolean {
  return i.status !== "cancelled" && i.status !== "ledger"
}

export function itemIsLedgerLike(i: PanelOrderItem): boolean {
  if (i.status === "ledger") return true
  const r = (i.cancelReason ?? "").trim()
  return i.status === "cancelled" && (r === "Assigned to ledger" || r.startsWith("Cari"))
}

export type PanelTableStatus = "empty" | "occupied" | "ordering" | "checkout"

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
  discount?: { type: PanelDiscountType; value: number; amount: number; reason: string }
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

export interface Payment {
  id: string
  tableId: string
  tableName: string
  orderIds: string[]
  amount: number
  method: PanelPaymentMethod
  splitDetails?: { method: string; amount: number }[]
  discount?: { type: "percent" | "amount"; value: number; reason: string }
  tip?: number
  processedBy: string
  createdAt: Date
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
  items?: OpenAccountLine[]
  payments?: OpenAccountPayment[]
}

export type OpenAccountCreateLine = Pick<OpenAccountLine, "productName" | "quantity" | "price" | "productId" | "note">

export interface LedgerCustomer {
  id: string
  name: string
  phone?: string
  notes?: string
  balance: number
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
  totalCash: number
  totalCard: number
  totalMealCard: number
  totalMultinet: number
  transactionCount: number
  notes?: string
}

export type PanelCashShift = CashShift

export interface CashTransaction {
  id: string
  shiftId: string
  type: "sale" | "expense" | "cash-in" | "cash-out" | "refund"
  amount: number
  method?: PanelPaymentMethod
  description: string
  reference?: string
  createdBy: string
  createdAt: Date
}

export interface CancelledItem {
  id: string
  orderItem: PanelOrderItem
  tableName: string
  orderId: string
  reason: string
  cancelledBy: string
  cancelledAt: Date
}

export interface StockMaterial {
  id: string
  name: string
  unit: "kg" | "lt" | "adet" | "gr" | "ml" | "paket" | "koli"
  currentStock: number
  minStock: number
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

export interface PanelNotification {
  id: string
  type: "new-order" | "order-ready" | "stock-low" | "shift-reminder" | "system" | "kitchen-alert"
  title: string
  message: string
  read: boolean
  actionUrl?: string
  createdAt: Date
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  category: "auth" | "order" | "payment" | "product" | "user" | "settings" | "stock" | "cash-register" | "table"
  details: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface Branch {
  id: string
  name: string
  address?: string
  phone?: string
  isActive: boolean
  isCurrent: boolean
}

export interface PrinterConfig {
  id: string
  name: string
  type: string
  connection: "usb" | "network" | "bluetooth"
  ipAddress?: string
  port?: number
  department?: string
  status: "online" | "offline" | "error"
  paperWidth: 58 | 80
  autoCut: boolean
}

export interface PrinterDepartment {
  id: string
  name: string
  code: string
  color?: string
}

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

export interface PeriodReport {
  period: string
  periodLabel: string
  totalRevenue: number
  totalOrders: number
  totalTables: number
  avgOrderValue: number
  cancelledAmount: number
  discountAmount: number
  comparisonRevenue?: number
  comparisonChange?: number
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

export interface RestaurantSettings {
  name: string
  address?: string
  phone?: string
  taxId?: string
  currency: string
  currencySymbol: string
  receiptFooter?: string
  receiptHeader?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  website?: string
  workingHours?: string
  fontSize?: "small" | "medium" | "large"
  tableCardSize?: "compact" | "normal" | "large"
  showProductImages?: boolean
  sidebarCollapsed?: boolean
  quickActionsEnabled?: boolean
}

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
