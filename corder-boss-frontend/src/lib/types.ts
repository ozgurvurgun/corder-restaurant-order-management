export type PermissionCategory =
  | "orders_tables"
  | "discounts"
  | "billing_cash"
  | "ledger"
  | "catalog"
  | "inventory"
  | "reports_system"

export type AuditCategory =
  | "auth"
  | "order"
  | "payment"
  | "product"
  | "user"
  | "settings"
  | "stock"
  | "cash-register"
  | "register"
  | "shift"
  | "table"

export type FraudSeverity = "critical" | "high" | "medium" | "low"

export type FraudAlertStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "false_positive"

export interface FraudAlertDto {
  id: string
  restaurantId?: string
  branchId?: string
  branchName?: string
  ruleKey: string
  title: string
  description: string
  severity: FraudSeverity
  status: FraudAlertStatus
  amountImpact: number
  staffId?: string | null
  staffName?: string | null
  tableName?: string | null
  orderId?: string | null
  resolutionNote?: string | null
  resolvedBy?: string | null
  resolvedAt?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface FraudSummaryDto {
  openCount: number
  criticalCount: number
  totalAmountImpact: number
}

export interface ShiftSummaryDto {
  id: string
  branchName?: string
  openedBy: string
  closedBy?: string | null
  status: string
  openingBalance: number
  closingBalance?: number | null
  expectedCash?: number
  difference?: number
  openedAt: string
  closedAt?: string | null
}

export interface WaiterPerformanceDto {
  waiterName: string
  ordersCount: number
  revenue: number
  cancelledCount: number
  cancelledAmount: number
  discountGiven?: number
}

export interface CategoryBreakdownDto {
  categoryName: string
  revenue: number
  quantity: number
}

export interface PermissionDefinition {
  key: string
  category: PermissionCategory | string
  title: string
  description: string
  scope: "terminal" | "panel" | "both"
  isCritical?: boolean
}

export interface RoleTemplateDefinition {
  key: string
  name: string
  description: string
  color: string
  isSystem: boolean
  canAccessPanel: boolean
  canAccessTerminal: boolean
  maxDiscountPercent: number
  maxDiscountAmount: number | null
  permissions: string[]
}

export interface PermissionCatalogResponse {
  categories: Record<string, { title: string; description: string }>
  permissions: PermissionDefinition[]
  defaultRoleTemplates: RoleTemplateDefinition[]
}

export interface RoleDefinition {
  id: string
  restaurantId?: string
  key: string
  name: string
  description: string | null
  color: string
  isSystem: boolean
  canAccessPanel: boolean
  canAccessTerminal: boolean
  permissions: string[]
  maxDiscountPercent: number
  maxDiscountAmount: number | null
  updatedAt?: string
}

export interface StaffMemberDto {
  id: string
  restaurantId: string
  name: string
  email: string | null
  role: string
  roleLabel: string
  roleColor: string
  phone?: string
  isActive: boolean
  canAccessPanel: boolean
  canAccessTerminal: boolean
  hasPin: boolean
  hasPassword: boolean
  permissions: string[]
  grantedPermissions: string[]
  revokedPermissions: string[]
  limits: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  maxDiscountPercentOverride: number | null
  maxDiscountAmountOverride: number | null
  shiftRestrictionEnabled?: boolean
  shiftStartTime?: string | null
  shiftEndTime?: string | null
  shiftCutoffOffsetMinutes?: number
  effectiveShiftEndTime?: string | null
  createdAt: string
}

export interface BranchSummary {
  id: string
  name: string
  slug: string
  address?: string | null
  phone?: string | null
  status: string
  brandName?: string | null
  branchType?: "independent" | "company_owned" | "franchise" | string
  monthlyFee?: number
  billingStatus?: string
  isAccessSuspended?: boolean
}

export interface BranchLivePulse {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  status: string
  brandName?: string | null
  branchType?: "independent" | "company_owned" | "franchise" | string
  franchiseeCompanyName?: string | null
  royaltyRate?: number
  estimatedTodayRoyalty?: number
  estimatedMonthRoyalty?: number
  monthlyFee?: number
  billingStatus?: string
  isAccessSuspended?: boolean
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  todayOrderCount: number
  todayDiscountTotal: number
  todayCancelCount: number
  todayCancelAmount: number
  occupiedTableCount: number
  totalTableCount: number
  openChecksTotal: number
  openOrderCount: number
  criticalStockCount: number
  staffCount: number
  panelStaffCount: number
  terminalStaffCount: number
  openLedgerBalance: number
  paymentBreakdown: {
    cash: number
    creditCard: number
    mealCard: number
    multinet: number
    ledger: number
  }
  activeShift: {
    id: string
    openedBy: string
    openedAt: string
    openingBalance: number
    totalSales: number
    totalCash: number
    totalCard: number
  } | null
}

export interface AuditLogDto {
  id: string
  restaurantId: string
  branchName?: string
  userId?: string
  userName: string
  action: string
  category: AuditCategory | string
  details: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface BossOverviewDto {
  branches: BranchLivePulse[]
  allOwnedBranches: Array<{
    id: string
    name: string
    slug: string
    status: string
    brandName?: string | null
    branchType?: string
    franchiseeCompanyName?: string | null
    royaltyRate?: number
    monthlyFee?: number
    billingStatus?: string
    isAccessSuspended?: boolean
  }>
  consolidated: {
    todayRevenue: number
    weekRevenue: number
    monthRevenue: number
    todayOrderCount: number
    todayDiscountTotal: number
    todayCancelCount: number
    todayCancelAmount: number
    occupiedTableCount: number
    totalTableCount: number
    openChecksTotal: number
    openOrderCount: number
    criticalStockCount: number
    staffCount: number
    openLedgerBalance: number
    totalBranchesCount?: number
    companyOwnedCount?: number
    franchiseBranchCount?: number
    todayEstimatedRoyalty?: number
    monthEstimatedRoyalty?: number
    grossRevenue?: number
    discountTotal?: number
    discountRatePct?: number
    cancelledCount?: number
    cancelRatePct?: number
    averageOrderValue?: number
    revenuePerTable?: number
    openLedgerTotal?: number
    paymentBreakdown: {
      cash: number
      creditCard: number
      mealCard: number
      multinet: number
      ledger: number
    }
  }
  hourlySales: Array<{
    hour: string
    revenue: number
    ordersCount: number
  }>
  categoryBreakdown?: CategoryBreakdownDto[]
  topProducts: Array<{
    productName: string
    quantity: number
    revenue: number
  }>
  waiterPerformance: WaiterPerformanceDto[]
  shiftSummaries?: ShiftSummaryDto[]
  fraudSummary?: FraudSummaryDto
  liveOrders?: Array<
    LiveOrderDto & {
      branchName?: string
      tableName?: string
      totalAmount?: number
    }
  >
  criticalMaterials: Array<{
    id: string
    restaurantId: string
    branchName: string
    name: string
    category: string
    unit: string
    currentStock: number
    minStock: number
  }>
  recentAudits: AuditLogDto[]
}

export type BossOverviewResponse = BossOverviewDto

export interface TableDiscountDto {
  type: "percent" | "amount" | "complimentary"
  value: number
}

export interface LiveTableDto {
  id: string
  name: string
  section: string
  status: string
  sessionStaffId?: string | null
  sessionStaffName?: string | null
  sessionLockedAt?: string | null
  discount?: TableDiscountDto | null
  splitInfo?: unknown | null
}

export interface LiveOrderDto {
  id: string
  tableId: string
  userId?: string | null
  userName?: string | null
  status: string
  mergedFrom?: string | null
  createdAt: string
  items: Array<{
    id: string
    productId: string
    productName: string
    price: number
    quantity: number
    note?: string | null
    status: string
    cancelReason?: string
    cancelledBy?: string
    cancelledAt?: string
  }>
}

export interface CatalogProductDto {
  id: string
  categoryId: string
  name: string
  description?: string | null
  price: number
  imageUrl?: string | null
  inStock: boolean
}

export interface CatalogCategoryDto {
  id: string
  name: string
  slug: string
}

export interface SubBossItemDto {
  id: string
  name: string
  email: string
  phone: string | null
  bossTier: "brand_owner" | "franchise_owner" | "regional_manager" | string
  brandName: string | null
  isSelf: boolean
  branches: Array<{
    id: string
    name: string
    slug: string
    branchType: string
    title: string
  }>
}

export type BossTabId =
  | "dashboard"
  | "permissions"
  | "staff"
  | "analytics"
  | "operations"
  | "security"

export interface BossPlatformNotificationDto {
  id: string
  title: string
  message: string
  level: "info" | "warning" | "urgent" | "success" | string
  targetApps: string[]
  sentAt: string
  createdAt: string
  read?: boolean
}
