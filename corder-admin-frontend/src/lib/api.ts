import type {
  BossDto, BossTier, CreatePlatformNotificationPayload, PlatformBillingConfig,
  PlatformNotificationDto, PlatformRestaurantDto, RecordPaymentPayload,
  RestaurantBranchType, RestaurantDiagnosticsDto, RestaurantSupportActionBody,
  SubscriptionPaymentMethod, UpdatePaymentPayload,
} from "./types"
import { formatTitleCase } from "./restaurant-mapper"

export type {
  BossDto, CreatePlatformNotificationPayload, PlatformNotificationDto, PlatformRestaurantDto,
  RecordPaymentPayload, RestaurantDiagnosticsDto, RestaurantSupportActionBody, UpdatePaymentPayload,
}

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000"
const BASE = RAW_BASE.replace(/\/+$/, "")

const PLATFORM_TOKEN_KEY = "corder-platform-token"
const PLATFORM_ADMIN_KEY = "corder-platform-admin"
export const PLATFORM_UNAUTHORIZED_EVENT = "corder:platform-unauthorized"

export function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return true
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")
    const payload = JSON.parse(atob(padded)) as { exp?: number; type?: string }
    if (payload.type && payload.type !== "platform") return true
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return true
    }
    return false
  } catch {
    return true
  }
}

export function getPlatformToken(): string | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(PLATFORM_TOKEN_KEY)
  if (!token) return null
  if (isJwtExpired(token)) {
    clearPlatformAuth(true)
    return null
  }
  return token
}

export function setPlatformAuth(
  accessToken: string,
  admin: { id: string; email: string; name: string }
) {
  if (typeof window === "undefined") return
  localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken)
  localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(admin))
}

export function clearPlatformAuth(notify = false) {
  if (typeof window === "undefined") return
  localStorage.removeItem(PLATFORM_TOKEN_KEY)
  localStorage.removeItem(PLATFORM_ADMIN_KEY)
  if (notify) {
    window.dispatchEvent(new CustomEvent(PLATFORM_UNAUTHORIZED_EVENT))
  }
}

export function localizePlatformError(rawMessage: string): string {
  const trimmed = (rawMessage || "").trim()
  if (!trimmed) return "İşlem sırasında beklenmeyen bir hata oluştu"
  const lower = trimmed.toLowerCase()
  if (
    lower.includes("invalid platform admin auth code") ||
    lower.includes("invalid auth code") ||
    lower.includes("invalid email or password") ||
    lower.includes("unauthorized")
  ) {
    return "Geçersiz Platform Admin Auth Kodu"
  }
  if (lower.includes("too many") || lower.includes("rate limit")) {
    return "Çok fazla giriş denemesi yapıldı. Lütfen biraz bekleyip tekrar deneyin."
  }
  if (lower.includes("slug already in use")) {
    return "Bu slug (URL kısaltması) başka bir restoranda zaten kullanılıyor."
  }
  if (lower.includes("print agent username already in use")) {
    return "Bu Print Agent kullanıcı adı başka bir restoranda zaten kullanılıyor."
  }
  if (
    lower.includes("email address already exists") ||
    lower.includes("email address is already in use")
  ) {
    return "Bu e-posta adresi başka bir Boss hesabında zaten kayıtlı."
  }
  if (lower.includes("restaurant not found")) {
    return "Restoran bulunamadı."
  }
  if (lower.includes("boss account not found")) {
    return "Boss hesabı bulunamadı."
  }
  if (lower.includes("one or more selected restaurants were not found")) {
    return "Seçilen şubelerden biri veya birkaçı bulunamadı."
  }
  if (lower.includes("password must be at least 8 characters")) {
    return "Parola en az 8 karakter olmalıdır."
  }
  if (lower.includes("terminal password must be at least 4 characters")) {
    return "Terminal parolası en az 4 karakter olmalıdır."
  }
  if (lower.includes("print agent password must be at least 6 characters")) {
    return "Print Agent parolası en az 6 karakter olmalıdır."
  }
  return trimmed
}

async function platformFetch<T>(
  path: string,
  options: RequestInit = {},
  explicitToken?: string
): Promise<T> {
  const token = explicitToken || getPlatformToken()
  if (!token) {
    clearPlatformAuth(true)
    throw new Error("Oturum süresi doldu, lütfen tekrar giriş yapın")
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearPlatformAuth(true)
    throw new Error("Oturum süresi doldu, lütfen tekrar giriş yapın")
  }
  if (!res.ok) {
    const body = await res.text()
    let msg = body
    try {
      const j = JSON.parse(body)
      if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message
    } catch {}
    throw new Error(localizePlatformError(msg || `HTTP ${res.status}`))
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function getRestaurantDiagnostics(
  tokenOrRestaurantId: string,
  maybeRestaurantId?: string
): Promise<RestaurantDiagnosticsDto> {
  const hasExplicitToken = typeof maybeRestaurantId === "string"
  const token = hasExplicitToken ? tokenOrRestaurantId : undefined
  const restaurantId = hasExplicitToken ? maybeRestaurantId : tokenOrRestaurantId
  const d = await platformFetch<RestaurantDiagnosticsDto>(
    `/platform/restaurants/${restaurantId}/diagnostics`,
    { method: "GET" },
    token
  )
  return {
    ...d,
    restaurant: { ...d.restaurant, name: formatTitleCase(d.restaurant.name), brandName: d.restaurant.brandName ? formatTitleCase(d.restaurant.brandName) : null },
    openShift: d.openShift ? { ...d.openShift, openedBy: formatTitleCase(d.openShift.openedBy) } : null,
    printers: (d.printers ?? []).map((p) => ({ ...p, name: formatTitleCase(p.name), department: p.department ? formatTitleCase(p.department) : null })),
    staffMembers: (d.staffMembers ?? []).map((s) => ({ ...s, name: formatTitleCase(s.name) })),
  }
}

export async function runRestaurantSupportAction(
  tokenOrRestaurantId: string,
  restaurantIdOrBody: string | RestaurantSupportActionBody,
  maybeBody?: RestaurantSupportActionBody
): Promise<{ success?: boolean; message?: string; affectedCount?: number }> {
  const hasExplicitToken = typeof restaurantIdOrBody === "string" && maybeBody !== undefined
  const token = hasExplicitToken ? tokenOrRestaurantId : undefined
  const restaurantId = hasExplicitToken
    ? (restaurantIdOrBody as string)
    : tokenOrRestaurantId
  const body = hasExplicitToken
    ? maybeBody!
    : (restaurantIdOrBody as RestaurantSupportActionBody)
  return platformFetch<{ success?: boolean; message?: string; affectedCount?: number }>(
    `/platform/restaurants/${restaurantId}/support-action`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    token
  )
}

export const platform = {
  getRestaurantDiagnostics,
  runRestaurantSupportAction,
  auth: {
    async login(authCode: string) {
      const res = await fetch(`${BASE}/platform/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authCode: authCode.trim() }),
      })
      if (!res.ok) {
        const body = await res.text()
        let msg = "Geçersiz Platform Admin Auth Kodu"
        try {
          const j = JSON.parse(body)
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message
        } catch {}
        throw new Error(localizePlatformError(msg))
      }
      return res.json() as Promise<{
        accessToken: string
        admin: { id: string; email: string; name: string }
      }>
    },
  },
  restaurants: {
    getRestaurantDiagnostics,
    runRestaurantSupportAction,
    async getDiagnostics(id: string) {
      return getRestaurantDiagnostics(id)
    },
    async runSupportAction(id: string, body: RestaurantSupportActionBody) {
      return runRestaurantSupportAction(id, body)
    },
    async list() {
      return platformFetch<PlatformRestaurantDto[]>("/platform/restaurants")
    },
    async one(id: string) {
      return platformFetch<PlatformRestaurantDto>(`/platform/restaurants/${id}`)
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
      billingStartPeriod?: string
      recordInitialPayment?: boolean
      initialPaidMonths?: number
      initialPaymentMethod?: SubscriptionPaymentMethod
      isAccessSuspended?: boolean
      billingNotes?: string | null
      terminalEmail?: string
      terminalPassword?: string
      printAgentUsername?: string
      printAgentPassword?: string
      receiptFooterEnabled?: boolean
      receiptFooterTitle?: string | null
      receiptFooterUrl?: string | null
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
        taxId?: string
        whatsapp?: string
        instagram?: string
        facebook?: string
        website?: string
        workingHours?: string
        status?: "active" | "inactive"
        brandName?: string | null
        branchType?: RestaurantBranchType
        franchiseeCompanyName?: string | null
        royaltyRate?: number
        monthlyFee?: number
        billingStartPeriod?: string
        isAccessSuspended?: boolean
        billingNotes?: string | null
        terminalEmail?: string | null
        terminalPassword?: string
        printAgentUsername?: string | null
        printAgentPassword?: string
        receiptFooterEnabled?: boolean
        receiptFooterTitle?: string | null
        receiptFooterUrl?: string | null
      }
    ) {
      return platformFetch<PlatformRestaurantDto>(`/platform/restaurants/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
    },
    async recordPayment(id: string, body: RecordPaymentPayload) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/payments`,
        { method: "POST", body: JSON.stringify(body) }
      )
    },
    async updatePayment(id: string, paymentId: string, body: UpdatePaymentPayload) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/payments/${paymentId}`,
        { method: "PUT", body: JSON.stringify(body) }
      )
    },
    async deletePayment(id: string, paymentId: string) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/payments/${paymentId}`,
        { method: "DELETE" }
      )
    },
    async suspendUnpaid(id: string, body?: { note?: string }) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/suspend-unpaid`,
        { method: "POST", body: JSON.stringify(body ?? {}) }
      )
    },
    async unsuspendAccess(id: string, body?: { note?: string }) {
      return platformFetch<PlatformRestaurantDto>(
        `/platform/restaurants/${id}/billing/unsuspend`,
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
    async suspendAllUnpaid() {
      return platformFetch<{ suspendedCount: number; deferredOpenShiftCount?: number }>(
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
      return platformFetch<void>(
        `/platform/restaurants/${restaurantId}/root-admins/${id}`,
        { method: "DELETE" }
      )
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
    async linkRestaurant(id: string, restaurantId: string) {
      return platformFetch<BossDto>(
        `/platform/bosses/${id}/restaurants/${restaurantId}`,
        { method: "POST" }
      )
    },
    async unlinkRestaurant(id: string, restaurantId: string) {
      return platformFetch<void>(
        `/platform/bosses/${id}/restaurants/${restaurantId}`,
        { method: "DELETE" }
      )
    },
    async delete(id: string) {
      return platformFetch<void>(`/platform/bosses/${id}`, { method: "DELETE" })
    },
  },
  notifications: {
    async list() {
      return platformFetch<PlatformNotificationDto[]>("/platform/notifications")
    },
    async create(body: CreatePlatformNotificationPayload) {
      return platformFetch<PlatformNotificationDto>("/platform/notifications", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    async broadcastUpdate(body?: {
      title?: string
      message?: string
      targetRestaurantIds?: string[]
    }) {
      return platformFetch<PlatformNotificationDto>(
        "/platform/notifications/broadcast-update",
        {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        }
      )
    },
    async sendNow(id: string) {
      return platformFetch<PlatformNotificationDto>(
        `/platform/notifications/${encodeURIComponent(id)}/send-now`,
        { method: "POST", body: JSON.stringify({}) }
      )
    },
    async delete(id: string) {
      return platformFetch<{ ok: boolean; id: string }>(
        `/platform/notifications/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      )
    },
  },
}
