import { useMemo } from "react"
import type { Restaurant } from "@/lib/types"
import {
  evaluateRestaurantPeriod,
  fromMinorUnits,
  getIstanbulBillingPeriod,
  sumMoneyMajor,
  toMinorUnits,
} from "@/lib/money"
import type { BillingStatusFilter } from "./RecordPaymentModal"

export function useBillingPeriodMetrics(params: {
  restaurants: Restaurant[]
  selectedPeriod: string
  currentPeriod: string
  collectionEndDay: number
  dayOfMonth: number
  statusFilter: BillingStatusFilter
  searchQuery: string
}) {
  const {
    restaurants,
    selectedPeriod,
    currentPeriod,
    collectionEndDay,
    dayOfMonth,
    statusFilter,
    searchQuery,
  } = params

  const metrics = useMemo(() => {
    const activeForSelected = restaurants.filter((r) => {
      const cell = evaluateRestaurantPeriod(
        r,
        selectedPeriod,
        currentPeriod,
        collectionEndDay,
        dayOfMonth
      )
      return cell.state !== "before_start" && cell.state !== "exempt"
    })

    const periodTargetTotal = sumMoneyMajor(
      activeForSelected.map((r) => r.monthlyFee ?? 0)
    )

    const paidInSelected = activeForSelected.filter((r) => {
      const cell = evaluateRestaurantPeriod(
        r,
        selectedPeriod,
        currentPeriod,
        collectionEndDay,
        dayOfMonth
      )
      return cell.state === "paid" || cell.state === "prepaid"
    })

    const unpaidInSelected = activeForSelected.filter((r) => {
      const cell = evaluateRestaurantPeriod(
        r,
        selectedPeriod,
        currentPeriod,
        collectionEndDay,
        dayOfMonth
      )
      return (
        cell.state === "pending" ||
        cell.state === "overdue" ||
        cell.state === "future"
      )
    })

    const periodPaidFeeTotal = sumMoneyMajor(
      paidInSelected.map((r) => r.monthlyFee ?? 0)
    )

    const cashPaymentsInSelectedMonth: number[] = []
    for (const r of restaurants) {
      for (const p of r.paymentHistory ?? []) {
        const paidMonth = getIstanbulBillingPeriod(new Date(p.paidAt))
        if (paidMonth === selectedPeriod) {
          cashPaymentsInSelectedMonth.push(p.amount)
        }
      }
    }
    const periodCashCollected = sumMoneyMajor(cashPaymentsInSelectedMonth)

    let unpaidMinor = 0
    let unpaidVenuesCount = 0
    let overdueVenuesCount = 0
    let overduePeriodsCount = 0
    for (const r of restaurants) {
      const dueCount = r.duePeriods?.length ?? 0
      const ovCount = r.overduePeriods?.length ?? 0
      if (dueCount > 0) {
        unpaidVenuesCount += 1
        unpaidMinor += toMinorUnits(r.monthlyFee ?? 0) * dueCount
      }
      if (ovCount > 0) {
        overdueVenuesCount += 1
        overduePeriodsCount += ovCount
      }
    }

    const suspendedCount = restaurants.filter(
      (r) => r.isAccessSuspended || r.billingStatus === "suspended"
    ).length

    return {
      billableCount: activeForSelected.length,
      periodTargetTotal,
      periodPaidCount: paidInSelected.length,
      unpaidSelectedCount: unpaidInSelected.length,
      periodPaidFeeTotal,
      periodCashCollected,
      unpaidBalanceTotal: fromMinorUnits(unpaidMinor),
      unpaidVenuesCount,
      overdueVenuesCount,
      overduePeriodsCount,
      suspendedCount,
    }
  }, [restaurants, selectedPeriod, currentPeriod, collectionEndDay, dayOfMonth])

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const isSusp = Boolean(
        r.isAccessSuspended || r.billingStatus === "suspended"
      )
      const cell = evaluateRestaurantPeriod(
        r,
        selectedPeriod,
        currentPeriod,
        collectionEndDay,
        dayOfMonth
      )
      if (
        statusFilter === "paid" &&
        cell.state !== "paid" &&
        cell.state !== "prepaid"
      ) {
        return false
      }
      if (
        statusFilter === "unpaid" &&
        cell.state !== "pending" &&
        cell.state !== "overdue" &&
        cell.state !== "future"
      ) {
        return false
      }
      if (statusFilter === "overdue" && (r.overduePeriods?.length ?? 0) === 0) {
        return false
      }
      if (statusFilter === "suspended" && !isSusp) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return (
          r.name.toLowerCase().includes(q) ||
          (r.brandName ?? "").toLowerCase().includes(q) ||
          r.slug.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [
    restaurants,
    selectedPeriod,
    currentPeriod,
    collectionEndDay,
    dayOfMonth,
    statusFilter,
    searchQuery,
  ])

  return { metrics, filteredRestaurants }
}

