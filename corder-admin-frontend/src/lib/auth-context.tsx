import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { PlatformAdmin } from "./types"
import { platform, setPlatformAuth, clearPlatformAuth, getPlatformToken } from "./api"

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

function loadStoredAdmin(): PlatformAdmin | null {
  if (typeof window === "undefined") return null
  const token = getPlatformToken()
  if (!token) return null
  try {
    const raw = localStorage.getItem("corder-platform-admin")
    if (!raw) return null
    const { id, email, name } = JSON.parse(raw)
    return { id, email, name, role: "super" }
  } catch {
    return null
  }
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformAdmin | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setUser(loadStoredAdmin())
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { accessToken, admin } = await platform.auth.login(email, password)
      setPlatformAuth(accessToken, admin)
      setUser({ ...admin, role: "super" })
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Giriş başarısız" }
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    clearPlatformAuth()
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-dvh bg-[#0f0f0f] flex items-center justify-center" suppressHydrationWarning>
        <span className="text-zinc-500 text-sm">Yükleniyor…</span>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
