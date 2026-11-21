import type {
  BossOverviewResponse,
  BranchSummary,
  LiveOrderDto,
  LiveTableDto,
  SubBossItemDto,
  TableDiscountDto,
} from "./types"

const ISTANBUL_TZ = "Europe/Istanbul"

const trMoneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const trTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  minute: "2-digit",
})

const trDateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const trDayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Converts a major-unit TL amount into integer minor units
 * to avoid IEEE-754 floating-point drift.
 */
export function toMinorUnits(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") return 0
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/**
 * Converts integer minor units back to a 2-decimal TL number.
 */
export function fromMinorUnits(minorUnits: number): number {
  if (!Number.isFinite(minorUnits)) return 0
  return Number((Math.round(minorUnits) / 100).toFixed(2))
}

/**
 * Sums multiple major-unit TL amounts using integer minor-unit arithmetic.
 */
export function sumMoney(
  ...amounts: Array<number | string | null | undefined>
): number {
  let totalMinorUnits = 0
  for (const a of amounts) {
    totalMinorUnits += toMinorUnits(a)
  }
  return fromMinorUnits(totalMinorUnits)
}

/**
 * Formats a major-unit TL number in Turkish locale (e.g. "1.250,50").
 * Internally rounds to integer minor units first.
 */
export function formatMoney(amount: number | string | null | undefined): string {
  const major = fromMinorUnits(toMinorUnits(amount))
  return trMoneyFormatter.format(major)
}

/**
 * Computes subtotal, discount amount, and net total for a table's active orders
 * using integer minor-unit arithmetic and matching backend `Money.computeDiscount`.
 */
export function computeTableTotals(
  activeOrders: LiveOrderDto[],
  discount?: TableDiscountDto | null
): {
  subtotal: number
  discountAmount: number
  netTotal: number
} {
  let rawMinorUnits = 0
  for (const ord of activeOrders) {
    for (const item of ord.items) {
      if (item.status !== "cancelled" && item.status !== "ledger" && item.status !== "paid") {
        rawMinorUnits += toMinorUnits(item.price) * Number(item.quantity || 0)
      }
    }
  }

  let discountMinorUnits = 0
  if (discount && rawMinorUnits > 0) {
    const val = Number(discount.value)
    if (discount.type === "complimentary") {
      discountMinorUnits = rawMinorUnits
    } else if (discount.type === "percent" && Number.isFinite(val) && val > 0) {
      if (val >= 100) {
        discountMinorUnits = rawMinorUnits
      } else {
        discountMinorUnits = Math.min(rawMinorUnits, Math.max(0, Math.round((rawMinorUnits * val) / 100)))
      }
    } else if (discount.type === "amount" && Number.isFinite(val) && val > 0) {
      discountMinorUnits = Math.min(rawMinorUnits, Math.max(0, toMinorUnits(val)))
    }
  }

  const netMinorUnits = Math.max(0, rawMinorUnits - discountMinorUnits)
  return {
    subtotal: fromMinorUnits(rawMinorUnits),
    discountAmount: fromMinorUnits(discountMinorUnits),
    netTotal: fromMinorUnits(netMinorUnits),
  }
}

export function formatIstanbulTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""
  return trTimeFormatter.format(d)
}

let cachedTodayKey = ""
let cachedTodayKeyAt = 0

function getTodayDayKey(): string {
  const nowMs = Date.now()
  if (cachedTodayKey && nowMs - cachedTodayKeyAt < 1_000) {
    return cachedTodayKey
  }
  cachedTodayKey = trDayKeyFormatter.format(new Date(nowMs))
  cachedTodayKeyAt = nowMs
  return cachedTodayKey
}

export function formatIstanbulDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""
  if (trDayKeyFormatter.format(d) === getTodayDayKey()) {
    return `Bugün ${trTimeFormatter.format(d)}`
  }
  return trDateTimeFormatter.format(d)
}

const TURKIC_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/u
const TITLE_CASE_CACHE_MAX = 2500
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

export function getWaiterDisplayName(order: LiveOrderDto): string | null {
  const name = (order.userName ?? "").trim()
  return name ? formatTitleCase(name) : null
}

export function normalizeBossBranch(b: BranchSummary): BranchSummary {
  return {
    ...b,
    name: formatTitleCase(b.name),
    brandName: b.brandName ? formatTitleCase(b.brandName) : b.brandName,
  }
}

export function normalizeBossTable(t: LiveTableDto): LiveTableDto {
  return {
    ...t,
    name: formatTitleCase(t.name),
    section: formatTitleCase(t.section),
    sessionStaffName: t.sessionStaffName ? formatTitleCase(t.sessionStaffName) : t.sessionStaffName,
  }
}

export function normalizeBossSubBoss(sb: SubBossItemDto): SubBossItemDto {
  return {
    ...sb,
    name: formatTitleCase(sb.name),
    brandName: sb.brandName ? formatTitleCase(sb.brandName) : sb.brandName,
    branches: (sb.branches ?? []).map((br) => ({
      ...br,
      name: formatTitleCase(br.name),
    })),
  }
}

export function normalizeBossOverview(ov: BossOverviewResponse): BossOverviewResponse {
  return {
    ...ov,
    allOwnedBranches: ov.allOwnedBranches
      ? ov.allOwnedBranches.map((b) => ({
          ...b,
          name: formatTitleCase(b.name),
          brandName: b.brandName ? formatTitleCase(b.brandName) : b.brandName,
          franchiseeCompanyName: b.franchiseeCompanyName
            ? formatTitleCase(b.franchiseeCompanyName)
            : b.franchiseeCompanyName,
        }))
      : ov.allOwnedBranches,
    branches: (ov.branches ?? []).map((b) => ({
      ...b,
      name: formatTitleCase(b.name),
      brandName: b.brandName ? formatTitleCase(b.brandName) : b.brandName,
      franchiseeCompanyName: b.franchiseeCompanyName
        ? formatTitleCase(b.franchiseeCompanyName)
        : b.franchiseeCompanyName,
    })),
    categoryBreakdown: (ov.categoryBreakdown ?? []).map((c) => ({
      ...c,
      categoryName: formatTitleCase(c.categoryName),
    })),
    topProducts: (ov.topProducts ?? []).map((p) => ({
      ...p,
      productName: formatTitleCase(p.productName),
    })),
    waiterPerformance: (ov.waiterPerformance ?? []).map((w) => ({
      ...w,
      waiterName: formatTitleCase(w.waiterName),
    })),
    shiftSummaries: (ov.shiftSummaries ?? []).map((s) => ({
      ...s,
      branchName: formatTitleCase(s.branchName),
      openedBy: formatTitleCase(s.openedBy),
      closedBy: s.closedBy ? formatTitleCase(s.closedBy) : s.closedBy,
    })),
    criticalMaterials: (ov.criticalMaterials ?? []).map((m) => ({
      ...m,
      name: formatTitleCase(m.name),
      branchName: formatTitleCase(m.branchName),
    })),
    recentAudits: (ov.recentAudits ?? []).map((a) => ({
      ...a,
      userName: formatTitleCase(a.userName),
      branchName: formatTitleCase(a.branchName),
    })),
  }
}

const ERROR_TRANSLATIONS: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/^Invalid email or password$/i, "E-posta adresi veya parola hatalı."],
  [/^No active restaurant branch assigned to this Boss account$/i, "Bu Boss hesabına atanmış aktif bir restoran şubesi bulunamadı."],
  [/^Boss account is not active$/i, "Boss hesabınız aktif değil."],
  [/^Boss account not found$/i, "Boss hesabı bulunamadı."],
  [/^You do not have access to this branch$/i, "Bu şubeye erişim yetkiniz bulunmuyor."],
  [/^Selected branch is not active$/i, "Seçilen şube şu anda aktif değil."],
  [/^Only Boss accounts can switch branches$/i, "Yalnızca Boss hesapları şube değiştirebilir."],
  [/^This email address is already in use by another user$/i, "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor."],
  [/^This PIN code is already in use by another staff member in this branch$/i, "Bu PIN kodu bu şubedeki başka bir personel tarafından kullanılıyor."],
  [/^A 4-8 digit PIN is required for terminal users$/i, "El terminali kullanıcıları için 4-8 haneli PIN kodu zorunludur."],
  [/^Email and password are required for users with Merchant Panel access$/i, "Merchant Panel erişimi olan kullanıcılar için e-posta ve parola zorunludur."],
  [/^A role with this key already exists in this branch$/i, "Bu şubede aynı isim/anahtara sahip bir rol zaten mevcut."],
  [/^Reserved or invalid role key$/i, "Geçersiz veya sistem tarafından ayrılmış rol adı."],
  [/^System roles cannot be deleted$/i, "Sistem varsayılan rolleri silinemez."],
  [/^Only system role templates can be reset to default$/i, "Yalnızca sistem varsayılan rolleri fabrika ayarlarına sıfırlanabilir."],
  [/^Cannot delete role while staff members are assigned to it$/i, "Bu role atanmış personeller varken rol silinemez. Önce personellerin rolünü değiştirin."],
  [/^You cannot assign your own account as a subordinate branch manager$/i, "Kendi hesabınızı alt şube yöneticisi olarak atayamazsınız."],
  [/^You cannot unlink your own account from a branch$/i, "Kendi hesabınızın şube bağlantısını kaldıramazsınız."],
  [/^Brand Owner \(HQ\) cannot be unlinked from a branch$/i, "Marka Sahibi (HQ) şubeden ayrılamaz."],
  [/^A password of at least 8 characters is required/i, "Yeni Şube / Franchise Boss hesabı için en az 8 karakterli bir parola girilmelidir."],
  [/^Please select at least one authorized branch$/i, "Lütfen yetki sahibi olduğunuz en az bir şube seçin."],
  [/^Too many login attempts/i, "Çok fazla başarısız giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin."],
]

export function localizeApiError(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return "Beklenmeyen bir sunucu hatası oluştu."
  if (
    trimmed.toUpperCase().includes("ACCESS SUSPENDED") ||
    trimmed.toUpperCase().includes("IBAN:") ||
    trimmed.includes("Payment Account:")
  ) {
    const branchMatch = trimmed.match(/for "([^"]+)"/i)
    const branchPart = branchMatch?.[1] ? `${branchMatch[1]} işletmesi` : "İşletmeniz"
    return `${branchPart} için abonelik ödemesi tamamlanmadığından sistem erişimi geçici olarak durdurulmuştur. Lütfen Corder yönetimi ile iletişime geçin.`
  }
  for (const [pattern, replacement] of ERROR_TRANSLATIONS) {
    const match = trimmed.match(pattern)
    if (match) {
      return typeof replacement === "function" ? replacement(match) : replacement
    }
  }
  return trimmed
}
