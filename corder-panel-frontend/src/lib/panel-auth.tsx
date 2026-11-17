import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import {
  api,
  getToken,
  setToken,
  setRestaurant,
  clearToken,
  getRestaurant,
  setAuthExpiredHandler,
  setSessionUser,
  getSessionUser,
  getStoredBranches,
  setStoredBranches,
  type PanelSessionUser,
} from "./api"

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
  sessionUser: PanelSessionUser | null
  isBoss: boolean
  permissions: string[]
  limits: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  hasPermission: (...required: string[]) => boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  businesses: Business[]
  switchBusiness: (branchId: string) => Promise<void>
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
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [token, setTokenState] = useState<string | null>(null)
  const [sessionUser, setSessionUserState] = useState<PanelSessionUser | null>(null)
  const [mounted, setMounted] = useState(false)

  const logout = useCallback(() => {
    setCurrentBusiness(null)
    setBusinesses([])
    setTokenState(null)
    setSessionUserState(null)
    clearToken()
  }, [])

  useEffect(() => {
    setMounted(true)
    const t = getToken()
    const r = getRestaurant()
    const su = getSessionUser()
    const brs = getStoredBranches()
    if (t && r) {
      setTokenState(t)
      setCurrentBusiness(toBusiness(r))
      setSessionUserState(su)
      setBusinesses(brs.length > 0 ? brs.map(toBusiness) : [toBusiness(r)])
      // Refresh live permissions & branches in background
      void api.restaurant
        .me(t)
        .then((meRes) => {
          if (meRes.user.role !== "root" && meRes.user.role !== "staff") {
            logout()
            return
          }
          setSessionUser(meRes.user)
          setSessionUserState(meRes.user)
          if (meRes.restaurant) {
            setRestaurant(meRes.restaurant)
            setCurrentBusiness(toBusiness(meRes.restaurant))
          }
          if (meRes.restaurants?.length) {
            setStoredBranches(meRes.restaurants)
            setBusinesses(meRes.restaurants.map(toBusiness))
          }
        })
        .catch(() => {
          // 401 is handled by authExpiredHandler -> logout()
        })
    }
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.restaurant.login(email, password)
      if (res.user.role !== "root" && res.user.role !== "staff") {
        return {
          success: false,
          error:
            "Bu hesap ile yönetim paneline giriş yapılamaz. Yalnız Boss veya yetkili Panel kullanıcısı kabul edilir.",
        }
      }
      const brList =
        res.restaurants && res.restaurants.length > 0
          ? res.restaurants
          : [res.restaurant]
      setToken(res.accessToken)
      setRestaurant(res.restaurant)
      setStoredBranches(brList)
      setSessionUser(res.user)
      setTokenState(res.accessToken)
      setCurrentBusiness(toBusiness(res.restaurant))
      setBusinesses(brList.map(toBusiness))
      setSessionUserState(res.user)
      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Giriş başarısız",
      }
    }
  }, [])

  const switchBusiness = useCallback(
    async (branchId: string) => {
      if (!token) return
      try {
        const res = await api.restaurant.switchBranch(token, branchId)
        setToken(res.accessToken)
        setRestaurant(res.restaurant)
        setStoredBranches(res.restaurants)
        setTokenState(res.accessToken)
        setCurrentBusiness(toBusiness(res.restaurant))
        setBusinesses(res.restaurants.map(toBusiness))
      } catch {
        const target = businesses.find((b) => b.id === branchId)
        if (target) {
          setRestaurant(target)
          setCurrentBusiness(target)
        }
      }
    },
    [token, businesses]
  )

  useEffect(() => {
    setAuthExpiredHandler(() => {
      logout()
    })
    return () => setAuthExpiredHandler(null)
  }, [logout])

  const isBoss = Boolean(
    sessionUser?.isBoss || sessionUser?.role === "root"
  )
  const permissions = sessionUser?.permissions ?? []
  const limits = sessionUser?.limits ?? {
    maxDiscountPercent: isBoss ? 100 : 0,
    maxDiscountAmount: isBoss ? null : 0,
  }

  const hasPermission = useCallback(
    (...required: string[]): boolean => {
      if (isBoss) return true
      if (required.length === 0) return true
      return required.some((perm) => permissions.includes(perm))
    },
    [isBoss, permissions]
  )

  if (!mounted) {
    return (
      <PanelAuthContext.Provider
        value={{
          isAuthenticated: false,
          currentBusiness: null,
          token: null,
          sessionUser: null,
          isBoss: false,
          permissions: [],
          limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
          hasPermission: () => false,
          login,
          logout,
          businesses: [],
          switchBusiness,
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
        sessionUser,
        isBoss,
        permissions,
        limits,
        hasPermission,
        login,
        logout,
        businesses: businesses.length > 0 ? businesses : currentBusiness ? [currentBusiness] : [],
        switchBusiness,
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
