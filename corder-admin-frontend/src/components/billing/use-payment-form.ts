import { useEffect, useMemo, useState } from "react"
import type {
  Restaurant,
  RestaurantPaymentRecord,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import {
  addMonthsToPeriod,
  buildConsecutivePeriods,
  enumeratePeriodsInclusive,
  fromMinorUnits,
  getIstanbulBillingPeriod,
  getIstanbulTodayIsoDate,
  isValidPeriod,
  toIsoDateInputValue,
  toMinorUnits,
} from "@/lib/money"

export type PackagePreset = 1 | 3 | 6 | 12 | "custom"

export function usePaymentFormState(params: {
  restaurant: Restaurant | null
  initialPeriod?: string | null
  editingPayment?: RestaurantPaymentRecord | null
}) {
  const { restaurant, initialPeriod, editingPayment } = params
  const currentPeriod = getIstanbulBillingPeriod()

  const alreadyPaidSet = useMemo(() => {
    const set = new Set<string>()
    if (!restaurant?.paymentHistory) return set
    for (const p of restaurant.paymentHistory) {
      if (editingPayment && p.id === editingPayment.id) continue
      const list =
        Array.isArray(p.periods) && p.periods.length > 0 ? p.periods : [p.period]
      for (const per of list) {
        if (isValidPeriod(per)) set.add(per)
      }
    }
    return set
  }, [restaurant, editingPayment])

  const defaultStartPeriod = useMemo(() => {
    if (editingPayment) {
      return editingPayment.periodStart || editingPayment.periods?.[0] || currentPeriod
    }
    if (
      initialPeriod &&
      isValidPeriod(initialPeriod) &&
      !alreadyPaidSet.has(initialPeriod)
    ) {
      return initialPeriod
    }
    if (restaurant?.nextUnpaidPeriod && isValidPeriod(restaurant.nextUnpaidPeriod)) {
      return restaurant.nextUnpaidPeriod
    }
    return currentPeriod
  }, [editingPayment, initialPeriod, alreadyPaidSet, restaurant, currentPeriod])

  const [preset, setPreset] = useState<PackagePreset>(1)
  const [startPeriod, setStartPeriod] = useState(defaultStartPeriod)
  const [customPeriods, setCustomPeriods] = useState<string[]>([defaultStartPeriod])
  const [paidAtDate, setPaidAtDate] = useState(getIstanbulTodayIsoDate)
  const [amountInput, setAmountInput] = useState("0")
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false)
  const [paymentMethod, setPaymentMethod] =
    useState<SubscriptionPaymentMethod>("bank_transfer")
  const [note, setNote] = useState("")
  const [reopenAccess, setReopenAccess] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    if (editingPayment) {
      const pList =
        Array.isArray(editingPayment.periods) && editingPayment.periods.length > 0
          ? [...editingPayment.periods].sort()
          : [editingPayment.period]
      let isConsecutive = true
      for (let i = 1; i < pList.length; i += 1) {
        if (addMonthsToPeriod(pList[i - 1], 1) !== pList[i]) {
          isConsecutive = false
          break
        }
      }
      if (
        isConsecutive &&
        (pList.length === 1 ||
          pList.length === 3 ||
          pList.length === 6 ||
          pList.length === 12)
      ) {
        setPreset(pList.length as 1 | 3 | 6 | 12)
        setStartPeriod(pList[0])
      } else {
        setPreset("custom")
        setStartPeriod(pList[0] ?? defaultStartPeriod)
      }
      setCustomPeriods(pList)
      setPaidAtDate(toIsoDateInputValue(editingPayment.paidAt))
      setAmountInput(String(editingPayment.amount))
      setIsAmountManuallyEdited(true)
      setPaymentMethod(editingPayment.paymentMethod || "bank_transfer")
      setNote(editingPayment.note ?? "")
      setReopenAccess(true)
    } else {
      setPreset(1)
      setStartPeriod(defaultStartPeriod)
      setCustomPeriods([defaultStartPeriod])
      setPaidAtDate(getIstanbulTodayIsoDate())
      setAmountInput(String(restaurant.monthlyFee ?? 0))
      setIsAmountManuallyEdited(false)
      setPaymentMethod("bank_transfer")
      setNote("")
      setReopenAccess(true)
    }
  }, [restaurant, editingPayment, defaultStartPeriod])

  const selectedPeriods = useMemo(() => {
    if (preset === "custom") {
      return [...customPeriods].filter(isValidPeriod).sort()
    }
    return buildConsecutivePeriods(startPeriod, preset)
  }, [preset, startPeriod, customPeriods])

  const standardTotal = useMemo(() => {
    const fee = restaurant?.monthlyFee ?? 0
    return fromMinorUnits(toMinorUnits(fee) * selectedPeriods.length)
  }, [restaurant?.monthlyFee, selectedPeriods.length])

  useEffect(() => {
    if (!isAmountManuallyEdited) {
      setAmountInput(String(standardTotal))
    }
  }, [standardTotal, isAmountManuallyEdited])

  const overlappingPeriods = useMemo(
    () => selectedPeriods.filter((p) => alreadyPaidSet.has(p)),
    [selectedPeriods, alreadyPaidSet]
  )

  const customPickerRange = useMemo(() => {
    if (!restaurant) return []
    const earliestCandidate = isValidPeriod(restaurant.billingStartPeriod)
      ? restaurant.billingStartPeriod
      : addMonthsToPeriod(currentPeriod, -6)
    const minBound = addMonthsToPeriod(currentPeriod, -12)
    const gridStart = earliestCandidate < minBound ? minBound : earliestCandidate
    const gridEnd = addMonthsToPeriod(currentPeriod, 14)
    return enumeratePeriodsInclusive(gridStart, gridEnd)
  }, [restaurant, currentPeriod])

  const toggleCustomPeriod = (per: string) => {
    if (alreadyPaidSet.has(per)) return
    setCustomPeriods((prev) =>
      prev.includes(per) ? prev.filter((x) => x !== per) : [...prev, per].sort()
    )
  }

  const selectPreset = (nextPreset: PackagePreset) => {
    setPreset(nextPreset)
    if (nextPreset === "custom") {
      const seed = selectedPeriods.filter((p) => !alreadyPaidSet.has(p))
      setCustomPeriods(seed.length > 0 ? seed : [defaultStartPeriod])
    }
  }

  return {
    preset,
    selectPreset,
    startPeriod,
    setStartPeriod,
    customPeriods,
    setCustomPeriods,
    toggleCustomPeriod,
    paidAtDate,
    setPaidAtDate,
    amountInput,
    setAmountInput,
    isAmountManuallyEdited,
    setIsAmountManuallyEdited,
    paymentMethod,
    setPaymentMethod,
    note,
    setNote,
    reopenAccess,
    setReopenAccess,
    alreadyPaidSet,
    defaultStartPeriod,
    selectedPeriods,
    standardTotal,
    overlappingPeriods,
    customPickerRange,
  }
}

