import type {
  Restaurant,
  RestaurantPaymentRecord,
  SubscriptionPaymentMethod,
} from "./types"

/**
 * Integer minor-unit monetary helpers and Europe/Istanbul date & period formatters.
 * Prevents IEEE-754 floating-point drift across billing calculations.
 */

export const ISTANBUL_TIMEZONE = "Europe/Istanbul"

export const PAYMENT_METHOD_LABELS: Record<SubscriptionPaymentMethod, string> = {
  bank_transfer: "Havale / EFT",
  cash: "Nakit",
  credit_card: "Kredi Kartı",
  other: "Diğer",
}

export const TURKISH_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
]

export const TURKISH_MONTHS_LONG = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
]

export function toMinorUnits(amountMajor: number | string | null | undefined): number {
  if (amountMajor === null || amountMajor === undefined || amountMajor === "") {
    return 0
  }
  const num = typeof amountMajor === "number" ? amountMajor : Number(amountMajor)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 100)
}

export function fromMinorUnits(minorUnits: number): number {
  if (!Number.isFinite(minorUnits)) return 0
  return Number((Math.round(minorUnits) / 100).toFixed(2))
}

export function sumMoneyMajor(
  amounts: Array<number | string | null | undefined>
): number {
  let totalMinorUnits = 0
  for (const amt of amounts) {
    totalMinorUnits += toMinorUnits(amt)
  }
  return fromMinorUnits(totalMinorUnits)
}

const tryFormatterWithDecimals = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const tryFormatterWhole = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatMoney(
  amountMajor: number | string | null | undefined,
  alwaysShowDecimals = false
): string {
  const minorUnits = toMinorUnits(amountMajor)
  const major = fromMinorUnits(minorUnits)
  if (alwaysShowDecimals || minorUnits % 100 !== 0) {
    return tryFormatterWithDecimals.format(major)
  }
  return tryFormatterWhole.format(major)
}

const ISTANBUL_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: ISTANBUL_TIMEZONE,
  day: "numeric",
})
const ISTANBUL_PERIOD_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: ISTANBUL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
})
const ISTANBUL_ISO_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const ISTANBUL_TR_DATE_FMT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const ISTANBUL_TR_SHORT_DM_FMT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TIMEZONE,
  month: "2-digit",
  day: "2-digit",
})
const ISTANBUL_TR_DATETIME_FMT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function getIstanbulDayOfMonth(date: Date = new Date()): number {
  try {
    const parts = ISTANBUL_DAY_FMT.formatToParts(date)
    const dayPart = parts.find((p) => p.type === "day")?.value
    const parsed = Number(dayPart)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
      return parsed
    }
  } catch {
    // Fallback
  }
  return date.getDate()
}

export function getIstanbulBillingPeriod(date: Date = new Date()): string {
  try {
    const parts = ISTANBUL_PERIOD_FMT.formatToParts(date)
    const year = parts.find((p) => p.type === "year")?.value
    const month = parts.find((p) => p.type === "month")?.value
    if (year && month) return `${year}-${month}`
  } catch {
    // Fallback
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export function getIstanbulTodayIsoDate(date: Date = new Date()): string {
  try {
    const parts = ISTANBUL_ISO_DATE_FMT.formatToParts(date)
    const y = parts.find((p) => p.type === "year")?.value
    const m = parts.find((p) => p.type === "month")?.value
    const d = parts.find((p) => p.type === "day")?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch {
    // Fallback
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function toIsoDateInputValue(input: string | Date | null | undefined): string {
  if (!input) return getIstanbulTodayIsoDate()
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return getIstanbulTodayIsoDate()
  return getIstanbulTodayIsoDate(d)
}

export function isValidPeriod(period: string | null | undefined): period is string {
  if (!period) return false
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period.trim())
}

export function addMonthsToPeriod(period: string, deltaMonths: number): string {
  if (!isValidPeriod(period)) return getIstanbulBillingPeriod()
  const [yStr, mStr] = period.trim().split("-")
  const totalMonths = Number(yStr) * 12 + (Number(mStr) - 1) + deltaMonths
  const nextY = Math.floor(totalMonths / 12)
  const nextM = (totalMonths % 12) + 1
  return `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}`
}

export function buildConsecutivePeriods(startPeriod: string, count: number): string[] {
  const safeCount = Math.max(1, Math.min(36, Math.floor(count)))
  const list: string[] = []
  for (let i = 0; i < safeCount; i += 1) {
    list.push(addMonthsToPeriod(startPeriod, i))
  }
  return list
}

export function enumeratePeriodsInclusive(startPeriod: string, endPeriod: string): string[] {
  if (!isValidPeriod(startPeriod) || !isValidPeriod(endPeriod)) return []
  if (startPeriod > endPeriod) return []
  const out: string[] = []
  let cur = startPeriod
  let guard = 0
  while (cur <= endPeriod && guard < 120) {
    out.push(cur)
    cur = addMonthsToPeriod(cur, 1)
    guard += 1
  }
  return out
}

export function formatPeriodLong(period: string | null | undefined): string {
  if (!isValidPeriod(period)) return period || "-"
  const [y, m] = period.split("-")
  const monthIdx = Number(m) - 1
  return `${TURKISH_MONTHS_LONG[monthIdx] ?? m} ${y}`
}

export function formatPeriodShort(period: string | null | undefined): string {
  if (!isValidPeriod(period)) return period || "-"
  const [y, m] = period.split("-")
  const monthIdx = Number(m) - 1
  return `${TURKISH_MONTHS_SHORT[monthIdx] ?? m} ${y.slice(-2)}`
}

export function formatPeriodsSummary(periods: string[] | undefined, fallbackPeriod?: string): string {
  const valid = (periods ?? []).filter(isValidPeriod).sort()
  if (valid.length === 0) {
    return fallbackPeriod ? formatPeriodLong(fallbackPeriod) : "-"
  }
  if (valid.length === 1) {
    return formatPeriodLong(valid[0])
  }
  // Check if consecutive
  let consecutive = true
  for (let i = 1; i < valid.length; i += 1) {
    if (addMonthsToPeriod(valid[i - 1], 1) !== valid[i]) {
      consecutive = false
      break
    }
  }
  if (consecutive) {
    return `${valid.length} Ay (${formatPeriodShort(valid[0])} – ${formatPeriodShort(valid[valid.length - 1])})`
  }
  return `${valid.length} Ay (${valid.map(formatPeriodShort).join(", ")})`
}

export type PeriodCellState =
  | "paid"
  | "prepaid"
  | "overdue"
  | "pending"
  | "future"
  | "before_start"
  | "exempt"

export interface EvaluatedPeriodCell {
  period: string
  state: PeriodCellState
  payment: RestaurantPaymentRecord | null
}

export function evaluateRestaurantPeriod(
  restaurant: Restaurant,
  period: string,
  currentPeriod: string,
  collectionEndDay = 30,
  dayOfMonth = getIstanbulDayOfMonth()
): EvaluatedPeriodCell {
  const history = restaurant.paymentHistory ?? []
  const matchingPayment =
    history.find((p) => {
      if (Array.isArray(p.periods) && p.periods.length > 0) {
        return p.periods.includes(period)
      }
      return p.period === period
    }) ?? null

  if (matchingPayment) {
    return {
      period,
      state: period > currentPeriod ? "prepaid" : "paid",
      payment: matchingPayment,
    }
  }

  const startPeriod = isValidPeriod(restaurant.billingStartPeriod)
    ? restaurant.billingStartPeriod
    : getIstanbulBillingPeriod(new Date(restaurant.createdAt))

  if (period < startPeriod) {
    return { period, state: "before_start", payment: null }
  }

  if (restaurant.status === "inactive" || (restaurant.monthlyFee ?? 0) <= 0) {
    return { period, state: "exempt", payment: null }
  }

  if (period < currentPeriod || (period === currentPeriod && dayOfMonth > collectionEndDay)) {
    return { period, state: "overdue", payment: null }
  }

  if (period === currentPeriod) {
    return { period, state: "pending", payment: null }
  }

  return { period, state: "future", payment: null }
}

export function formatIstanbulDate(
  input: string | Date | null | undefined
): string {
  if (!input) return "-"
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return "-"
  try {
    return ISTANBUL_TR_DATE_FMT.format(d)
  } catch {
    return d.toLocaleDateString("tr-TR")
  }
}

export function formatIstanbulShortDayMonth(
  input: string | Date | null | undefined
): string {
  if (!input) return ""
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ""
  try {
    return ISTANBUL_TR_SHORT_DM_FMT.format(d)
  } catch {
    return ""
  }
}

export function formatIstanbulDateTime(
  input: string | Date | null | undefined
): string {
  if (!input) return "-"
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return "-"
  try {
    return ISTANBUL_TR_DATETIME_FMT.format(d)
  } catch {
    return d.toLocaleString("tr-TR")
  }
}
