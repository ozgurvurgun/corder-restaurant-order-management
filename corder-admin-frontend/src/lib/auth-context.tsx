import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type { PlatformAdmin } from "./types"
import {
  platform,
  getPlatformToken,
  setPlatformAuth,
  clearPlatformAuth,
  PLATFORM_UNAUTHORIZED_EVENT,
} from "./api"

function loadStoredAdmin(): PlatformAdmin | null {
  if (typeof window === "undefined") return null
  const token = getPlatformToken()
  if (!token) return null
  try {
    const raw = localStorage.getItem("corder-platform-admin")
    if (!raw) return null
    const { id, email, name } = JSON.parse(raw)
    if (!id || !email) return null
    return { id, email, name: name || email, role: "super" }
  } catch {
    return null
  }
}

type AuthContextType = {
  user: PlatformAdmin | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function usePlatformAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider")
  return ctx
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformAdmin | null>(() => loadStoredAdmin())

  useEffect(() => {
    const syncAuth = () => {
      setUser(loadStoredAdmin())
    }
    const handleUnauthorized = () => {
      setUser(null)
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncAuth()
      }
    }
    window.addEventListener(PLATFORM_UNAUTHORIZED_EVENT, handleUnauthorized)
    window.addEventListener("storage", syncAuth)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener(PLATFORM_UNAUTHORIZED_EVENT, handleUnauthorized)
      window.removeEventListener("storage", syncAuth)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { accessToken, admin } = await platform.auth.login(email.trim(), password)
      setPlatformAuth(accessToken, admin)
      setUser({ ...admin, role: "super" })
      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Giriş başarısız",
      }
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    clearPlatformAuth(true)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
