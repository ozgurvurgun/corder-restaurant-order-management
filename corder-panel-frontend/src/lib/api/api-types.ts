import type {
  CloseCheckPaymentMethod,
  CloseCheckSplitMethod,
  CompletedOrderEditLogEntry,
  MenuTemplateId,
  PanelDiscountType,
  PanelTable,
} from "../panel-types"

export interface RawTableDto {
  id: string
  name: string
  section: string
  status: string
  qrToken?: string
  capacity?: number
  sessionStaffId?: string | null
  sessionStaffName?: string | null
  discount?: { type: PanelDiscountType; value: number; reason: string; appliedBy?: string } | null
  splitInfo?: PanelTable["splitInfo"] | null
}

export type TableDto = RawTableDto

export interface ShiftDto {
  id: string
  openedBy: string
  openedAt: string
  closedAt: string | null
  closedBy: string | null
  status: string
  openingBalance: number
  closingBalance: number | null
  notes: string | null
  cashIn: number
  cashOut: number
  totalRevenue: number
  totalCash: number
  totalCard: number
  totalMealCard: number
  totalMultinet: number
  transactionCount: number
  isAutoClosed?: boolean
  carriedOverTablesCount?: number
  carriedOverTablesAmount?: number
  carriedOverTablesSnapshot?: Array<{
    tableId: string
    tableName: string
    section: string
    openAmount: number
    itemCount: number
    openedAt: string
  }>
}

export type ApiCashShift = ShiftDto

export interface OrderItemDto {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: string
  createdAt: string
  cancelReason?: string
  cancelledBy?: string
  cancelledAt?: string
}

export interface OrderDto {
  id: string
  tableId: string
  userId: string | null
  userName?: string | null
  status: string
  items: OrderItemDto[]
  createdAt: string
  updatedAt: string
  mergedFrom?: string | null
}

export interface CategoryDto {
  id: string
  restaurantId: string
  name: string
  slug: string
  parentId?: string | null
  showInTerminal: boolean
  showInMenu: boolean
  showInQuickSale?: boolean
  order: number
  createdAt: string
}

export interface ProductIngredientDto {
  materialId: string
  quantity: number
}

export interface ProductDto {
  id: string
  categoryId: string
  name: string
  description: string | null
  price: number
  costPrice?: number | null
  imageUrl: string | null
  inStock: boolean
  showInMenu?: boolean
  order: number
  createdAt: string
  calories?: number | null
  allergens?: string[] | null
  ingredients?: ProductIngredientDto[] | null
  category?: CategoryDto
}

export interface CreateProductBody {
  categoryId: string
  name: string
  description?: string
  price: number
  costPrice?: number | null
  imageUrl?: string
  inStock?: boolean
  showInMenu?: boolean
  order?: number
  calories?: number | null
  allergens?: string[] | null
  ingredients?: ProductIngredientDto[] | null
}

export interface UpdateProductBody {
  categoryId?: string
  name?: string
  description?: string
  price?: number
  costPrice?: number | null
  imageUrl?: string
  inStock?: boolean
  showInMenu?: boolean
  order?: number
  calories?: number | null
  allergens?: string[] | null
  ingredients?: ProductIngredientDto[] | null
}

export interface CompletedOrderItemSnapshotDto {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: string
  createdAt: string
  cancelReason?: string
  cancelledBy?: string
  cancelledAt?: string
}

export interface CompletedOrderSnapshotDto {
  id: string
  orderNumber?: string | null
  tableId: string
  userId: string
  userName?: string | null
  items: CompletedOrderItemSnapshotDto[]
  status: string
  createdAt: string
  updatedAt: string
  mergedFrom?: string
}

export interface CompletedPaymentSplitDto {
  method: string
  amount: number
}

export interface CompletedPaymentDiscountDto {
  type: PanelDiscountType
  value: number
  reason: string
  appliedBy?: string
}

export interface CompletedPaymentSnapshotDto {
  id: string
  tableId: string
  tableName: string
  orderIds: string[]
  amount: number
  method: string
  splitDetails?: CompletedPaymentSplitDto[]
  discount?: CompletedPaymentDiscountDto
  tip?: number
  processedBy: string
  createdAt: string
  ledgerCustomerId?: string
  ledgerCustomerName?: string
}

export interface CompletedOrderDto {
  id: string
  tableName: string
  section: string
  waiter: string
  orders: CompletedOrderSnapshotDto[]
  payment: CompletedPaymentSnapshotDto
  totalAmount: number
  discountAmount: number
  netAmount: number
  closedBy: string
  openedAt: string
  closedAt: string
  paymentMethod: string
  paymentSplit?: CompletedPaymentSplitDto[]
  paymentDiscount?: CompletedPaymentDiscountDto
  paymentTip?: number
  editHistory?: CompletedOrderEditLogEntry[]
  createdAt: string
}

export interface CloseCheckBody {
  tableId?: string
  lines?: { itemId: string; quantity: number }[]
  items?: { productId: string; quantity: number; note?: string }[]
  method: CloseCheckPaymentMethod
  discount?: { type: PanelDiscountType; value: number; reason?: string; appliedBy?: string }
  splitDetails?: {
    method: CloseCheckSplitMethod
    amount: number
  }[]
  ledgerCustomerId?: string
  ledgerDebtAmount?: number
  tip?: number
}

export type CloseCheckRequestDto = CloseCheckBody

export interface CloseCheckResponseDto {
  completedOrder: CompletedOrderDto
  shift: ShiftDto
  cashTransaction: CashTransactionDto | null
  stockMovements: StockMovementDto[]
  tableFullyClosed?: boolean
}

export interface LedgerCustomerDto {
  id: string
  restaurantId: string
  name: string
  phone?: string | null
  notes?: string | null
  balance: number
  periodNet?: number
  createdAt: string
}

export interface LedgerEntryDto {
  id: string
  entryType: "debt" | "payment" | "credit"
  amount: number
  description: string
  tableId?: string | null
  tableName?: string | null
  completedOrderId?: string | null
  receivedBy?: string | null
  receivedByUserId?: string | null
  createdAt: string
}

export type CompletedOrderUpdateBody = {
  orders: CompletedOrderSnapshotDto[]
  payment: CompletedPaymentSnapshotDto
}

export interface CampaignDto {
  id: string
  restaurantId: string
  title: string
  description?: string | null
  imageUrl: string
  discountPercent?: number | null
  originalPrice?: number | null
  discountedPrice?: number | null
  validUntil?: string | null
  isActive: boolean
  order: number
  createdAt: string
}

export interface CashTransactionDto {
  id: string
  restaurantId: string
  shiftId: string
  type: "sale" | "expense" | "cash-in" | "cash-out" | "refund"
  amount: number
  description: string
  reference?: string | null
  createdBy: string
  createdAt: string
}

export interface OpenAccountLineDto {
  id: string
  productId?: string | null
  productName: string
  quantity: number
  price: number
  note?: string | null
}

export interface OpenAccountPaymentDto {
  id: string
  amount: number
  receivedBy: string
  receivedByUserId?: string | null
  note?: string | null
  createdAt: string
}

export interface OpenAccountDto {
  id: string
  restaurantId: string
  customerName: string
  customerPhone?: string | null
  amount: number
  paidAmount: number
  status: "open" | "partial" | "paid"
  description: string
  createdBy: string
  createdAt: string
  paidAt?: string | null
  items?: OpenAccountLineDto[]
  payments?: OpenAccountPaymentDto[]
}

export interface RestaurantSettingsDto {
  name: string
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  taxId?: string | null
  whatsapp?: string | null
  instagram?: string | null
  facebook?: string | null
  website?: string | null
  workingHours?: string | null
  menuTemplate?: MenuTemplateId | string | null
  terminalLocationRestrictionEnabled?: boolean
  locationLatitude?: number | null
  locationLongitude?: number | null
  locationRadiusMeters?: number
  autoCloseShiftEnabled?: boolean
  autoCloseShiftTime?: string
}

export interface FraudAlertDto {
  id: string
  restaurantId: string
  ruleCode: string
  severity: "low" | "medium" | "high" | "critical"
  status: "open" | "investigating" | "resolved" | "false_positive"
  title: string
  description: string
  amountImpact?: number
  actorId?: string | null
  actorName?: string | null
  tableId?: string | null
  tableName?: string | null
  orderId?: string | null
  shiftId?: string | null
  metadata?: Record<string, unknown> | null
  resolutionNote?: string | null
  resolvedBy?: string | null
  resolvedAt?: string | null
  createdAt: string
}

export interface PrinterConfigDto {
  id: string
  restaurantId: string
  name: string
  type: string
  connection: "usb" | "network" | "bluetooth"
  ipAddress: string | null
  port: number | null
  department: string | null
  status: "online" | "offline" | "error"
  paperWidth: number
  autoCut: boolean
  createdAt: string
  updatedAt: string
}

export interface AuditLogDto {
  id: string
  restaurantId: string
  userId: string
  userName: string
  action: string
  category: string
  details: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface StockMaterialDto {
  id: string
  restaurantId: string
  name: string
  unit: string
  currentStock: number
  minStock: number
  costPerUnit: number
  supplierId?: string | null
  category: string
  createdAt: string
  updatedAt: string
}

export interface SupplierDto {
  id: string
  restaurantId: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  createdAt: string
}

export interface StockMovementDto {
  id: string
  restaurantId: string
  materialId: string
  materialName: string
  type: "in" | "out" | "waste" | "count-adjustment"
  quantity: number
  previousStock: number
  newStock: number
  unitCost?: number | null
  totalCost?: number | null
  supplierId?: string | null
  reason?: string | null
  createdBy: string
  createdAt: string
}

export interface PurchaseOrderItemDto {
  materialId: string
  materialName: string
  quantity: number
  unitCost: number
  receivedQuantity?: number
}

export interface PurchaseOrderDto {
  id: string
  restaurantId: string
  supplierId: string
  supplierName: string
  items: PurchaseOrderItemDto[]
  totalAmount: number
  status: "draft" | "ordered" | "received" | "cancelled"
  notes?: string | null
  createdBy: string
  createdAt: string
  receivedAt?: string | null
}

export interface InventoryCountItemDto {
  materialId: string
  materialName: string
  expectedStock: number
  actualStock: number
  difference: number
  isCounted?: boolean
}

export interface InventoryCountDto {
  id: string
  restaurantId: string
  date: string
  countedBy: string
  items: InventoryCountItemDto[]
  status: "in-progress" | "completed"
  notes?: string | null
  createdAt: string
}
