import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
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
  type RecordPaymentPayload,
  type UpdatePaymentPayload,
} from "./api"
import { toMinorUnits, fromMinorUnits } from "./money"
import { toRestaurant, type BossMutationBody } from "./restaurant-mapper"
import { useBillingStoreSlice } from "./hooks/use-billing-store-slice"
import { useBossStoreSlice } from "./hooks/use-boss-store-slice"

export type { BossMutationBody }

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

  const billingSlice = useBillingStoreSlice(loadRestaurants)
  const bossSlice = useBossStoreSlice(loadRestaurants)
  const { resetBillingSlice } = billingSlice
  const { resetBossSlice, loadAllBosses } = bossSlice

  useEffect(() => {
    const resetStore = () => {
      setRestaurants([])
      setRestaurantsError(null)
      resetBillingSlice()
      resetBossSlice()
    }
    window.addEventListener(PLATFORM_UNAUTHORIZED_EVENT, resetStore)
    return () => window.removeEventListener(PLATFORM_UNAUTHORIZED_EVENT, resetStore)
  }, [resetBillingSlice, resetBossSlice])

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

  const deleteRestaurant = useCallback(
    async (id: string) => {
      await platform.restaurants.delete(id)
      await Promise.all([loadRestaurants(), loadAllBosses()])
    },
    [loadRestaurants, loadAllBosses]
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
        deleteRestaurant,
        ...billingSlice,
        ...bossSlice,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
