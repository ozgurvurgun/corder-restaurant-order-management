import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { api, getToken, setToken, setRestaurant, clearToken, getRestaurant, setAuthExpiredHandler, setSessionUser } from "./api"

export interface Business {
  id: string
  slug: string
  name: string
  username?: string
  password?: string
  logo?: string
  address?: string
  phone?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  website?: string
  workingHours?: string
}

interface PanelAuthContextType {
  isAuthenticated: boolean
  currentBusiness: Business | null
  token: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  businesses: Business[]
}

const PanelAuthContext = createContext<PanelAuthContextType | null>(null)

export function usePanelAuth() {
  const ctx = useContext(PanelAuthContext)
  if (!ctx) throw new Error("usePanelAuth must be used within PanelAuthProvider")
  return ctx
}

function toBusiness(restaurant: { id: string; name: string; slug: string }): Business {
  return { id: restaurant.id, slug: restaurant.slug, name: restaurant.name }
}

export function PanelAuthProvider({ children }: { children: ReactNode }) {
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = getToken()
    const r = getRestaurant()
    if (t && r) {
      setTokenState(t)
      setCurrentBusiness(toBusiness(r))
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.restaurant.login(email, password)
      if (res.user.role !== "root") {
        return {
          success: false,
          error: "Bu hesap ile yonetim paneline giris yapilamaz. Yalniz yonetici (root) hesabi kabul edilir.",
        }
      }
      setToken(res.accessToken)
      setRestaurant(res.restaurant)
      setSessionUser(res.user)
      setTokenState(res.accessToken)
      setCurrentBusiness(toBusiness(res.restaurant))
      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Giriş başarısız",
      }
    }
  }, [])

  const logout = useCallback(() => {
    setCurrentBusiness(null)
    setTokenState(null)
    clearToken()
  }, [])

  useEffect(() => {
    setAuthExpiredHandler(() => {
      logout()
    })
    return () => setAuthExpiredHandler(null)
  }, [logout])

  if (!mounted) {
    return (
      <PanelAuthContext.Provider
        value={{
          isAuthenticated: false,
          currentBusiness: null,
          token: null,
          login,
          logout,
          businesses: [],
        }}
      >
        {children}
      </PanelAuthContext.Provider>
    )
  }

  const isAuthenticated = !!currentBusiness && !!token

  return (
    <PanelAuthContext.Provider
      value={{
        isAuthenticated,
        currentBusiness,
        token,
        login,
        logout,
        businesses: currentBusiness ? [currentBusiness] : [],
      }}
    >
      {children}
    </PanelAuthContext.Provider>
  )
}

export function getBusinessBySlug(_slug: string): Business | undefined {
  const r = getRestaurant()
  if (!r) return undefined
  return r.slug === _slug ? toBusiness(r) : undefined
}

export function getAllBusinessSlugs(): string[] {
  const r = getRestaurant()
  return r ? [r.slug] : []
}
