export interface PlatformAdmin {
  id: string
  email: string
  name: string
  role: "super"
}

export type RestaurantBranchType = "independent" | "company_owned" | "franchise"
export type RestaurantBillingStatus = "paid" | "pending" | "overdue" | "suspended"
export type BossTier = "brand_owner" | "franchise_owner" | "regional_manager"

export interface RestaurantPaymentRecord {
  id: string
  period: string
  amount: number
  paidAt: string
  note?: string | null
  recordedBy?: string | null
}

export interface RestaurantBossSummary {
  id: string
  name: string
  email: string
  bossTier: BossTier
  title: string
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  logo?: string
  status: "active" | "inactive"
  brandName?: string | null
  branchType?: RestaurantBranchType
  franchiseeCompanyName?: string | null
  royaltyRate?: number
  monthlyFee?: number
  billingStatus?: RestaurantBillingStatus
  isAccessSuspended?: boolean
  suspensionReason?: string | null
  suspendedAt?: string | null
  lastPaymentDate?: string | null
  lastPaidPeriod?: string | null
  billingNotes?: string | null
  paymentHistory?: RestaurantPaymentRecord[]
  bosses?: RestaurantBossSummary[]
  createdAt: string
  rootAdminId?: string
  /** Terminal login email (independent of boss). */
  terminalEmail?: string | null
  /** Print Agent desktop login username. */
  printAgentUsername?: string | null
}

export interface BossBranchSummary {
  id: string
  name: string
  slug: string
  status: string
  brandName?: string | null
  branchType?: RestaurantBranchType
  billingStatus?: RestaurantBillingStatus
  isAccessSuspended?: boolean
}

export interface RootAdmin {
  id: string
  restaurantId: string | null
  email: string
  name: string
  phone?: string | null
  bossTier?: BossTier
  brandName?: string | null
  isActive?: boolean
  restaurants?: BossBranchSummary[]
  createdAt: string
}

export type BossUser = RootAdmin

export interface PlatformBillingConfig {
  id: string
  receiverName: string
  iban: string
  bankName: string
  collectionStartDay: number
  collectionEndDay: number
  supportPhone?: string | null
  supportEmail?: string | null
  paymentInstructions?: string | null
  updatedAt: string
}
