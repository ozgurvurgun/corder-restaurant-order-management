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

export type StaffRole = "garson" | "mudur" | "kasiyer"

export interface StaffSession {
  staffId: string
  name: string
  role: StaffRole
  staffToken: string
  expiresAt: number
}

const STAFF_SESSION_KEY = "terminal_staff_session"
const STAFF_SESSION_MS = 12 * 60 * 60 * 1000 // 12 hours

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
    return data as StaffSession
  } catch {
    localStorage.removeItem(STAFF_SESSION_KEY)
    return null
  }
}

export function setStaffSession(session: Omit<StaffSession, "expiresAt">): StaffSession {
  const data: StaffSession = {
    ...session,
    expiresAt: Date.now() + STAFF_SESSION_MS,
  }
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(data))
  return data
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_SESSION_KEY)
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
      const j = JSON.parse(body)
      message = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? body)
    } catch {}
    if ((res.status === 401 || res.status === 403) && token && !skipAuthExpired) {
      if (res.status === 401 && typeof message === "string" && message.toLowerCase().includes("personel")) {
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
      }>(
        "/restaurant/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),
  },
  tables: {
    list: (token: string) =>
      request<
        {
          id: string
          name: string
          section: string
          status: string
          sessionStaffId?: string | null
          sessionStaffName?: string | null
          sessionLockedAt?: string | null
        }[]
      >("/restaurant/tables", { token }),
    presence: (token: string) =>
      request<Record<string, { staffId: string; staffName: string }>>("/restaurant/tables/presence", { token }),
    sessionLock: async (
      token: string,
      tableId: string,
    ): Promise<{ ok: true } | { ok: false; holderName: string }> => {
      const staffSession = getStaffSession()
      if (!staffSession?.staffToken) {
        staffExpiredHandler?.()
        throw new Error("Personel PIN dogrulamasi gerekli")
      }
      const url = `${getBase()}/restaurant/tables/${encodeURIComponent(tableId)}/session-lock`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Staff-Token": staffSession.staffToken,
        },
        body: JSON.stringify({}),
      })
      if (res.status === 409) {
        const j = (await res.json().catch(() => ({}))) as {
          holderName?: string
          message?: unknown
        }
        const holderName =
          typeof j.holderName === "string"
            ? j.holderName
            : typeof j.message === "object" &&
                j.message !== null &&
                typeof (j.message as { holderName?: string }).holderName === "string"
              ? (j.message as { holderName: string }).holderName
              : "Garson"
        return { ok: false, holderName }
      }
      if (!res.ok) {
        const t = await res.text()
        let message = t
        try {
          const j = JSON.parse(t)
          message = j.message ?? t
        } catch {}
        if (res.status === 401) {
          if (typeof message === "string" && message.toLowerCase().includes("personel")) {
            staffExpiredHandler?.()
          } else {
            authExpiredHandler?.()
          }
        }
        throw new Error(message || "Kilitleme basarisiz")
      }
      return { ok: true }
    },
    sessionUnlock: (token: string, tableId: string) =>
      request<{ ok: boolean }>(`/restaurant/tables/${encodeURIComponent(tableId)}/session-unlock`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      }),
  },
  orders: {
    list: (token: string, tableId?: string) => {
      const q = tableId ? `?tableId=${encodeURIComponent(tableId)}` : ""
      return request<OrderDto[]>(`/restaurant/orders${q}`, { token })
    },
    create: (
      token: string,
      body: {
        tableId: string
        items: { productId: string; quantity: number; note?: string }[]
      },
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
      },
    ) =>
      request<OrderDto>("/restaurant/orders/move-items", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
    printReceipt: (
      token: string,
      body:
        | { tableId: string }
        | {
            tableName: string
            waiterName?: string
            items: { productName: string; quantity: number; price: number; note?: string }[]
            total: number
          },
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
        role: StaffRole
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
  products: { id: string; name: string; description?: string; price: number; imageUrl?: string; inStock: boolean }[]
  children?: MenuCategoryTree[]
}

export interface MenuBusinessDto {
  id: string
  name: string
  slug: string
  categories: MenuCategoryTree[]
}
