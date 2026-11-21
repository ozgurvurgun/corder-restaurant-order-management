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
    if (!id) return null
    return {
      id,
      email: email || "admin@corder.app",
      name: name || email || "Platform Admin",
      role: "super",
    }
  } catch {
    return null
  }
}

type AuthContextType = {
  user: PlatformAdmin | null
  token: string | null
  isAuthenticated: boolean
  verifyCredentials: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; email?: string; name?: string; error?: string }>
  login: (params: {
    email: string
    password: string
    authCode: string
  }) => Promise<{ success: boolean; error?: string }>
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

  const verifyCredentials = useCallback(async (email: string, password: string) => {
    try {
      const res = await platform.auth.verifyCredentials(email.trim(), password)
      return {
        success: true,
        email: res.email,
        name: res.name,
      }
    } catch (e) {
      return {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "Geçersiz yönetici kullanıcı adı veya parola",
      }
    }
  }, [])

  const login = useCallback(
    async (params: { email: string; password: string; authCode: string }) => {
      try {
        const { accessToken, admin } = await platform.auth.login(params)
        const safeAdmin = {
          id: admin?.id || "platform-admin",
          email: admin?.email || "admin@corder.app",
          name: admin?.name || "Platform Admin",
        }
        setPlatformAuth(accessToken, safeAdmin)
        setUser({ ...safeAdmin, role: "super" })
        return { success: true }
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Giriş başarısız",
        }
      }
    },
    [],
  )

  const logout = useCallback(() => {
    setUser(null)
    clearPlatformAuth(true)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token: user ? getPlatformToken() : null,
        isAuthenticated: !!user,
        verifyCredentials,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
