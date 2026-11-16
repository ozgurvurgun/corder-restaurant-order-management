import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type {
  BossTier,
  PlatformBillingConfig,
  Restaurant,
  RestaurantBillingStatus,
  RootAdmin,
} from "./types"
import { platform, getPlatformToken, type BossDto, type PlatformRestaurantDto } from "./api"

function toRestaurant(r: PlatformRestaurantDto): Restaurant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    status: r.status === "inactive" ? "inactive" : "active",
    brandName: r.brandName ?? null,
    branchType: r.branchType ?? "independent",
    franchiseeCompanyName: r.franchiseeCompanyName ?? null,
    royaltyRate: Number(r.royaltyRate ?? 0),
    monthlyFee: Number(r.monthlyFee ?? 0),
    billingStatus: r.billingStatus ?? "paid",
    isAccessSuspended: Boolean(r.isAccessSuspended),
    suspensionReason: r.suspensionReason ?? null,
    suspendedAt: r.suspendedAt ?? null,
    lastPaymentDate: r.lastPaymentDate ?? null,
    lastPaidPeriod: r.lastPaidPeriod ?? null,
    billingNotes: r.billingNotes ?? null,
    paymentHistory: r.paymentHistory ?? [],
    bosses: r.bosses ?? [],
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
    rootAdminId: r.rootAdminId ?? undefined,
    terminalEmail: r.terminalEmail ?? undefined,
    printAgentUsername: r.printAgentUsername ?? undefined,
  }
}

function toRootAdmin(a: BossDto): RootAdmin {
  return {
    id: a.id,
    restaurantId: a.restaurantId ?? null,
    email: a.email,
    name: a.name,
    phone: a.phone ?? null,
    bossTier: a.bossTier ?? "franchise_owner",
    brandName: a.brandName ?? null,
    isActive: a.isActive ?? true,
    restaurants: a.restaurants ?? [],
    createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date(a.createdAt).toISOString(),
  }
}

type StoreContextType = {
  restaurants: Restaurant[]
  restaurantsLoading: boolean
  restaurantsError: string | null
  loadRestaurants: () => Promise<void>
  addRestaurant: (r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId"> & { printAgentPassword?: string }) => Promise<void>
  updateRestaurant: (id: string, r: Partial<Restaurant> & { terminalPassword?: string; printAgentPassword?: string }) => Promise<void>
  updateRestaurantBilling: (
    id: string,
    body: { billingStatus: RestaurantBillingStatus; monthlyFee?: number; period?: string; note?: string | null }
  ) => Promise<void>
  markRestaurantPaid: (id: string, body?: { amount?: number; period?: string; note?: string }) => Promise<void>
  suspendRestaurantUnpaid: (id: string, note?: string) => Promise<void>
  deleteRestaurant: (id: string) => Promise<void>
  billingConfig: PlatformBillingConfig | null
  loadBillingConfig: () => Promise<void>
  updateBillingConfig: (body: Partial<PlatformBillingConfig>) => Promise<void>
  startMonthlyCollectionCycle: (period?: string) => Promise<{ period: string; updatedCount: number }>
  suspendAllUnpaidRestaurants: () => Promise<{ suspendedCount: number }>
  rootAdminsForRestaurant: RootAdmin[]
  rootAdminsLoading: boolean
  rootAdminsError: string | null
  loadRootAdmins: (restaurantId: string) => Promise<void>
  addRootAdmin: (
    restaurantId: string,
    r: { name: string; email: string; phone?: string; bossTier?: BossTier; brandName?: string | null; password: string }
  ) => Promise<void>
  linkExistingBoss: (restaurantId: string, bossId: string) => Promise<void>
  updateRootAdmin: (restaurantId: string, id: string, r: Partial<Pick<RootAdmin, "name" | "email"> & { password?: string }>) => Promise<void>
  deleteRootAdmin: (restaurantId: string, id: string) => Promise<void>
  allBosses: RootAdmin[]
  bossesLoading: boolean
  loadAllBosses: () => Promise<void>
  createBoss: (body: {
    name: string
    email: string
    phone?: string
    bossTier?: BossTier
    brandName?: string | null
    password: string
    restaurantIds: string[]
  }) => Promise<void>
  updateBoss: (
    id: string,
    body: {
      name?: string
      email?: string
      phone?: string | null
      bossTier?: BossTier
      brandName?: string | null
      password?: string
      isActive?: boolean
      restaurantIds?: string[]
    }
  ) => Promise<void>
  deleteBoss: (id: string) => Promise<void>
}

const StoreContext = createContext<StoreContextType | null>(null)

export function useAdminStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useAdminStore must be used within AdminStoreProvider")
  return ctx
}

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantsLoading, setRestaurantsLoading] = useState(false)
  const [restaurantsError, setRestaurantsError] = useState<string | null>(null)
  const [billingConfig, setBillingConfig] = useState<PlatformBillingConfig | null>(null)
  const [rootAdminsForRestaurant, setRootAdminsForRestaurant] = useState<RootAdmin[]>([])
  const [rootAdminsLoading, setRootAdminsLoading] = useState(false)
  const [rootAdminsError, setRootAdminsError] = useState<string | null>(null)
  const [allBosses, setAllBosses] = useState<RootAdmin[]>([])
  const [bossesLoading, setBossesLoading] = useState(false)

  const loadRestaurants = useCallback(async () => {
    if (!getPlatformToken()) return
    setRestaurantsLoading(true)
    setRestaurantsError(null)
    try {
      const list = await platform.restaurants.list()
      setRestaurants(list.map(toRestaurant))
    } catch (e) {
      setRestaurantsError(e instanceof Error ? e.message : "Restoranlar yüklenemedi")
    } finally {
      setRestaurantsLoading(false)
    }
  }, [])

  const loadBillingConfig = useCallback(async () => {
    if (!getPlatformToken()) return
    try {
      const cfg = await platform.billing.getConfig()
      setBillingConfig(cfg)
    } catch {
      // ignore
    }
  }, [])

  const updateBillingConfig = useCallback(async (body: Partial<PlatformBillingConfig>) => {
    const updated = await platform.billing.updateConfig(body)
    setBillingConfig(updated)
  }, [])

  const loadAllBosses = useCallback(async () => {
    if (!getPlatformToken()) return
    setBossesLoading(true)
    try {
      const list = await platform.bosses.list()
      setAllBosses(list.map(toRootAdmin))
    } catch {
      // ignore
    } finally {
      setBossesLoading(false)
    }
  }, [])

  const addRestaurant = useCallback(async (r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId"> & { printAgentPassword?: string }) => {
    await platform.restaurants.create({
      name: r.name,
      slug: r.slug,
      address: r.address,
      phone: r.phone,
      email: r.email,
      status: r.status,
      brandName: r.brandName,
      branchType: r.branchType,
      franchiseeCompanyName: r.franchiseeCompanyName,
      royaltyRate: r.royaltyRate,
      monthlyFee: r.monthlyFee,
      billingStatus: r.billingStatus,
      isAccessSuspended: r.isAccessSuspended,
      billingNotes: r.billingNotes,
      printAgentUsername: r.printAgentUsername ?? undefined,
      printAgentPassword: r.printAgentPassword,
    })
    await Promise.all([loadRestaurants(), loadAllBosses()])
  }, [loadRestaurants, loadAllBosses])

  const updateRestaurant = useCallback(async (id: string, r: Partial<Restaurant> & { terminalPassword?: string; printAgentPassword?: string }) => {
    await platform.restaurants.update(id, {
      name: r.name,
      slug: r.slug,
      address: r.address,
      phone: r.phone,
      email: r.email,
      status: r.status,
      brandName: r.brandName,
      branchType: r.branchType,
      franchiseeCompanyName: r.franchiseeCompanyName,
      royaltyRate: r.royaltyRate,
      monthlyFee: r.monthlyFee,
      billingStatus: r.billingStatus,
      isAccessSuspended: r.isAccessSuspended,
      billingNotes: r.billingNotes,
      terminalEmail: r.terminalEmail,
      terminalPassword: r.terminalPassword,
      printAgentUsername: r.printAgentUsername,
      printAgentPassword: r.printAgentPassword,
    })
    await Promise.all([loadRestaurants(), loadAllBosses()])
  }, [loadRestaurants, loadAllBosses])

  const updateRestaurantBilling = useCallback(
    async (
      id: string,
      body: { billingStatus: RestaurantBillingStatus; monthlyFee?: number; period?: string; note?: string | null }
    ) => {
      await platform.restaurants.updateBilling(id, body)
      await loadRestaurants()
    },
    [loadRestaurants]
  )

  const markRestaurantPaid = useCallback(
    async (id: string, body?: { amount?: number; period?: string; note?: string }) => {
      await platform.restaurants.markPaid(id, body)
      await loadRestaurants()
    },
    [loadRestaurants]
  )

  const suspendRestaurantUnpaid = useCallback(
    async (id: string, note?: string) => {
      await platform.restaurants.suspendUnpaid(id, { note })
      await loadRestaurants()
    },
    [loadRestaurants]
  )

  const startMonthlyCollectionCycle = useCallback(
    async (period?: string) => {
      const res = await platform.billing.startCollectionCycle(period)
      await loadRestaurants()
      return res
    },
    [loadRestaurants]
  )

  const suspendAllUnpaidRestaurants = useCallback(async () => {
    const res = await platform.billing.suspendAllUnpaid()
    await loadRestaurants()
    return res
  }, [loadRestaurants])

  const deleteRestaurant = useCallback(async (id: string) => {
    await platform.restaurants.delete(id)
    await loadRestaurants()
  }, [loadRestaurants])

  const loadRootAdmins = useCallback(async (restaurantId: string) => {
    if (!getPlatformToken()) return
    setRootAdminsLoading(true)
    setRootAdminsError(null)
    try {
      const [list] = await Promise.all([
        platform.rootAdmins.list(restaurantId),
        loadAllBosses(),
      ])
      setRootAdminsForRestaurant(list.map(toRootAdmin))
    } catch (e) {
      setRootAdminsError(e instanceof Error ? e.message : "Boss listesi yüklenemedi")
    } finally {
      setRootAdminsLoading(false)
    }
  }, [loadAllBosses])

  const addRootAdmin = useCallback(
    async (
      restaurantId: string,
      r: { name: string; email: string; phone?: string; bossTier?: BossTier; brandName?: string | null; password: string }
    ) => {
      await platform.rootAdmins.create(restaurantId, r)
      await Promise.all([loadRootAdmins(restaurantId), loadRestaurants()])
    },
    [loadRootAdmins, loadRestaurants]
  )

  const linkExistingBoss = useCallback(
    async (restaurantId: string, bossId: string) => {
      await platform.rootAdmins.linkExisting(restaurantId, bossId)
      await Promise.all([loadRootAdmins(restaurantId), loadRestaurants()])
    },
    [loadRootAdmins, loadRestaurants]
  )

  const updateRootAdmin = useCallback(
    async (restaurantId: string, id: string, r: Partial<Pick<RootAdmin, "name" | "email"> & { password?: string }>) => {
      await platform.rootAdmins.update(restaurantId, id, r)
      await loadRootAdmins(restaurantId)
    },
    [loadRootAdmins]
  )

  const deleteRootAdmin = useCallback(
    async (restaurantId: string, id: string) => {
      await platform.rootAdmins.delete(restaurantId, id)
      await Promise.all([loadRootAdmins(restaurantId), loadRestaurants()])
    },
    [loadRootAdmins, loadRestaurants]
  )

  const createBoss = useCallback(
    async (body: {
      name: string
      email: string
      phone?: string
      bossTier?: BossTier
      brandName?: string | null
      password: string
      restaurantIds: string[]
    }) => {
      await platform.bosses.create(body)
      await Promise.all([loadAllBosses(), loadRestaurants()])
    },
    [loadAllBosses, loadRestaurants]
  )

  const updateBoss = useCallback(
    async (
      id: string,
      body: {
        name?: string
        email?: string
        phone?: string | null
        bossTier?: BossTier
        brandName?: string | null
        password?: string
        isActive?: boolean
        restaurantIds?: string[]
      }
    ) => {
      await platform.bosses.update(id, body)
      await Promise.all([loadAllBosses(), loadRestaurants()])
    },
    [loadAllBosses, loadRestaurants]
  )

  const deleteBoss = useCallback(
    async (id: string) => {
      await platform.bosses.delete(id)
      await Promise.all([loadAllBosses(), loadRestaurants()])
    },
    [loadAllBosses, loadRestaurants]
  )

  return (
    <StoreContext.Provider
      value={{
        restaurants,
        restaurantsLoading,
        restaurantsError,
        loadRestaurants,
        addRestaurant,
        updateRestaurant,
        updateRestaurantBilling,
        markRestaurantPaid,
        suspendRestaurantUnpaid,
        deleteRestaurant,
        billingConfig,
        loadBillingConfig,
        updateBillingConfig,
        startMonthlyCollectionCycle,
        suspendAllUnpaidRestaurants,
        rootAdminsForRestaurant,
        rootAdminsLoading,
        rootAdminsError,
        loadRootAdmins,
        addRootAdmin,
        linkExistingBoss,
        updateRootAdmin,
        deleteRootAdmin,
        allBosses,
        bossesLoading,
        loadAllBosses,
        createBoss,
        updateBoss,
        deleteBoss,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
