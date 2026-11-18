import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type {
  BossTier,
  PlatformBillingConfig,
  Restaurant,
  RootAdmin,
  SubscriptionPaymentMethod,
} from "./types"
import {
  platform,
  getPlatformToken,
  PLATFORM_UNAUTHORIZED_EVENT,
  type BossDto,
  type PlatformRestaurantDto,
  type RecordPaymentPayload,
  type UpdatePaymentPayload,
} from "./api"
import { toMinorUnits, fromMinorUnits } from "./money"

function toRestaurant(r: PlatformRestaurantDto): Restaurant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    taxId: r.taxId ?? null,
    whatsapp: r.whatsapp ?? null,
    instagram: r.instagram ?? null,
    facebook: r.facebook ?? null,
    website: r.website ?? null,
    workingHours: r.workingHours ?? null,
    status: r.status === "inactive" ? "inactive" : "active",
    brandName: r.brandName ?? null,
    branchType: r.branchType ?? "independent",
    franchiseeCompanyName: r.franchiseeCompanyName ?? null,
    royaltyRate: Number(r.royaltyRate ?? 0),
    monthlyFee: fromMinorUnits(toMinorUnits(r.monthlyFee ?? 0)),
    billingStartPeriod: r.billingStartPeriod,
    billingStatus: r.billingStatus ?? "pending",
    currentPeriod: r.currentPeriod,
    isCurrentPeriodPaid: Boolean(r.isCurrentPeriodPaid),
    paidPeriods: r.paidPeriods ?? [],
    paidThroughPeriod: r.paidThroughPeriod ?? null,
    prepaidFuturePeriods: r.prepaidFuturePeriods ?? [],
    overduePeriods: r.overduePeriods ?? [],
    duePeriods: r.duePeriods ?? [],
    nextUnpaidPeriod: r.nextUnpaidPeriod,
    totalCollectedAmount: fromMinorUnits(toMinorUnits(r.totalCollectedAmount ?? 0)),
    isAccessSuspended: Boolean(r.isAccessSuspended),
    suspensionReason: r.suspensionReason ?? null,
    suspendedAt: r.suspendedAt ?? null,
    lastPaymentDate: r.lastPaymentDate ?? null,
    lastPaidPeriod: r.lastPaidPeriod ?? null,
    billingNotes: r.billingNotes ?? null,
    paymentHistory: (r.paymentHistory ?? []).map((p) => ({
      ...p,
      periods: Array.isArray(p.periods) && p.periods.length > 0 ? p.periods : [p.period],
      periodStart: p.periodStart || p.period,
      periodEnd: p.periodEnd || p.period,
      monthsCount: p.monthsCount || p.periods?.length || 1,
      paymentMethod: p.paymentMethod || "bank_transfer",
      amount: fromMinorUnits(toMinorUnits(p.amount)),
    })),
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

export interface BossMutationBody {
  name?: string
  email?: string
  phone?: string | null
  bossTier?: BossTier
  brandName?: string | null
  password?: string
  isActive?: boolean
  restaurantIds?: string[]
}

type StoreContextType = {
  restaurants: Restaurant[]
  restaurantsLoading: boolean
  restaurantsError: string | null
  loadRestaurants: () => Promise<void>
  addRestaurant: (
    r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId"> & {
      recordInitialPayment?: boolean
      initialPaidMonths?: number
      initialPaymentMethod?: SubscriptionPaymentMethod
      terminalPassword?: string
      printAgentPassword?: string
    }
  ) => Promise<void>
  updateRestaurant: (
    id: string,
    r: Partial<Restaurant> & { terminalPassword?: string; printAgentPassword?: string }
  ) => Promise<void>
  recordRestaurantPayment: (id: string, body: RecordPaymentPayload) => Promise<void>
  updateRestaurantPayment: (
    id: string,
    paymentId: string,
    body: UpdatePaymentPayload
  ) => Promise<void>
  deleteRestaurantPayment: (id: string, paymentId: string) => Promise<void>
  suspendRestaurantUnpaid: (id: string, note?: string) => Promise<void>
  unsuspendRestaurantAccess: (id: string, note?: string) => Promise<void>
  deleteRestaurant: (id: string) => Promise<void>
  billingConfig: PlatformBillingConfig | null
  billingConfigError: string | null
  loadBillingConfig: () => Promise<void>
  updateBillingConfig: (body: Partial<PlatformBillingConfig>) => Promise<void>
  suspendAllUnpaidRestaurants: () => Promise<{
    suspendedCount: number
    deferredOpenShiftCount?: number
  }>
  rootAdminsForRestaurant: RootAdmin[]
  rootAdminsLoading: boolean
  rootAdminsError: string | null
  loadRootAdmins: (restaurantId: string) => Promise<void>
  addRootAdmin: (
    restaurantId: string,
    r: {
      name: string
      email: string
      phone?: string
      bossTier?: BossTier
      brandName?: string | null
      password: string
    }
  ) => Promise<void>
  linkExistingBoss: (restaurantId: string, bossId: string) => Promise<void>
  unlinkBossFromRestaurant: (restaurantId: string, bossId: string) => Promise<void>
  updateRootAdmin: (restaurantId: string, id: string, r: BossMutationBody) => Promise<void>
  deleteRootAdmin: (restaurantId: string, id: string) => Promise<void>
  allBosses: RootAdmin[]
  bossesLoading: boolean
  bossesError: string | null
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
  updateBoss: (id: string, body: BossMutationBody) => Promise<void>
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
  const [billingConfigError, setBillingConfigError] = useState<string | null>(null)
  const [rootAdminsForRestaurant, setRootAdminsForRestaurant] = useState<RootAdmin[]>([])
  const [rootAdminsLoading, setRootAdminsLoading] = useState(false)
  const [rootAdminsError, setRootAdminsError] = useState<string | null>(null)
  const [allBosses, setAllBosses] = useState<RootAdmin[]>([])
  const [bossesLoading, setBossesLoading] = useState(false)
  const [bossesError, setBossesError] = useState<string | null>(null)

  useEffect(() => {
    const resetStore = () => {
      setRestaurants([])
      setRestaurantsError(null)
      setBillingConfig(null)
      setBillingConfigError(null)
      setRootAdminsForRestaurant([])
      setRootAdminsError(null)
      setAllBosses([])
      setBossesError(null)
    }
    window.addEventListener(PLATFORM_UNAUTHORIZED_EVENT, resetStore)
    return () => window.removeEventListener(PLATFORM_UNAUTHORIZED_EVENT, resetStore)
  }, [])

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
    setBillingConfigError(null)
    try {
      const cfg = await platform.billing.getConfig()
      setBillingConfig(cfg)
    } catch (e) {
      setBillingConfigError(e instanceof Error ? e.message : "Tahsilat ayarları yüklenemedi")
    }
  }, [])

  const updateBillingConfig = useCallback(async (body: Partial<PlatformBillingConfig>) => {
    const updated = await platform.billing.updateConfig(body)
    setBillingConfig(updated)
  }, [])

  const loadAllBosses = useCallback(async () => {
    if (!getPlatformToken()) return
    setBossesLoading(true)
    setBossesError(null)
    try {
      const list = await platform.bosses.list()
      setAllBosses(list.map(toRootAdmin))
    } catch (e) {
      setBossesError(e instanceof Error ? e.message : "Boss hesapları yüklenemedi")
    } finally {
      setBossesLoading(false)
    }
  }, [])

  const addRestaurant = useCallback(
    async (
      r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId"> & {
        recordInitialPayment?: boolean
        initialPaidMonths?: number
        initialPaymentMethod?: SubscriptionPaymentMethod
        terminalPassword?: string
        printAgentPassword?: string
      }
    ) => {
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
        monthlyFee:
          r.monthlyFee !== undefined
            ? fromMinorUnits(toMinorUnits(r.monthlyFee))
            : undefined,
        billingStartPeriod: r.billingStartPeriod,
        recordInitialPayment: r.recordInitialPayment,
        initialPaidMonths: r.initialPaidMonths,
        initialPaymentMethod: r.initialPaymentMethod,
        isAccessSuspended: r.isAccessSuspended,
        billingNotes: r.billingNotes,
        terminalEmail: r.terminalEmail ?? undefined,
        terminalPassword: r.terminalPassword,
        printAgentUsername: r.printAgentUsername ?? undefined,
        printAgentPassword: r.printAgentPassword,
      })
      await Promise.all([loadRestaurants(), loadAllBosses()])
    },
    [loadRestaurants, loadAllBosses]
  )

  const updateRestaurant = useCallback(
    async (
      id: string,
      r: Partial<Restaurant> & { terminalPassword?: string; printAgentPassword?: string }
    ) => {
      await platform.restaurants.update(id, {
        name: r.name,
        slug: r.slug,
        address: r.address,
        phone: r.phone,
        email: r.email,
        taxId: r.taxId ?? undefined,
        whatsapp: r.whatsapp ?? undefined,
        instagram: r.instagram ?? undefined,
        facebook: r.facebook ?? undefined,
        website: r.website ?? undefined,
        workingHours: r.workingHours ?? undefined,
        status: r.status,
        brandName: r.brandName,
        branchType: r.branchType,
        franchiseeCompanyName: r.franchiseeCompanyName,
        royaltyRate: r.royaltyRate,
        monthlyFee:
          r.monthlyFee !== undefined
            ? fromMinorUnits(toMinorUnits(r.monthlyFee))
            : undefined,
        billingStartPeriod: r.billingStartPeriod,
        isAccessSuspended: r.isAccessSuspended,
        billingNotes: r.billingNotes,
        terminalEmail: r.terminalEmail,
        terminalPassword: r.terminalPassword,
        printAgentUsername: r.printAgentUsername,
        printAgentPassword: r.printAgentPassword,
      })
      await Promise.all([loadRestaurants(), loadAllBosses()])
    },
    [loadRestaurants, loadAllBosses]
  )

  const recordRestaurantPayment = useCallback(
    async (id: string, body: RecordPaymentPayload) => {
      await platform.restaurants.recordPayment(id, {
        ...body,
        amount:
          body.amount !== undefined
            ? fromMinorUnits(toMinorUnits(body.amount))
            : undefined,
      })
      await loadRestaurants()
    },
    [loadRestaurants]
  )

  const updateRestaurantPayment = useCallback(
    async (id: string, paymentId: string, body: UpdatePaymentPayload) => {
      await platform.restaurants.updatePayment(id, paymentId, {
        ...body,
        amount:
          body.amount !== undefined
            ? fromMinorUnits(toMinorUnits(body.amount))
            : undefined,
      })
      await loadRestaurants()
    },
    [loadRestaurants]
  )

  const deleteRestaurantPayment = useCallback(
    async (id: string, paymentId: string) => {
      await platform.restaurants.deletePayment(id, paymentId)
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

  const unsuspendRestaurantAccess = useCallback(
    async (id: string, note?: string) => {
      await platform.restaurants.unsuspendAccess(id, { note })
      await loadRestaurants()
    },
    [loadRestaurants]
  )

  const suspendAllUnpaidRestaurants = useCallback(async () => {
    const res = await platform.billing.suspendAllUnpaid()
    await loadRestaurants()
    return res
  }, [loadRestaurants])

  const deleteRestaurant = useCallback(
    async (id: string) => {
      await platform.restaurants.delete(id)
      await Promise.all([loadRestaurants(), loadAllBosses()])
    },
    [loadRestaurants, loadAllBosses]
  )

  const loadRootAdmins = useCallback(
    async (restaurantId: string) => {
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
    },
    [loadAllBosses]
  )

  const addRootAdmin = useCallback(
    async (
      restaurantId: string,
      r: {
        name: string
        email: string
        phone?: string
        bossTier?: BossTier
        brandName?: string | null
        password: string
      }
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

  const unlinkBossFromRestaurant = useCallback(
    async (restaurantId: string, bossId: string) => {
      await platform.bosses.unlinkRestaurant(bossId, restaurantId)
      await Promise.all([loadRootAdmins(restaurantId), loadRestaurants()])
    },
    [loadRootAdmins, loadRestaurants]
  )

  const updateRootAdmin = useCallback(
    async (restaurantId: string, id: string, r: BossMutationBody) => {
      await platform.rootAdmins.update(restaurantId, id, r)
      await Promise.all([loadRootAdmins(restaurantId), loadRestaurants()])
    },
    [loadRootAdmins, loadRestaurants]
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
    async (id: string, body: BossMutationBody) => {
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
        recordRestaurantPayment,
        updateRestaurantPayment,
        deleteRestaurantPayment,
        suspendRestaurantUnpaid,
        unsuspendRestaurantAccess,
        deleteRestaurant,
        billingConfig,
        billingConfigError,
        loadBillingConfig,
        updateBillingConfig,
        suspendAllUnpaidRestaurants,
        rootAdminsForRestaurant,
        rootAdminsLoading,
        rootAdminsError,
        loadRootAdmins,
        addRootAdmin,
        linkExistingBoss,
        unlinkBossFromRestaurant,
        updateRootAdmin,
        deleteRootAdmin,
        allBosses,
        bossesLoading,
        bossesError,
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
