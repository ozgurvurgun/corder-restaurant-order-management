export const getBase = () => (import.meta.env.VITE_API_URL as string) ?? ""
const WS_PATH = "/ws"
const DEFAULT_REQUEST_TIMEOUT_MS = 30000

let authExpiredHandler: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler
}

export function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(base64)
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp === "number") {
      return payload.exp * 1000 < Date.now()
    }
    return false
  } catch {
    return false
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem("panel_token")
  if (token && isJwtExpired(token)) {
    clearToken()
    return null
  }
  return token
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
  const origin = base || (typeof window !== "undefined" ? window.location.origin : "")
  if (!origin) return ""
  try {
    const url = new URL(origin)
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:"
    return `${wsProtocol}//${url.host}${WS_PATH}`
  } catch {
    return ""
  }
}

function localizeApiError(message: string, status: number): string {
  const trimmed = message.trim()
  const lower = trimmed.toLowerCase()

  if (status === 403) {
    if (lower.includes("maximum percentage discount limit")) {
      return `İndirim oranı yetki limitinizi aşıyor (${trimmed})`
    }
    if (lower.includes("maximum amount discount limit")) {
      return `İndirim tutarı yetki limitinizi aşıyor (${trimmed})`
    }
    if (
      lower.includes("you do not have permission") ||
      lower.includes("insufficient permissions") ||
      lower.includes("only be performed by") ||
      lower.includes("merchant panel access is required") ||
      lower.includes("forbidden")
    ) {
      return "Bu işlem için yetkiniz bulunmuyor."
    }
    return trimmed || "Bu işlem için yetkiniz bulunmuyor."
  }

  if (status === 401) {
    if (lower.includes("invalid credentials") || lower.includes("unauthorized")) {
      return "E-posta veya parola hatalı."
    }
    if (lower.includes("session") || lower.includes("token")) {
      return "Oturumunuz sona erdi. Lütfen tekrar giriş yapın."
    }
  }

  if (lower.includes("no open shift") || lower.includes("shift is not open")) {
    return "Açık kasa vardiyası bulunmuyor. Lütfen önce kasayı açın."
  }
  if (lower.includes("table is currently in checkout")) {
    return "Masa şu anda hesap kesiminde."
  }
  if (lower.includes("table is currently being served by")) {
    return trimmed.replace("Table is currently being served by", "Masa şu anda şu personel tarafından işlemde:")
  }

  return trimmed || `İstek başarısız oldu (HTTP ${status})`
}

export async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  const { token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal: externalSignal, ...init } = options
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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true })
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(externalSignal?.aborted ? "İstek iptal edildi." : "Sunucu yanıt vermedi (zaman aşımı).")
    }
    throw new Error("Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edin.")
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener("abort", onExternalAbort)
  }

  if (!res.ok) {
    const body = await res.text()
    let message = body
    try {
      const j = JSON.parse(body)
      message = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? body)
    } catch {}
    if (res.status === 401 && token) {
      if (
        message &&
        (message.includes("ÖDEME ALINMADIĞI İÇİN") ||
          message.toLowerCase().includes("access suspended"))
      ) {
        try {
          sessionStorage.setItem("panel_suspended_notice", message)
        } catch {}
      }
      authExpiredHandler?.()
    }
    throw new Error(localizeApiError(message || res.statusText, res.status))
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T
  return res.json()
}
