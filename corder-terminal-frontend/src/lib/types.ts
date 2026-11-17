// ==========================================
// Corder Terminal - Type Definitions
// ==========================================

export type TableStatus = "empty" | "occupied" | "bill-requested" | "reserved"

export type StaffRole = string

export type PaymentMethod =
  | "cash"
  | "credit-card"
  | "meal-card"
  | "multinet"
  | "split"
  | "ledger"

export type TerminalScreen =
  | "tables"
  | "order"
  | "cart"
  | "table-detail"
  | "move-table"
  | "move-item"
  | "open-orders"

export interface TerminalStaffMember {
  id: string
  name: string
  role: StaffRole
  roleLabel?: string
  roleColor?: string
  hasPin: boolean
}

export interface TerminalUser {
  id: string
  name: string
  role: StaffRole
  roleLabel?: string
  permissions?: string[]
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
}

export interface TableDiscount {
  type: "percent" | "amount" | "complimentary"
  value: number
  reason?: string
}

export interface TerminalTable {
  id: string
  number: number
  name: string
  capacity: number
  status: TableStatus
  section: string
  openedAt?: string
  guestCount?: number
  activeWaiter?: string
  subtotalAmount: number
  currentTotal: number
  discount?: TableDiscount | null
  lockedByStaffId?: string
  lockedByStaffName?: string
}

export interface TerminalProduct {
  id: string
  name: string
  price: number
  categoryId: string
  description?: string
  imageUrl?: string
  isAvailable: boolean
  preparationTime?: number
}

export interface TerminalCategory {
  id: string
  name: string
  icon?: string
  productCount: number
  parentId?: string | null
  sortOrder?: number
}

export type OrderItemStatus =
  | "pending"
  | "sent"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled"
  | "ledger"

export interface TerminalOrderItem {
  id: string
  product: TerminalProduct
  quantity: number
  note?: string
  status: OrderItemStatus
  requiresManagerApproval?: boolean
}

export type OrderStatus = "active" | "closed" | "cancelled"

export interface TerminalOrder {
  id: string
  tableId: string
  tableName: string
  tableNumber: number
  items: TerminalOrderItem[]
  waiterId: string
  waiterName: string
  createdAt: string
  updatedAt: string
  status: OrderStatus
  totalAmount: number
  paymentMethod?: PaymentMethod
  paidAmount?: number
  mergedFrom?: string
}
