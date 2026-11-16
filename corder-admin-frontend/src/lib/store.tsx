import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { Restaurant, RootAdmin } from "./types"
import { platform, getPlatformToken, type BossDto } from "./api"

function toRestaurant(r: {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  status: string
  rootAdminId?: string | null
  terminalEmail?: string | null
  printAgentToken?: string | null
  createdAt: string
}): Restaurant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    status: r.status === "inactive" ? "inactive" : "active",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
    rootAdminId: r.rootAdminId ?? undefined,
    terminalEmail: r.terminalEmail ?? undefined,
    printAgentToken: r.printAgentToken ?? undefined,
  }
}

function toRootAdmin(a: BossDto): RootAdmin {
  return {
    id: a.id,
    restaurantId: a.restaurantId ?? null,
    email: a.email,
    name: a.name,
    phone: a.phone ?? null,
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
  addRestaurant: (r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId">) => Promise<void>
  updateRestaurant: (id: string, r: Partial<Restaurant> & { terminalPassword?: string }) => Promise<void>
  deleteRestaurant: (id: string) => Promise<void>
  rootAdminsForRestaurant: RootAdmin[]
  rootAdminsLoading: boolean
  rootAdminsError: string | null
  loadRootAdmins: (restaurantId: string) => Promise<void>
  addRootAdmin: (restaurantId: string, r: { name: string; email: string; phone?: string; password: string }) => Promise<void>
  linkExistingBoss: (restaurantId: string, bossId: string) => Promise<void>
  updateRootAdmin: (restaurantId: string, id: string, r: Partial<Pick<RootAdmin, "name" | "email"> & { password?: string }>) => Promise<void>
  deleteRootAdmin: (restaurantId: string, id: string) => Promise<void>
  allBosses: RootAdmin[]
  bossesLoading: boolean
  loadAllBosses: () => Promise<void>
  createBoss: (body: { name: string; email: string; phone?: string; password: string; restaurantIds: string[] }) => Promise<void>
  updateBoss: (id: string, body: { name?: string; email?: string; phone?: string | null; password?: string; isActive?: boolean; restaurantIds?: string[] }) => Promise<void>
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

  const addRestaurant = useCallback(async (r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId">) => {
    await platform.restaurants.create({
      name: r.name,
      slug: r.slug,
      address: r.address,
      phone: r.phone,
      email: r.email,
      status: r.status,
    })
    await loadRestaurants()
  }, [loadRestaurants])

  const updateRestaurant = useCallback(async (id: string, r: Partial<Restaurant> & { terminalPassword?: string }) => {
    await platform.restaurants.update(id, {
      name: r.name,
      slug: r.slug,
      address: r.address,
      phone: r.phone,
      email: r.email,
      status: r.status,
      terminalEmail: r.terminalEmail,
      terminalPassword: r.terminalPassword,
      printAgentToken: r.printAgentToken,
    })
    await loadRestaurants()
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
    async (restaurantId: string, r: { name: string; email: string; phone?: string; password: string }) => {
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
    async (body: { name: string; email: string; phone?: string; password: string; restaurantIds: string[] }) => {
      await platform.bosses.create(body)
      await Promise.all([loadAllBosses(), loadRestaurants()])
    },
    [loadAllBosses, loadRestaurants]
  )

  const updateBoss = useCallback(
    async (id: string, body: { name?: string; email?: string; phone?: string | null; password?: string; isActive?: boolean; restaurantIds?: string[] }) => {
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
        deleteRestaurant,
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
