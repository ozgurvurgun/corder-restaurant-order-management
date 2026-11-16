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
  isActive?: boolean
  restaurants?: Array<{ id: string; name: string; slug: string; status: string }>
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
      const payload = {
        name: body.name,
        slug: body.slug,
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      }
      return platformFetch<{ id: string; name: string; slug: string; address?: string; phone?: string; email?: string; status: string; rootAdminId?: string | null; createdAt: string }>(
        "/platform/restaurants",
        { method: "POST", body: JSON.stringify(payload) }
      )
    },
    async update(id: string, body: { name?: string; slug?: string; address?: string; phone?: string; email?: string; status?: "active" | "inactive"; terminalEmail?: string | null; terminalPassword?: string; printAgentToken?: string | null }) {
      const payload = {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.terminalEmail !== undefined ? { terminalEmail: body.terminalEmail } : {}),
        ...(body.terminalPassword !== undefined ? { terminalPassword: body.terminalPassword } : {}),
        ...(body.printAgentToken !== undefined ? { printAgentToken: body.printAgentToken } : {}),
      }
      return platformFetch<{ id: string; name: string; slug: string; address?: string; phone?: string; email?: string; status: string; rootAdminId?: string | null; terminalEmail?: string | null; printAgentToken?: string | null; createdAt: string }>(
        `/platform/restaurants/${id}`,
        { method: "PUT", body: JSON.stringify(payload) }
      )
    },
    async delete(id: string) {
      return platformFetch<void>(`/platform/restaurants/${id}`, { method: "DELETE" })
    },
  },
  rootAdmins: {
    async list(restaurantId: string) {
      return platformFetch<BossDto[]>(`/platform/restaurants/${restaurantId}/root-admins`)
    },
    async create(restaurantId: string, body: { name: string; email: string; phone?: string; password: string }) {
      const payload = {
        name: body.name,
        email: body.email,
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        password: body.password,
      }
      return platformFetch<BossDto>(
        `/platform/restaurants/${restaurantId}/root-admins`,
        { method: "POST", body: JSON.stringify(payload) }
      )
    },
    async linkExisting(restaurantId: string, bossId: string) {
      return platformFetch<BossDto>(
        `/platform/restaurants/${restaurantId}/root-admins/link/${bossId}`,
        { method: "POST" }
      )
    },
    async update(restaurantId: string, id: string, body: { name?: string; email?: string; phone?: string | null; password?: string; isActive?: boolean; restaurantIds?: string[] }) {
      const payload = {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.password !== undefined ? { password: body.password } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.restaurantIds !== undefined ? { restaurantIds: body.restaurantIds } : {}),
      }
      return platformFetch<BossDto>(
        `/platform/restaurants/${restaurantId}/root-admins/${id}`,
        { method: "PUT", body: JSON.stringify(payload) }
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
      password: string
      restaurantIds?: string[]
    }) {
      const payload = {
        name: body.name,
        email: body.email,
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        password: body.password,
        ...(body.restaurantIds !== undefined ? { restaurantIds: body.restaurantIds } : {}),
      }
      return platformFetch<BossDto>("/platform/bosses", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    },
    async update(
      id: string,
      body: {
        name?: string
        email?: string
        phone?: string | null
        password?: string
        isActive?: boolean
        restaurantIds?: string[]
      }
    ) {
      const payload = {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.password !== undefined ? { password: body.password } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.restaurantIds !== undefined ? { restaurantIds: body.restaurantIds } : {}),
      }
      return platformFetch<BossDto>(`/platform/bosses/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    },
    async delete(id: string) {
      return platformFetch<void>(`/platform/bosses/${id}`, { method: "DELETE" })
    },
  },
}
