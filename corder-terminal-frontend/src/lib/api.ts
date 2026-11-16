import type { PaymentMethod, StaffRole } from "./types"

export type { PaymentMethod, StaffRole }

export const getBase = () => (import.meta.env.VITE_API_URL as string) ?? ""

let authExpiredHandler: (() => void) | null = null
let staffExpiredHandler: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler
}

export function setStaffExpiredHandler(handler: (() => void) | null) {
  staffExpiredHandler = handler
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("terminal_token")
}

export function setToken(token: string) {
  localStorage.setItem("terminal_token", token)
}

export function clearToken() {
  localStorage.removeItem("terminal_token")
  localStorage.removeItem("terminal_restaurant")
}

export function getRestaurant(): { id: string; name: string; slug: string } | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("terminal_restaurant")
  if (!raw) return null
  try {
    return JSON.parse(raw) as { id: string; name: string; slug: string }
  } catch {
    return null
  }
}

export function setRestaurant(restaurant: { id: string; name: string; slug: string }) {
  localStorage.setItem("terminal_restaurant", JSON.stringify(restaurant))
}

export interface StaffSession {
  staffId: string
  name: string
  role: StaffRole
  roleLabel?: string
  permissions?: string[]
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  staffToken: string
  expiresAt: number
}

export interface CloseCheckBody {
  method: "cash" | "credit-card" | "meal-card" | "multinet" | "split" | "ledger"
  discountAmount?: number
  paidAmount?: number
  customerName?: string
}

const STAFF_SESSION_KEY = "terminal_staff_session"
const STAFF_SESSION_MS = 12 * 60 * 60 * 1000 // 12 hours

export function normalizeStaffRole(role: string): StaffRole {
  return role || "waiter"
}

export function getStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(STAFF_SESSION_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<StaffSession>
    if (
      typeof data.staffId !== "string" ||
      typeof data.name !== "string" ||
      typeof data.role !== "string" ||
      typeof data.staffToken !== "string" ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(STAFF_SESSION_KEY)
      return null
    }
    return {
      staffId: data.staffId,
      name: data.name,
      role: normalizeStaffRole(data.role),
      roleLabel: data.roleLabel,
      permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
      limits: data.limits,
      staffToken: data.staffToken,
      expiresAt: data.expiresAt,
    }
  } catch {
    localStorage.removeItem(STAFF_SESSION_KEY)
    return null
  }
}

export function setStaffSession(session: Omit<StaffSession, "expiresAt">): StaffSession {
  const data: StaffSession = {
    ...session,
    role: normalizeStaffRole(session.role),
    expiresAt: Date.now() + STAFF_SESSION_MS,
  }
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(data))
  return data
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_SESSION_KEY)
}

function isStaffAuthError(status: number, message: unknown): boolean {
  if (status !== 401 || typeof message !== "string") return false
  const lower = message.toLowerCase()
  return lower.includes("personel") || lower.includes("staff")
}

async function request<T>(
  path: string,
  options: RequestInit & {
    token?: string | null
    skipAuthExpired?: boolean
    skipStaffToken?: boolean
  } = {}
): Promise<T> {
  const { token, skipAuthExpired, skipStaffToken, ...init } = options
  const url = `${getBase()}${path}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
    if (!skipStaffToken) {
      const staffSession = getStaffSession()
      if (staffSession?.staffToken) {
        headers["X-Staff-Token"] = staffSession.staffToken
      }
    }
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const body = await res.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = Array.isArray(parsed.message) ? parsed.message.join(", ") : (parsed.message ?? body)
    } catch {
      // Use raw response text when body is not JSON
    }
    if (res.status === 401 && token && !skipAuthExpired) {
      if (isStaffAuthError(res.status, message)) {
        staffExpiredHandler?.()
      } else {
        authExpiredHandler?.()
      }
    }
    throw new Error(message || res.statusText)
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T
  return res.json()
}

export const api = {
  restaurant: {
    login: (email: string, password: string) =>
      request<{
        accessToken: string
        restaurant: { id: string; name: string; slug: string }
        user: { id: string; email: string; name: string; role: "root" | "terminal" }
      }>("/restaurant/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },
  tables: {
    list: (token: string) =>
      request<RawTableDto[]>("/restaurant/tables", { token }),
    presence: (token: string) =>
      request<Record<string, { staffId: string; staffName: string }>>("/restaurant/tables/presence", { token }),
    sessionLock: async (
      token: string,
      tableId: string,
      force = false
    ): Promise<{ ok: true } | { ok: false; holderName: string; canForceUnlock?: boolean }> => {
      const staffSession = getStaffSession()
      if (!staffSession?.staffToken) {
        staffExpiredHandler?.()
        throw new Error("Personel PIN doğrulaması gerekli")
      }
      const url = `${getBase()}/restaurant/tables/${encodeURIComponent(tableId)}/session-lock`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Staff-Token": staffSession.staffToken,
        },
        body: JSON.stringify(force ? { force: true } : {}),
      })
      if (res.status === 409) {
        const parsed = (await res.json().catch(() => ({}))) as {
          holderName?: string
          canForceUnlock?: boolean
          message?: unknown
        }
        const holderName =
          typeof parsed.holderName === "string"
            ? parsed.holderName
            : typeof parsed.message === "object" &&
                parsed.message !== null &&
                typeof (parsed.message as { holderName?: string }).holderName === "string"
              ? (parsed.message as { holderName: string }).holderName
              : "Garson"
        return { ok: false, holderName, canForceUnlock: Boolean(parsed.canForceUnlock) }
      }
      if (!res.ok) {
        const rawText = await res.text()
        let message = rawText
        try {
          const parsed = JSON.parse(rawText)
          message = parsed.message ?? rawText
        } catch {
          // Keep raw text when response is not JSON
        }
        if (res.status === 401) {
          if (isStaffAuthError(res.status, message)) {
            staffExpiredHandler?.()
          } else {
            authExpiredHandler?.()
          }
        }
        throw new Error(message || "Kilitleme başarısız")
      }
      return { ok: true }
    },
    sessionUnlock: (token: string, tableId: string) =>
      request<{ ok: boolean }>(`/restaurant/tables/${encodeURIComponent(tableId)}/session-unlock`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      }),
    closeCheck: (token: string, tableId: string, body: CloseCheckBody) =>
      request<{ ok: boolean }>(`/restaurant/tables/${encodeURIComponent(tableId)}/close-check`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
  },
  orders: {
    list: (token: string, tableId?: string) => {
      const query = tableId ? `?tableId=${encodeURIComponent(tableId)}` : ""
      return request<OrderDto[]>(`/restaurant/orders${query}`, { token })
    },
    create: (
      token: string,
      body: {
        tableId: string
        items: { productId: string; quantity: number; note?: string }[]
      }
    ) =>
      request<OrderDto>("/restaurant/orders", { method: "POST", token, body: JSON.stringify(body) }),
    move: (token: string, fromTableId: string, toTableId: string) =>
      request<{ moved: number }>("/restaurant/orders/move", {
        method: "PATCH",
        token,
        body: JSON.stringify({ fromTableId, toTableId }),
      }),
    moveItems: (
      token: string,
      body: {
        fromTableId: string
        toTableId: string
        itemIds: string[]
      }
    ) =>
      request<OrderDto>("/restaurant/orders/move-items", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
    cancelItem: (token: string, _orderId: string, itemId: string, reason = "Terminal iptali") =>
      request<{ ok: true }>(
        "/restaurant/orders/cancel-item",
        {
          method: "POST",
          token,
          body: JSON.stringify({ itemId, reason }),
        }
      ),
    printReceipt: (
      token: string,
      body:
        | { tableId: string }
        | {
            tableName: string
            waiterName?: string
            items: { productName: string; quantity: number; price: number; note?: string }[]
            total: number
          }
    ) =>
      request<{ ok: true; jobId: string }>("/restaurant/orders/print-receipt", {
        method: "POST",
        token,
        body: JSON.stringify({ ...body, receiptMode: "split" as const }),
      }),
  },
  menu: {
    terminal: (token: string) =>
      request<MenuBusinessDto>("/restaurant/menu", { token }),
  },
  staff: {
    verifyPin: (token: string, pin: string) =>
      request<{
        staffId: string
        name: string
        role: string
        roleLabel?: string
        permissions?: string[]
        limits?: {
          maxDiscountPercent: number
          maxDiscountAmount: number | null
        }
        staffToken: string
      }>("/restaurant/staff/verify-pin", {
        method: "POST",
        token,
        skipAuthExpired: true,
        skipStaffToken: true,
        body: JSON.stringify({ pin }),
      }),
  },
}

export interface RawTableDto {
  id: string
  name: string
  section: string
  status: string
  capacity?: number
  sessionStaffId?: string | null
  sessionStaffName?: string | null
  sessionLockedAt?: string | null
}

export interface OrderItemDto {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: string
  createdAt: string
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

export type MenuCategoryTree = {
  id: string
  name: string
  slug: string
  products: {
    id: string
    name: string
    description?: string
    price: number
    imageUrl?: string
    inStock: boolean
  }[]
  children?: MenuCategoryTree[]
}

export interface MenuBusinessDto {
  id: string
  name: string
  slug: string
  categories: MenuCategoryTree[]
}
