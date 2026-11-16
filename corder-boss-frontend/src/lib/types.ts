export type PermissionCategory =
  | "orders_tables"
  | "discounts"
  | "billing_cash"
  | "ledger"
  | "catalog"
  | "inventory"
  | "reports_system"

export interface PermissionDefinition {
  key: string
  category: PermissionCategory
  title: string
  description: string
  scope: "terminal" | "panel" | "both"
  isCritical?: boolean
}

export interface PermissionCatalogResponse {
  categories: Record<PermissionCategory, { title: string; description: string }>
  permissions: PermissionDefinition[]
  defaultRoleTemplates: RoleDefinition[]
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
  permissionsOverride: string[] | null
  grantedPermissions: string[]
  revokedPermissions: string[]
  limits: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  maxDiscountPercentOverride: number | null
  maxDiscountAmountOverride: number | null
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

export interface BossOverviewResponse {
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
    paymentBreakdown: {
      cash: number
      creditCard: number
      mealCard: number
      multinet: number
      ledger: number
    }
  }
  hourlySales: Array<{ hour: string; revenue: number; orders: number }>
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  staffPerformance: Array<{
    name: string
    ordersCount: number
    revenue: number
    discountGiven: number
  }>
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
  recentAudits: Array<{
    id: string
    restaurantId: string
    branchName: string
    userName: string
    action: string
    category: string
    details: string
    createdAt: string
  }>
}

export interface LiveTableDto {
  id: string
  name: string
  section: string
  status: string
  sessionStaffId?: string | null
  sessionStaffName?: string | null
}

export interface LiveOrderDto {
  id: string
  tableId: string
  userId?: string | null
  userDisplayName?: string | null
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

