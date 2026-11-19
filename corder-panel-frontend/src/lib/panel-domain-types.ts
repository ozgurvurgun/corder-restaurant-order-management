import type { CancelledItem, CloseCheckSplitMethod } from "./panel-types"

export interface PanelSplitSharePayment {
  shareIndex: number
  method: CloseCheckSplitMethod
  amount: number
  ledgerCustomerId?: string
  paidAt: string
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
  type:
    | "new-order"
    | "order-ready"
    | "stock-low"
    | "shift-reminder"
    | "system"
    | "kitchen-alert"
    | "waiter-call"
    | "fraud-alert"
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

export type MenuTemplateId =
  | "classic"
  | "bistro-grid"
  | "luxury-noir"
  | "editorial"
  | "vibrant-pop"

export interface RestaurantSettings {
  name: string
  logoUrl?: string | null
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
  menuTemplate?: MenuTemplateId
  fontSize?: "small" | "medium" | "large"
  tableCardSize?: "compact" | "normal" | "large"
  showProductImages?: boolean
  sidebarCollapsed?: boolean
  quickActionsEnabled?: boolean
}

export type PanelSettings = RestaurantSettings

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

