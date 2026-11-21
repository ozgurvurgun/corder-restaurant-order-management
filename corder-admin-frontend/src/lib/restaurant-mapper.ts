import type { BossTier, Restaurant, RootAdmin } from "./types"
import type { BossDto, PlatformRestaurantDto } from "./api"
import { fromMinorUnits, toMinorUnits } from "./money"

const TURKIC_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/u
const TITLE_CASE_CACHE_MAX = 5000
const TITLE_CASE_CACHE = new Map<string, string>()

function resolveCasingLocale(text: string, explicitLocale?: string): string | undefined {
  if (explicitLocale) return explicitLocale
  if (TURKIC_CHAR_RE.test(text)) return "tr"
  return undefined
}

export function formatTitleCase(
  input: string | null | undefined,
  locale?: string,
): string {
  if (!input) return ""
  const cacheKey = locale ? `${locale}\u0000${input}` : String(input)
  const cached = TITLE_CASE_CACHE.get(cacheKey)
  if (cached !== undefined) return cached

  const raw = String(input).trim().replace(/\s+/g, " ")
  if (!raw) return ""
  const resolvedLocale = resolveCasingLocale(raw, locale)
  const lower = (
    resolvedLocale ? raw.toLocaleLowerCase(resolvedLocale) : raw.toLowerCase()
  ).replace(/\u0307/g, "")
  const formatted = lower.replace(
    /([^\p{L}']|^)(\p{L})/gu,
    (_match, prefix: string, letter: string) =>
      `${prefix}${resolvedLocale ? letter.toLocaleUpperCase(resolvedLocale) : letter.toUpperCase()}`,
  )
  if (TITLE_CASE_CACHE.size >= TITLE_CASE_CACHE_MAX) {
    TITLE_CASE_CACHE.clear()
  }
  TITLE_CASE_CACHE.set(cacheKey, formatted)
  return formatted
}

export interface BossMutationBody {
  name?: string
  email?: string
  phone?: string | null
  bossTier?: BossTier
  brandName?: string | null
  password?: string
  isActive?: boolean
  restaurantIds?: string[]
}

export function toRestaurant(r: PlatformRestaurantDto): Restaurant {
  return {
    id: r.id,
    name: formatTitleCase(r.name),
    slug: r.slug,
    address: r.address ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    taxId: r.taxId ?? null,
    whatsapp: r.whatsapp ?? null,
    instagram: r.instagram ?? null,
    facebook: r.facebook ?? null,
    website: r.website ?? null,
    workingHours: r.workingHours ?? null,
    status: r.status === "inactive" ? "inactive" : "active",
    brandName: r.brandName ? formatTitleCase(r.brandName) : null,
    branchType: r.branchType ?? "independent",
    franchiseeCompanyName: r.franchiseeCompanyName
      ? formatTitleCase(r.franchiseeCompanyName)
      : null,
    royaltyRate: Number(r.royaltyRate ?? 0),
    monthlyFee: fromMinorUnits(toMinorUnits(r.monthlyFee ?? 0)),
    billingStartPeriod: r.billingStartPeriod,
    billingStatus: r.billingStatus ?? "pending",
    currentPeriod: r.currentPeriod,
    isCurrentPeriodPaid: Boolean(r.isCurrentPeriodPaid),
    paidPeriods: r.paidPeriods ?? [],
    paidThroughPeriod: r.paidThroughPeriod ?? null,
    prepaidFuturePeriods: r.prepaidFuturePeriods ?? [],
    overduePeriods: r.overduePeriods ?? [],
    duePeriods: r.duePeriods ?? [],
    nextUnpaidPeriod: r.nextUnpaidPeriod,
    totalCollectedAmount: fromMinorUnits(toMinorUnits(r.totalCollectedAmount ?? 0)),
    isAccessSuspended: Boolean(r.isAccessSuspended),
    suspensionReason: r.suspensionReason ?? null,
    suspendedAt: r.suspendedAt ?? null,
    lastPaymentDate: r.lastPaymentDate ?? null,
    lastPaidPeriod: r.lastPaidPeriod ?? null,
    billingNotes: r.billingNotes ?? null,
    paymentHistory: (r.paymentHistory ?? []).map((p) => ({
      ...p,
      periods: Array.isArray(p.periods) && p.periods.length > 0 ? p.periods : [p.period],
      periodStart: p.periodStart || p.period,
      periodEnd: p.periodEnd || p.period,
      monthsCount: p.monthsCount || p.periods?.length || 1,
      paymentMethod: p.paymentMethod || "bank_transfer",
      amount: fromMinorUnits(toMinorUnits(p.amount)),
    })),
    bosses: (r.bosses ?? []).map((b) => ({
      ...b,
      name: formatTitleCase(b.name),
    })),
    createdAt:
      typeof r.createdAt === "string"
        ? r.createdAt
        : new Date(r.createdAt).toISOString(),
    rootAdminId: r.rootAdminId ?? undefined,
    terminalEmail: r.terminalEmail ?? undefined,
    printAgentUsername: r.printAgentUsername ?? undefined,
  }
}

export function toRootAdmin(a: BossDto): RootAdmin {
  return {
    id: a.id,
    restaurantId: a.restaurantId ?? null,
    email: a.email,
    name: formatTitleCase(a.name),
    phone: a.phone ?? null,
    bossTier: a.bossTier ?? "franchise_owner",
    brandName: a.brandName ? formatTitleCase(a.brandName) : null,
    isActive: a.isActive ?? true,
    restaurants: (a.restaurants ?? []).map((rest) => ({
      ...rest,
      name: formatTitleCase(rest.name),
      brandName: rest.brandName ? formatTitleCase(rest.brandName) : null,
    })),
    createdAt:
      typeof a.createdAt === "string"
        ? a.createdAt
        : new Date(a.createdAt).toISOString(),
  }
}

