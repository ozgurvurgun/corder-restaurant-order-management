// ==========================================
// Corder Terminal - Type Definitions
// ==========================================

export interface User {
  id: string
  name: string
  avatar?: string
  role: "garson" | "mudur" | "kasiyer"
  password?: string
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Product {
  id: string
  name: string
  price: number
  categoryId: string
  image?: string
  inStock: boolean
  description?: string
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: "pending" | "sent" | "preparing" | "ready" | "served" | "cancelled"
  createdAt: Date
  sentAt?: Date
}

export interface Order {
  id: string
  tableId: string
  userId: string
  userName?: string
  items: OrderItem[]
  status: "active" | "closed" | "cancelled"
  createdAt: Date
  updatedAt: Date
  mergedFrom?: string // table name if this order was moved/merged from another table
}

export type TableStatus = "empty" | "occupied" | "ordering" | "checkout"

export interface Table {
  id: string
  name: string
  section: string
  status: TableStatus
  activeOrderId?: string
  waiter?: string
  /** Waiter currently working this table on another terminal (socket lock). */
  focusLock?: { staffId: string; staffName: string }
  totalAmount: number
  orderCount: number
  lastUpdated?: Date
}

export interface Section {
  id: string
  name: string
}

export interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
}
