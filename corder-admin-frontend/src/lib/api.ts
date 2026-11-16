import type {
  BossTier,
  PlatformBillingConfig,
  RestaurantBillingStatus,
  RestaurantBossSummary,
  RestaurantBranchType,
  RestaurantPaymentRecord,
} from "./types"

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000"

const PLATFORM_TOKEN_KEY = "corder-platform-token"
const PLATFORM_ADMIN_KEY = "corder-platform-admin"

export function getPlatformToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PLATFORM_TOKEN_KEY)
}

export function setPlatformAuth(accessToken: string, admin: { id: string; email: string; name: string }) {
  if (typeof window === "undefined") return
  localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken)
  localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(admin))
}

export function clearPlatformAuth() {
  if (typeof window === "undefined") return
  localStorage.removeItem(PLATFORM_TOKEN_KEY)
  localStorage.removeItem(PLATFORM_ADMIN_KEY)
}

async function platformFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getPlatformToken()
  if (!token) throw new Error("Unauthorized")
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearPlatformAuth()
    throw new Error("Oturum süresi doldu")
  }
  if (!res.ok) {
    const body = await res.text()
    let msg = body
    try {
      const j = JSON.parse(body)
      if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface BossDto {
  id: string
  restaurantId: string | null
  email: string
  name: string
  phone?: string | null
  bossTier?: BossTier
  brandName?: string | null
  isActive?: boolean
  restaurants?: Array<{
    id: string
    name: string
    slug: string
    status: string
    brandName?: string | null
    branchType?: RestaurantBranchType
    billingStatus?: RestaurantBillingStatus
    isAccessSuspended?: boolean
  }>
  createdAt: string
}

export interface PlatformRestaurantDto {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  status: string
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
  rootAdminId?: string | null
  terminalEmail?: string | null
  printAgentUsername?: string | null
  createdAt: string
}

export const platform = {
  auth: {
    async login(email: string, password: string) {
      const res = await fetch(`${BASE}/platform/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.text()
        let msg = "Geçersiz e-posta veya parola"
        try {
          const j = JSON.parse(body)
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message
        } catch {}
        throw new Error(msg)
      }
      return res.json() as Promise<{ accessToken: string; admin: { id: string; email: string; name: string } }>
    },
  },
  restaurants: {
    async list() {
      return platformFetch<PlatformRestaurantDto[]>("/platform/restaurants")
    },
    async one(id: string) {
      return platformFetch<PlatformRestaurantDto>(`/platform/restaurants/${id}`)
    },
    async categories(restaurantId: string) {
      return platformFetch<
        Array<{
          id: string
          name: string
          slug: string
          order: number
          showInTerminal: boolean
          showInMenu: boolean
          createdAt: string
        }>
      >(`/platform/restaurants/${restaurantId}/categories`)
    },
    async create(body: {
      name: string
      slug: string
      address?: string
      phone?: string
      email?: string
      status?: "active" | "inactive"
      brandName?: string | null
      branchType?: RestaurantBranchType
      franchiseeCompanyName?: string | null
      royaltyRate?: number
      monthlyFee?: number
      billingStatus?: RestaurantBillingStatus
      isAccessSuspended?: boolean
      billingNotes?: string | null
      printAgentUsername?: string
      printAgentPassword?: string
    }) {
      return platformFetch<PlatformRestaurantDto>("/platform/restaurants", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    async update(
      id: string,
      body: {
        name?: string
        slug?: string
        address?: string
        phone?: string
        email?: string
        status?: "active" | "inactive"
        brandName?: string | null
        branchType?: RestaurantBranchType
        franchiseeCompanyName?: string | null
        royaltyRate?: number
        monthlyFee?: number
        billingStatus?: RestaurantBillingStatus
        isAccessSuspended?: boolean
        billingNotes?: string | null
        terminalEmail?: string | null
        terminalPassword?: string
        printAgentUsername?: string | null
        printAgentPassword?: string
      }
    ) {
      return platformFetch<PlatformRestaurantDto>(`/platform/restaurants/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
    },
    async updateBilling(
      id: string,
      body: {
        billingStatus: RestaurantBillingStatus
        monthlyFee?: number
        period?: string
        note?: string | null
      }
    ) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing`,
        { method: "PUT", body: JSON.stringify(body) }
      )
    },
    async markPaid(
      id: string,
      body?: { amount?: number; period?: string; note?: string }
    ) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/mark-paid`,
        { method: "POST", body: JSON.stringify(body ?? {}) }
      )
    },
    async suspendUnpaid(id: string, body?: { note?: string }) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/suspend-unpaid`,
        { method: "POST", body: JSON.stringify(body ?? {}) }
      )
    },
    async delete(id: string) {
      return platformFetch<void>(`/platform/restaurants/${id}`, { method: "DELETE" })
    },
  },
  billing: {
    async getConfig() {
      return platformFetch<PlatformBillingConfig>("/platform/billing/config")
    },
    async updateConfig(body: Partial<PlatformBillingConfig>) {
      return platformFetch<PlatformBillingConfig>("/platform/billing/config", {
        method: "PUT",
        body: JSON.stringify(body),
      })
    },
    async startCollectionCycle(period?: string) {
      return platformFetch<{ period: string; updatedCount: number }>(
        "/platform/billing/start-collection-cycle",
        { method: "POST", body: JSON.stringify({ period }) }
      )
    },
    async suspendAllUnpaid() {
      return platformFetch<{ suspendedCount: number }>(
        "/platform/billing/suspend-all-unpaid",
        { method: "POST", body: JSON.stringify({}) }
      )
    },
  },
  rootAdmins: {
    async list(restaurantId: string) {
      return platformFetch<BossDto[]>(`/platform/restaurants/${restaurantId}/root-admins`)
    },
    async create(
      restaurantId: string,
      body: {
        name: string
        email: string
        phone?: string
        bossTier?: BossTier
        brandName?: string | null
        password: string
      }
    ) {
      return platformFetch<BossDto>(
        `/platform/restaurants/${restaurantId}/root-admins`,
        { method: "POST", body: JSON.stringify(body) }
      )
    },
    async linkExisting(restaurantId: string, bossId: string) {
      return platformFetch<BossDto>(
        `/platform/restaurants/${restaurantId}/root-admins/link/${bossId}`,
        { method: "POST" }
      )
    },
    async update(
      restaurantId: string,
      id: string,
      body: {
        name?: string
        email?: string
        phone?: string | null
        bossTier?: BossTier
        brandName?: string | null
        password?: string
        isActive?: boolean
        restaurantIds?: string[]
      }
    ) {
      return platformFetch<BossDto>(
        `/platform/restaurants/${restaurantId}/root-admins/${id}`,
        { method: "PUT", body: JSON.stringify(body) }
      )
    },
    async delete(restaurantId: string, id: string) {
      return platformFetch<void>(`/platform/restaurants/${restaurantId}/root-admins/${id}`, { method: "DELETE" })
    },
  },
  bosses: {
    async list() {
      return platformFetch<BossDto[]>("/platform/bosses")
    },
    async create(body: {
      name: string
      email: string
      phone?: string
      bossTier?: BossTier
      brandName?: string | null
      password: string
      restaurantIds?: string[]
    }) {
      return platformFetch<BossDto>("/platform/bosses", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    async update(
      id: string,
      body: {
        name?: string
        email?: string
        phone?: string | null
        bossTier?: BossTier
        brandName?: string | null
        password?: string
        isActive?: boolean
        restaurantIds?: string[]
      }
    ) {
      return platformFetch<BossDto>(`/platform/bosses/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
    },
    async delete(id: string) {
      return platformFetch<void>(`/platform/bosses/${id}`, { method: "DELETE" })
    },
  },
}
