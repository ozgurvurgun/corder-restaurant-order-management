import { useCallback, useState } from "react"
import type { PlatformBillingConfig } from "../types"
import {
  getPlatformToken,
  platform,
  type RecordPaymentPayload,
  type UpdatePaymentPayload,
} from "../api"
import { fromMinorUnits, toMinorUnits } from "../money"

export function useBillingStoreSlice(loadRestaurants: () => Promise<void>) {
  const [billingConfig, setBillingConfig] = useState<PlatformBillingConfig | null>(null)
  const [billingConfigError, setBillingConfigError] = useState<string | null>(null)

  const resetBillingSlice = useCallback(() => {
    setBillingConfig(null)
    setBillingConfigError(null)
  }, [])

  const loadBillingConfig = useCallback(async () => {
    if (!getPlatformToken()) return
    setBillingConfigError(null)
    try {
      const cfg = await platform.billing.getConfig()
      setBillingConfig(cfg)
    } catch (e) {
      setBillingConfigError(
        e instanceof Error ? e.message : "Tahsilat ayarları yüklenemedi"
      )
    }
  }, [])

  const updateBillingConfig = useCallback(
    async (body: Partial<PlatformBillingConfig>) => {
      const updated = await platform.billing.updateConfig(body)
      setBillingConfig(updated)
    },
    []
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

  return {
    billingConfig,
    billingConfigError,
    resetBillingSlice,
    loadBillingConfig,
    updateBillingConfig,
    recordRestaurantPayment,
    updateRestaurantPayment,
    deleteRestaurantPayment,
    suspendRestaurantUnpaid,
    unsuspendRestaurantAccess,
    suspendAllUnpaidRestaurants,
  }
}

