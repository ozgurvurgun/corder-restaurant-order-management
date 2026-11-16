import type {
  BossOverviewResponse,
  BranchSummary,
  CatalogCategoryDto,
  CatalogProductDto,
  LiveOrderDto,
  LiveTableDto,
  PermissionCatalogResponse,
  RoleDefinition,
  StaffMemberDto,
} from "./types"

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000"

const BOSS_TOKEN_KEY = "corder-boss-token"
const BOSS_USER_KEY = "corder-boss-user"
const BOSS_BRANCHES_KEY = "corder-boss-branches"
const BOSS_ACTIVE_BRANCH_KEY = "corder-boss-active-branch"

export function getApiBase(): string {
  return BASE
}

export function getBossToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(BOSS_TOKEN_KEY)
}

export function setBossSession(data: {
  accessToken: string
  user: { id: string; name: string; email: string; phone?: string | null; roleLabel: string }
  restaurants: BranchSummary[]
  activeBranchId: string
}) {
  if (typeof window === "undefined") return
  localStorage.setItem(BOSS_TOKEN_KEY, data.accessToken)
  localStorage.setItem(BOSS_USER_KEY, JSON.stringify(data.user))
  localStorage.setItem(BOSS_BRANCHES_KEY, JSON.stringify(data.restaurants))
  localStorage.setItem(BOSS_ACTIVE_BRANCH_KEY, data.activeBranchId)
}

export function getStoredBossUser(): {
  id: string
  name: string
  email: string
  phone?: string | null
  roleLabel: string
} | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(BOSS_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getStoredBranches(): BranchSummary[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(BOSS_BRANCHES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function getStoredActiveBranchId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(BOSS_ACTIVE_BRANCH_KEY)
}

export function setStoredActiveBranchId(branchId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(BOSS_ACTIVE_BRANCH_KEY, branchId)
}

export function clearBossSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(BOSS_TOKEN_KEY)
  localStorage.removeItem(BOSS_USER_KEY)
  localStorage.removeItem(BOSS_BRANCHES_KEY)
  localStorage.removeItem(BOSS_ACTIVE_BRANCH_KEY)
}

async function bossFetch<T>(
  path: string,
  options: RequestInit = {},
  branchIdOverride?: string | null
): Promise<T> {
  const token = getBossToken()
  if (!token) throw new Error("Oturum bulunamadı")
  const branchId = branchIdOverride ?? getStoredActiveBranchId()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
  if (branchId && branchId !== "ALL") {
    headers["x-restaurant-id"] = branchId
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  if (res.status === 401) {
    clearBossSession()
    throw new Error("Oturum süresi doldu, lütfen tekrar giriş yapın")
  }
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try {
      const json = JSON.parse(text)
      if (json.message) {
        msg = Array.isArray(json.message) ? json.message.join(", ") : json.message
      }
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const bossApi = {
  auth: {
    async login(email: string, password: string) {
      const res = await fetch(`${BASE}/restaurant/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = "E-posta veya parola hatalı"
        try {
          const json = JSON.parse(text)
          if (json.message) msg = Array.isArray(json.message) ? json.message.join(", ") : json.message
        } catch {}
        throw new Error(msg)
      }
      return res.json() as Promise<{
        accessToken: string
        restaurant: BranchSummary
        restaurants: BranchSummary[]
        user: {
          id: string
          email: string
          name: string
          phone?: string | null
          role: string
          staffRole: string
          roleLabel: string
          isBoss: boolean
        }
      }>
    },
    async me() {
      return bossFetch<{
        restaurant: BranchSummary
        restaurants: BranchSummary[]
        user: {
          id: string
          email: string
          name: string
          phone?: string | null
          role: string
          staffRole: string
          roleLabel: string
          isBoss: boolean
        }
      }>("/restaurant/auth/me")
    },
  },
  overview: {
    async get(branchId?: string) {
      const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""
      return bossFetch<BossOverviewResponse>(`/restaurant/boss/overview${q}`)
    },
    async syncRoles(sourceRestaurantId: string, targetRestaurantIds?: string[]) {
      return bossFetch<{ syncedBranches: number; syncedRoles: number }>(
        "/restaurant/boss/sync-roles",
        {
          method: "POST",
          body: JSON.stringify({ sourceRestaurantId, targetRestaurantIds }),
        },
        sourceRestaurantId
      )
    },
  },
  roles: {
    async catalog(branchId: string) {
      return bossFetch<PermissionCatalogResponse>(
        "/restaurant/roles/catalog",
        {},
        branchId
      )
    },
    async list(branchId: string) {
      return bossFetch<RoleDefinition[]>("/restaurant/roles", {}, branchId)
    },
    async create(
      branchId: string,
      body: {
        name: string
        description?: string
        color?: string
        canAccessPanel?: boolean
        canAccessTerminal?: boolean
        permissions: string[]
        maxDiscountPercent?: number
        maxDiscountAmount?: number | null
      }
    ) {
      return bossFetch<RoleDefinition>(
        "/restaurant/roles",
        { method: "POST", body: JSON.stringify(body) },
        branchId
      )
    },
    async update(
      branchId: string,
      idOrKey: string,
      body: {
        name?: string
        description?: string | null
        color?: string
        canAccessPanel?: boolean
        canAccessTerminal?: boolean
        permissions?: string[]
        maxDiscountPercent?: number
        maxDiscountAmount?: number | null
      }
    ) {
      return bossFetch<RoleDefinition>(
        `/restaurant/roles/${encodeURIComponent(idOrKey)}`,
        { method: "PUT", body: JSON.stringify(body) },
        branchId
      )
    },
    async reset(branchId: string, idOrKey: string) {
      return bossFetch<RoleDefinition>(
        `/restaurant/roles/${encodeURIComponent(idOrKey)}/reset`,
        { method: "POST" },
        branchId
      )
    },
    async remove(branchId: string, idOrKey: string) {
      return bossFetch<void>(
        `/restaurant/roles/${encodeURIComponent(idOrKey)}`,
        { method: "DELETE" },
        branchId
      )
    },
  },
  staff: {
    async list(branchId: string) {
      return bossFetch<StaffMemberDto[]>("/restaurant/staff", {}, branchId)
    },
    async create(
      branchId: string,
      body: {
        name: string
        role: string
        phone?: string
        email?: string
        password?: string
        pin?: string
        canAccessPanel?: boolean
        canAccessTerminal?: boolean
        grantedPermissions?: string[]
        revokedPermissions?: string[]
        maxDiscountPercentOverride?: number | null
        maxDiscountAmountOverride?: number | null
      }
    ) {
      return bossFetch<StaffMemberDto>(
        "/restaurant/staff",
        { method: "POST", body: JSON.stringify(body) },
        branchId
      )
    },
    async update(
      branchId: string,
      id: string,
      body: {
        name?: string
        role?: string
        phone?: string | null
        email?: string | null
        password?: string
        pin?: string
        isActive?: boolean
        canAccessPanel?: boolean
        canAccessTerminal?: boolean
        grantedPermissions?: string[]
        revokedPermissions?: string[]
        maxDiscountPercentOverride?: number | null
        maxDiscountAmountOverride?: number | null
      }
    ) {
      return bossFetch<StaffMemberDto>(
        `/restaurant/staff/${id}`,
        { method: "PUT", body: JSON.stringify(body) },
        branchId
      )
    },
    async remove(branchId: string, id: string) {
      return bossFetch<void>(
        `/restaurant/staff/${id}`,
        { method: "DELETE" },
        branchId
      )
    },
  },
  operations: {
    async tables(branchId: string) {
      return bossFetch<LiveTableDto[]>("/restaurant/tables", {}, branchId)
    },
    async orders(branchId: string) {
      return bossFetch<LiveOrderDto[]>("/restaurant/orders", {}, branchId)
    },
    async products(branchId: string) {
      return bossFetch<CatalogProductDto[]>("/restaurant/products", {}, branchId)
    },
    async categories(branchId: string) {
      return bossFetch<CatalogCategoryDto[]>("/restaurant/categories", {}, branchId)
    },
    async updateProduct(
      branchId: string,
      productId: string,
      body: { price?: number; inStock?: boolean; name?: string }
    ) {
      return bossFetch<CatalogProductDto>(
        `/restaurant/products/${productId}`,
        { method: "PUT", body: JSON.stringify(body) },
        branchId
      )
    },
  },
}

