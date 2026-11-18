import { useCallback, useState } from "react"
import type { BossTier, RootAdmin } from "../types"
import { getPlatformToken, platform } from "../api"
import { toRootAdmin, type BossMutationBody } from "../restaurant-mapper"

export function useBossStoreSlice(loadRestaurants: () => Promise<void>) {
  const [rootAdminsForRestaurant, setRootAdminsForRestaurant] = useState<RootAdmin[]>([])
  const [rootAdminsLoading, setRootAdminsLoading] = useState(false)
  const [rootAdminsError, setRootAdminsError] = useState<string | null>(null)
  const [allBosses, setAllBosses] = useState<RootAdmin[]>([])
  const [bossesLoading, setBossesLoading] = useState(false)
  const [bossesError, setBossesError] = useState<string | null>(null)

  const resetBossSlice = useCallback(() => {
    setRootAdminsForRestaurant([])
    setRootAdminsError(null)
    setAllBosses([])
    setBossesError(null)
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

  return {
    rootAdminsForRestaurant,
    rootAdminsLoading,
    rootAdminsError,
    allBosses,
    bossesLoading,
    bossesError,
    resetBossSlice,
    loadAllBosses,
    loadRootAdmins,
    addRootAdmin,
    linkExistingBoss,
    unlinkBossFromRestaurant,
    updateRootAdmin,
    deleteRootAdmin,
    createBoss,
    updateBoss,
    deleteBoss,
  }
}

