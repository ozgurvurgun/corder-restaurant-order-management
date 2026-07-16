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
      return platformFetch<Array<{
        id: string
        name: string
        slug: string
        address?: string
        phone?: string
        email?: string
        status: string
        rootAdminId?: string | null
        terminalEmail?: string | null
        printAgentToken?: string | null
        createdAt: string
      }>>("/platform/restaurants")
    },
    async one(id: string) {
      return platformFetch<{
        id: string
        name: string
        slug: string
        address?: string
        phone?: string
        email?: string
        status: string
        rootAdminId?: string | null
        terminalEmail?: string | null
        printAgentToken?: string | null
        createdAt: string
      }>(`/platform/restaurants/${id}`)
    },
    /** Product categories (defined in the restaurant panel); IDs for printer mapping. */
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
    async create(body: { name: string; slug: string; address?: string; phone?: string; email?: string; status?: "active" | "inactive" }) {
      return platformFetch<{ id: string; name: string; slug: string; address?: string; phone?: string; email?: string; status: string; rootAdminId?: string | null; createdAt: string }>(
        "/platform/restaurants",
        { method: "POST", body: JSON.stringify(body) }
      )
    },
    async update(id: string, body: { name?: string; slug?: string; address?: string; phone?: string; email?: string; status?: "active" | "inactive"; terminalEmail?: string | null; terminalPassword?: string; printAgentToken?: string | null }) {
      return platformFetch<{ id: string; name: string; slug: string; address?: string; phone?: string; email?: string; status: string; rootAdminId?: string | null; terminalEmail?: string | null; printAgentToken?: string | null; createdAt: string }>(
        `/platform/restaurants/${id}`,
        { method: "PUT", body: JSON.stringify(body) }
      )
    },
    async delete(id: string) {
      return platformFetch<void>(`/platform/restaurants/${id}`, { method: "DELETE" })
    },
  },
  rootAdmins: {
    async list(restaurantId: string) {
      return platformFetch<Array<{
        id: string
        restaurantId: string
        email: string
        name: string
        createdAt: string
      }>>(`/platform/restaurants/${restaurantId}/root-admins`)
    },
    async create(restaurantId: string, body: { name: string; email: string; password: string }) {
      return platformFetch<{ id: string; restaurantId: string; email: string; name: string; createdAt: string }>(
        `/platform/restaurants/${restaurantId}/root-admins`,
        { method: "POST", body: JSON.stringify(body) }
      )
    },
    async update(restaurantId: string, id: string, body: { name?: string; email?: string; password?: string }) {
      return platformFetch<{ id: string; restaurantId: string; email: string; name: string; createdAt: string }>(
        `/platform/restaurants/${restaurantId}/root-admins/${id}`,
        { method: "PUT", body: JSON.stringify(body) }
      )
    },
    async delete(restaurantId: string, id: string) {
      return platformFetch<void>(`/platform/restaurants/${restaurantId}/root-admins/${id}`, { method: "DELETE" })
    },
  },
}
