import { getBase } from "./api/http-client"

export const ISTANBUL_TZ = "Europe/Istanbul"

const TR_CURRENCY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const TR_TIME_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  minute: "2-digit",
})

const TR_TIME_SECONDS_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const TR_DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const EN_CA_YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const EN_GB_HOUR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  hour12: false,
})

const TITLE_CASE_CACHE = new Map<string, string>()
const MAX_TITLE_CASE_CACHE = 2500

export function toMinorUnits(amount: number | null | undefined): number {
  const n = Number(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromMinorUnits(minorUnits: number | null | undefined): number {
  const n = Number(minorUnits)
  if (!Number.isFinite(n)) return 0
  return Math.round(n) / 100
}

export function computeDiscountMinorUnits(
  rawMinorUnits: number,
  discount?: { type: string; value: number } | null,
): number {
  const safeRaw = Math.max(0, Math.round(rawMinorUnits))
  if (!discount || safeRaw <= 0) return 0
  if (discount.type === "complimentary") return safeRaw
  const val = Number(discount.value)
  if (!Number.isFinite(val) || val <= 0) return 0
  if (discount.type === "percent") {
    const pct = Math.min(100, Math.max(0, val))
    if (pct >= 100) return safeRaw
    return Math.min(safeRaw, Math.round((safeRaw * pct) / 100))
  }
  if (discount.type === "amount") {
    return Math.min(safeRaw, Math.max(0, toMinorUnits(val)))
  }
  return 0
}

export function formatCurrency(amount: number | null | undefined): string {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0
  return TR_CURRENCY_FORMATTER.format(safe)
}

const TURKIC_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/u

function resolveCasingLocale(text: string, explicitLocale?: string): string | undefined {
  if (explicitLocale) return explicitLocale
  if (TURKIC_CHAR_RE.test(text)) return "tr"
  return undefined
}

export function normalizeStorageText(
  input: string | null | undefined,
  locale?: string,
): string {
  if (!input) return ""
  const raw = String(input).trim().replace(/\s+/g, " ")
  if (!raw) return ""
  const resolvedLocale = resolveCasingLocale(raw, locale)
  return (resolvedLocale ? raw.toLocaleLowerCase(resolvedLocale) : raw.toLowerCase()).replace(
    /\u0307/g,
    "",
  )
}

export function formatTitleCase(
  input: string | null | undefined,
  locale?: string,
): string {
  if (!input) return ""
  if (!locale) {
    const cached = TITLE_CASE_CACHE.get(input)
    if (cached !== undefined) return cached
  }
  const lower = normalizeStorageText(input, locale)
  if (!lower) return ""
  const resolvedLocale = resolveCasingLocale(lower, locale)
  const formatted = lower.replace(
    /([^\p{L}']|^)(\p{L})/gu,
    (_match, prefix: string, letter: string) =>
      `${prefix}${resolvedLocale ? letter.toLocaleUpperCase(resolvedLocale) : letter.toUpperCase()}`,
  )
  if (!locale) {
    if (TITLE_CASE_CACHE.size >= MAX_TITLE_CASE_CACHE) {
      TITLE_CASE_CACHE.clear()
    }
    TITLE_CASE_CACHE.set(input, formatted)
  }
  return formatted
}

export function resolveAssetUrl(url: string | undefined | null): string {
  if (!url) return ""
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }
  const base = getBase()
  if (base) {
    return `${base.replace(/\/+$/, "")}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
  }
  return trimmed
}

export function formatIstanbulTime(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ""
  return TR_TIME_FORMATTER.format(date)
}

export function formatIstanbulDate(
  d: Date | string | number,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ""
  if (!opts) return TR_DATE_FORMATTER.format(date)
  return date.toLocaleDateString("tr-TR", {
    timeZone: ISTANBUL_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  })
}

export function formatIstanbulDateTime(d: Date | string | number): string {
  const datePart = formatIstanbulDate(d)
  const timePart = formatIstanbulTime(d)
  if (!datePart) return ""
  return `${datePart} ${timePart}`
}

export function formatIstanbulDateTimeWithSeconds(
  d: Date | string | number,
): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ""
  const datePart = TR_DATE_FORMATTER.format(date)
  const timePart = TR_TIME_SECONDS_FORMATTER.format(date)
  if (!datePart) return ""
  return `${datePart} ${timePart}`
}

export function getIstanbulYmd(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d)
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date
  const parts = EN_CA_YMD_FORMATTER.formatToParts(validDate)
  const y = parts.find((p) => p.type === "year")?.value ?? "1970"
  const m = parts.find((p) => p.type === "month")?.value ?? "01"
  const day = parts.find((p) => p.type === "day")?.value ?? "01"
  return `${y}-${m}-${day}`
}

export function getIstanbulHour(d: Date | string | number): number {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return 0
  const parts = EN_GB_HOUR_FORMATTER.formatToParts(date)
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  return Number.isFinite(h) ? h % 24 : 0
}

export function getIstanbulDayOfWeekIndex(d: Date | string | number): number {
  const ymd = getIstanbulYmd(d)
  const [y, m, day] = ymd.split("-").map(Number)
  const utcDay = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
  return (utcDay + 6) % 7
}

export function startOfIstanbulDay(ymd: string = getIstanbulYmd()): Date {
  return new Date(`${ymd}T00:00:00.000+03:00`)
}

export function endOfIstanbulDay(ymd: string = getIstanbulYmd()): Date {
  return new Date(`${ymd}T23:59:59.999+03:00`)
}

export function shiftIstanbulYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const ry = dt.getUTCFullYear()
  const rm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const rd = String(dt.getUTCDate()).padStart(2, "0")
  return `${ry}-${rm}-${rd}`
}

export function parseFlexibleDateInput(
  raw: string,
  isEnd = false,
): Date | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = isEnd ? endOfIstanbulDay(s) : startOfIstanbulDay(s)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const withSec = s.length === 16 ? `${s}${isEnd ? ":59.999" : ":00.000"}` : s
    const dt = new Date(`${withSec}+03:00`)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

export function computeDateFilterBounds(
  filterDate: string,
  customStartDate: string,
  customEndDate: string,
): { from: Date; to: Date } | null {
  if (filterDate === "all") return null
  const todayYmd = getIstanbulYmd()
  const startToday = startOfIstanbulDay(todayYmd)
  const endToday = endOfIstanbulDay(todayYmd)

  if (filterDate === "today") {
    return { from: startToday, to: endToday }
  }
  if (filterDate === "yesterday") {
    const yestYmd = shiftIstanbulYmd(todayYmd, -1)
    return { from: startOfIstanbulDay(yestYmd), to: endOfIstanbulDay(yestYmd) }
  }
  if (filterDate === "week") {
    const weekAgoYmd = shiftIstanbulYmd(todayYmd, -7)
    return { from: startOfIstanbulDay(weekAgoYmd), to: endToday }
  }
  if (filterDate === "month") {
    const monthAgoYmd = shiftIstanbulYmd(todayYmd, -30)
    return { from: startOfIstanbulDay(monthAgoYmd), to: endToday }
  }
  if (filterDate === "custom") {
    const start = parseFlexibleDateInput(customStartDate, false)
    const end = parseFlexibleDateInput(customEndDate, true) ?? endToday
    if (!start) return null
    return start <= end ? { from: start, to: end } : { from: end, to: start }
  }
  return null
}
