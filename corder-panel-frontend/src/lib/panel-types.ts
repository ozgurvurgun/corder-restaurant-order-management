// ==========================================
// Corder Management Panel - Type Definitions
// ==========================================

export type PanelUserRole =
  | "branch_manager"
  | "shift_supervisor"
  | "cashier"
  | "head_waiter"
  | "waiter"
  | "runner"
  | "inventory_manager"
  | "accountant"
  | "manager"
export type PanelViewId = "dashboard" | "tables" | "cash-register" | "quick-sale" | "live-orders" | "products" | "campaigns" | "stock" | "reports" | "users" | "billing" | "settings" | "technical"
export type PanelDiscountType = "percent" | "amount" | "complimentary"
export type CloseCheckPaymentMethod = "cash" | "credit-card" | "meal-card" | "multinet" | "split" | "ledger"
export type PanelPaymentMethod = CloseCheckPaymentMethod
export type PaymentMethod = PanelPaymentMethod
export type CloseCheckSplitMethod = "cash" | "credit-card" | "meal-card" | "multinet" | "ledger"

export interface PanelUser {
  id: string
  name: string
  role: PanelUserRole | "root" | string
  roleLabel?: string
  roleColor?: string
  email?: string
  password?: string
  phone?: string
  pin?: string
  hasPin?: boolean
  hasPassword?: boolean
  canAccessPanel?: boolean
  canAccessTerminal?: boolean
  permissions?: string[]
  grantedPermissions?: string[]
  revokedPermissions?: string[]
  maxDiscountPercentOverride?: number | null
  maxDiscountAmountOverride?: number | null
  shiftRestrictionEnabled?: boolean
  shiftStartTime?: string | null
  shiftEndTime?: string | null
  shiftCutoffOffsetMinutes?: number
  effectiveShiftEndTime?: string | null
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
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

import type { PanelSplitSharePayment } from "./panel-domain-types"

export type PanelTableStatus = "empty" | "occupied" | "ordering" | "checkout"

export interface PanelTable {
  id: string
  name: string
  section: string
  status: PanelTableStatus
  qrToken?: string
  capacity?: number
  activeOrderId?: string
  waiter?: string
  lockedByStaffId?: string
  lockedByStaffName?: string
  totalAmount: number
  orderCount: number
  lastUpdated?: Date
  discount?: { type: PanelDiscountType; value: number; amount: number; reason: string; appliedBy?: string }
  splitInfo?: {
    type: "person" | "items"
    personCount?: number
    perPersonAmount?: number
    paidShares?: PanelSplitSharePayment[]
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
  discount?: { type: PanelDiscountType; value: number; reason: string; appliedBy?: string }
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

export * from "./panel-domain-types"
