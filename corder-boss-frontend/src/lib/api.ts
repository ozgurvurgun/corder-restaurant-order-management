import type {
  AuditCategory,
  AuditLogDto,
  BossOverviewResponse,
  BranchSummary,
  CatalogCategoryDto,
  CatalogProductDto,
  LiveOrderDto,
  LiveTableDto,
  PermissionCatalogResponse,
  RoleDefinition,
  StaffMemberDto,
  SubBossItemDto,
} from "./types"
import { localizeApiError } from "./format"

const rawEnvUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const BASE =
  rawEnvUrl !== undefined ? rawEnvUrl.replace(/\/+$/, "") : "http://localhost:4000"

const BOSS_TOKEN_KEY = "corder-boss-token"
const BOSS_USER_KEY = "corder-boss-user"
const BOSS_BRANCHES_KEY = "corder-boss-branches"
const BOSS_ACTIVE_BRANCH_KEY = "corder-boss-active-branch"

export const BOSS_UNAUTHORIZED_EVENT = "corder:boss-unauthorized"

export interface StoredBossUser {
  id: string
  name: string
  email: string
  phone?: string | null
  roleLabel: string
  bossTier?: string
  brandName?: string | null
}

export function getApiBase(): string {
  return BASE
}

export function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".")
    if (parts.length !== 3 || !parts[1]) return true
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
    const payload = JSON.parse(atob(padded)) as { exp?: number; role?: string }
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return true
    }
    return false
  } catch {
    return true
  }
}

export function notifyUnauthorized() {
  clearBossSession()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BOSS_UNAUTHORIZED_EVENT))
  }
}

export function getBossToken(): string | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(BOSS_TOKEN_KEY)
  if (!token) return null
  if (isJwtExpired(token)) {
    notifyUnauthorized()
    return null
  }
  return token
}

export function setBossToken(accessToken: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(BOSS_TOKEN_KEY, accessToken)
}

export function setBossSession(data: {
  accessToken: string
  user: StoredBossUser
  restaurants: BranchSummary[]
  activeBranchId: string
}) {
  if (typeof window === "undefined") return
  localStorage.setItem(BOSS_TOKEN_KEY, data.accessToken)
  localStorage.setItem(BOSS_USER_KEY, JSON.stringify(data.user))
  localStorage.setItem(BOSS_BRANCHES_KEY, JSON.stringify(data.restaurants))
  localStorage.setItem(BOSS_ACTIVE_BRANCH_KEY, data.activeBranchId)
}

export function getStoredBossUser(): StoredBossUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(BOSS_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredBossUser
  } catch {
    return null
  }
}

export function getStoredBranches(): BranchSummary[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(BOSS_BRANCHES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as BranchSummary[]
  } catch {
    return []
  }
}

export function setStoredBranches(branches: BranchSummary[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(BOSS_BRANCHES_KEY, JSON.stringify(branches))
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

function extractErrorMessage(text: string, fallback: string): string {
  let msg = text
  try {
    const json = JSON.parse(text) as { message?: string | string[] }
    if (json.message) {
      msg = Array.isArray(json.message) ? json.message.join(", ") : json.message
    }
  } catch {
    // plain text body
  }
  return localizeApiError(msg || fallback)
}

async function bossFetch<T>(
  path: string,
  options: RequestInit = {},
  branchIdOverride?: string | null
): Promise<T> {
  const token = getBossToken()
  if (!token) {
    notifyUnauthorized()
    throw new Error("Oturum bulunamadı, lütfen tekrar giriş yapın.")
  }
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
    notifyUnauthorized()
    throw new Error("Oturum süresi doldu, lütfen tekrar giriş yapın.")
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(extractErrorMessage(text, `HTTP ${res.status}`))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
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
        throw new Error(extractErrorMessage(text, "E-posta veya parola hatalı."))
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
          bossTier?: string
          brandName?: string | null
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
          bossTier?: string
          brandName?: string | null
        }
      }>("/restaurant/auth/me")
    },
    async switchBranch(restaurantId: string) {
      return bossFetch<{
        accessToken: string
        restaurant: BranchSummary
        restaurants: BranchSummary[]
      }>(
        "/restaurant/auth/switch-branch",
        {
          method: "POST",
          body: JSON.stringify({ restaurantId }),
        },
        restaurantId
      )
    },
  },
  overview: {
    async get(branchId?: string) {
      const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""
      return bossFetch<BossOverviewResponse>(`/restaurant/boss/overview${q}`)
    },
    async syncRoles(sourceRestaurantId: string, targetRestaurantIds?: string[]) {
      const payload: { sourceRestaurantId: string; targetRestaurantIds?: string[] } = {
        sourceRestaurantId,
        ...(targetRestaurantIds ? { targetRestaurantIds } : {}),
      }
      return bossFetch<{ syncedBranches: number; syncedRoles: number }>(
        "/restaurant/boss/sync-roles",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        sourceRestaurantId
      )
    },
    async listSubBosses() {
      return bossFetch<SubBossItemDto[]>("/restaurant/boss/sub-bosses")
    },
    async createSubBoss(body: {
      name: string
      email: string
      phone?: string
      password?: string
      bossTier?: "franchise_owner" | "regional_manager"
      restaurantIds: string[]
    }) {
      return bossFetch<SubBossItemDto[]>("/restaurant/boss/sub-bosses", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    async unlinkSubBoss(subBossId: string, branchId: string) {
      return bossFetch<SubBossItemDto[]>(
        `/restaurant/boss/sub-bosses/${encodeURIComponent(subBossId)}/branch/${encodeURIComponent(branchId)}`,
        { method: "DELETE" }
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
        key?: string
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
        permissionsOverride?: string[] | null
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
        permissionsOverride?: string[] | null
        grantedPermissions?: string[]
        revokedPermissions?: string[]
        maxDiscountPercentOverride?: number | null
        maxDiscountAmountOverride?: number | null
      }
    ) {
      return bossFetch<StaffMemberDto>(
        `/restaurant/staff/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(body) },
        branchId
      )
    },
    async remove(branchId: string, id: string) {
      return bossFetch<void>(
        `/restaurant/staff/${encodeURIComponent(id)}`,
        { method: "DELETE" },
        branchId
      )
    },
  },
  auditLogs: {
    async list(
      branchId: string,
      params?: {
        category?: AuditCategory
        limit?: number
        from?: string
        to?: string
      }
    ) {
      const qs = new URLSearchParams()
      if (params?.category) qs.set("category", params.category)
      if (params?.limit) qs.set("limit", String(params.limit))
      if (params?.from) qs.set("from", params.from)
      if (params?.to) qs.set("to", params.to)
      const query = qs.toString()
      return bossFetch<AuditLogDto[]>(
        `/restaurant/audit-logs${query ? `?${query}` : ""}`,
        {},
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
        `/restaurant/products/${encodeURIComponent(productId)}`,
        { method: "PUT", body: JSON.stringify(body) },
        branchId
      )
    },
  },
}
