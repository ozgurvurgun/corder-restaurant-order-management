import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { Restaurant, RootAdmin } from "./types"
import { platform, getPlatformToken } from "./api"

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

function toRootAdmin(a: { id: string; restaurantId: string; email: string; name: string; createdAt: string }): RootAdmin {
  return {
    id: a.id,
    restaurantId: a.restaurantId,
    email: a.email,
    name: a.name,
    createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date(a.createdAt).toISOString(),
  }
}

type StoreContextType = {
  restaurants: Restaurant[]
  restaurantsLoading: boolean
  restaurantsError: string | null
  loadRestaurants: () => Promise<void>
  addRestaurant: (r: Omit<Restaurant, "id" | "createdAt" | "rootAdminId">) => Promise<void>
  updateRestaurant: (id: string, r: Partial<Restaurant>) => Promise<void>
  deleteRestaurant: (id: string) => Promise<void>
  rootAdminsForRestaurant: RootAdmin[]
  rootAdminsLoading: boolean
  rootAdminsError: string | null
  loadRootAdmins: (restaurantId: string) => Promise<void>
  addRootAdmin: (restaurantId: string, r: { name: string; email: string; password: string }) => Promise<void>
  updateRootAdmin: (restaurantId: string, id: string, r: Partial<Pick<RootAdmin, "name" | "email"> & { password?: string }>) => Promise<void>
  deleteRootAdmin: (restaurantId: string, id: string) => Promise<void>
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
      const list = await platform.rootAdmins.list(restaurantId)
      setRootAdminsForRestaurant(list.map(toRootAdmin))
    } catch (e) {
      setRootAdminsError(e instanceof Error ? e.message : "Root admin listesi yüklenemedi")
    } finally {
      setRootAdminsLoading(false)
    }
  }, [])

  const addRootAdmin = useCallback(
    async (restaurantId: string, r: { name: string; email: string; password: string }) => {
      await platform.rootAdmins.create(restaurantId, r)
      await loadRootAdmins(restaurantId)
    },
    [loadRootAdmins]
  )

  const updateRootAdmin = useCallback(
    async (restaurantId: string, id: string, r: Partial<Pick<RootAdmin, "name" | "email"> & { password?: string }>) => {
      const body: { name?: string; email?: string; password?: string } = {}
      if (r.name !== undefined) body.name = r.name
      if (r.email !== undefined) body.email = r.email
      if (r.password !== undefined) body.password = r.password
      await platform.rootAdmins.update(restaurantId, id, body)
      await loadRootAdmins(restaurantId)
    },
    [loadRootAdmins]
  )

  const deleteRootAdmin = useCallback(
    async (restaurantId: string, id: string) => {
      await platform.rootAdmins.delete(restaurantId, id)
      await loadRootAdmins(restaurantId)
    },
    [loadRootAdmins]
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
        updateRootAdmin,
        deleteRootAdmin,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
