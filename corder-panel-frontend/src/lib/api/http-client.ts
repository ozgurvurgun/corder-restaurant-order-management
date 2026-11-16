export const getBase = () => (import.meta.env.VITE_API_URL as string) ?? ""
const WS_PATH = "/ws"

let authExpiredHandler: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("panel_token")
}

export function setToken(token: string) {
  localStorage.setItem("panel_token", token)
}

export type PanelSessionUser = {
  id: string
  name: string
  email: string
  role: string
  staffRole?: string
  roleLabel?: string
  isBoss?: boolean
  permissions?: string[]
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
}

const PANEL_SESSION_USER_KEY = "panel_session_user"
const PANEL_BRANCHES_KEY = "panel_branches"

export function getSessionUser(): PanelSessionUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(PANEL_SESSION_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PanelSessionUser
  } catch {
    return null
  }
}

export function setSessionUser(user: PanelSessionUser) {
  localStorage.setItem(PANEL_SESSION_USER_KEY, JSON.stringify(user))
}

export function clearSessionUser() {
  localStorage.removeItem(PANEL_SESSION_USER_KEY)
}

export function getStoredBranches(): Array<{ id: string; name: string; slug: string }> {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(PANEL_BRANCHES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function setStoredBranches(branches: Array<{ id: string; name: string; slug: string }>) {
  if (typeof window === "undefined") return
  localStorage.setItem(PANEL_BRANCHES_KEY, JSON.stringify(branches))
}

export function clearToken() {
  localStorage.removeItem("panel_token")
  localStorage.removeItem("panel_restaurant")
  localStorage.removeItem(PANEL_BRANCHES_KEY)
  clearSessionUser()
}

export function getRestaurant(): { id: string; name: string; slug: string } | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("panel_restaurant")
  if (!raw) return null
  try {
    return JSON.parse(raw) as { id: string; name: string; slug: string }
  } catch {
    return null
  }
}

export function setRestaurant(restaurant: { id: string; name: string; slug: string }) {
  localStorage.setItem("panel_restaurant", JSON.stringify(restaurant))
}

export function getWsUrl(): string {
  const base = getBase()
  if (!base) return ""
  const url = new URL(base)
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:"
  return `${wsProtocol}//${url.host}${WS_PATH}`
}

export async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = options
  const url = `${getBase()}${path}`
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`
  const currentRest = getRestaurant()
  if (currentRest?.id && !headers["x-restaurant-id"]) {
    headers["x-restaurant-id"] = currentRest.id
  }
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401 && token) {
    authExpiredHandler?.()
  }
  if (!res.ok) {
    const body = await res.text()
    let message = body
    try {
      const j = JSON.parse(body)
      message = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? body)
    } catch {}
    throw new Error(message || res.statusText)
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T
  return res.json()
}
