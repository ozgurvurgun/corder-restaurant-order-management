/**
 * Integer minor-unit monetary helpers and Europe/Istanbul date formatters.
 * Prevents IEEE-754 floating-point drift across billing calculations.
 */

export const ISTANBUL_TIMEZONE = "Europe/Istanbul"

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

export function getIstanbulDayOfMonth(date: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: ISTANBUL_TIMEZONE,
      day: "numeric",
    }).formatToParts(date)
    const dayPart = parts.find((p) => p.type === "day")?.value
    const parsed = Number(dayPart)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
      return parsed
    }
  } catch {
    // Fallback to local date if Intl timezone is unavailable
  }
  return date.getDate()
}

export function getIstanbulBillingPeriod(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: ISTANBUL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date)
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

export function formatIstanbulDate(
  input: string | Date | null | undefined
): string {
  if (!input) return "—"
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: ISTANBUL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return d.toLocaleDateString("tr-TR")
  }
}

export function formatIstanbulDateTime(
  input: string | Date | null | undefined
): string {
  if (!input) return "—"
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: ISTANBUL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return d.toLocaleString("tr-TR")
  }
}
