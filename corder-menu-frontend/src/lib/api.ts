const getBase = () => ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim()

export interface MenuProduct {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  inStock: boolean
  calories?: number
  allergens?: string[]
}

export interface MenuCategory {
  id: string
  name: string
  slug: string
  products: MenuProduct[]
  children?: MenuCategory[]
}

export interface MenuCampaign {
  id: string
  title: string
  description?: string
  imageUrl: string
  discountPercent?: number
  originalPrice?: number
  discountedPrice?: number
  validUntil?: string
  isActive: boolean
}

export type MenuTemplateId =
  | "classic"
  | "bistro-grid"
  | "luxury-noir"
  | "editorial"
  | "vibrant-pop"

export const MENU_TEMPLATE_IDS: readonly MenuTemplateId[] = [
  "classic",
  "bistro-grid",
  "luxury-noir",
  "editorial",
  "vibrant-pop",
] as const

export function isValidMenuTemplateId(value: unknown): value is MenuTemplateId {
  return typeof value === "string" && (MENU_TEMPLATE_IDS as readonly string[]).includes(value)
}

export interface MenuTableContext {
  tableId: string
  tableName: string
  sectionName?: string | null
  tableToken: string
}

export interface MenuRestaurantInfo {
  id?: string
  name?: string
  slug?: string
  logo?: string | null
  logoUrl?: string | null
  menuTemplate?: MenuTemplateId
}

export interface MenuResponse {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  workingHours?: string
  logo?: string | null
  logoUrl?: string | null
  whatsapp?: string
  instagram?: string
  facebook?: string
  website?: string
  menuTemplate?: MenuTemplateId
  restaurant?: MenuRestaurantInfo | null
  tableContext?: MenuTableContext | null
  categories: MenuCategory[]
  campaigns: MenuCampaign[]
}

export type WaiterCallRequestType = "waiter" | "bill"

export interface CallWaiterPayload {
  tableToken: string
  requestType: WaiterCallRequestType
  note?: string
}

export interface CallWaiterResponse {
  ok: boolean
  id?: string
  tableName?: string
  sectionName?: string | null
  requestType?: WaiterCallRequestType
  cooldownSeconds?: number
}

export type MenuErrorKind = "missing_slug" | "not_found" | "suspended" | "network"

export class MenuFetchError extends Error {
  readonly kind: MenuErrorKind
  constructor(message: string, kind: MenuErrorKind) {
    super(message)
    this.name = "MenuFetchError"
    this.kind = kind
  }
}

const CACHE_PREFIX = "corder_menu_cache_v5:"
const CACHE_TTL_MS = 60_000
const memoryCache = new Map<string, { timestamp: number; data: MenuResponse }>()

function buildCacheKey(slug: string, tableToken?: string): string {
  const cleanToken = tableToken?.trim() || ""
  return cleanToken ? `${slug}::t:${cleanToken}` : slug
}

function readCachedMenu(cacheKey: string): { timestamp: number; data: MenuResponse } | null {
  const mem = memoryCache.get(cacheKey)
  if (mem) return mem
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { timestamp?: number; data?: MenuResponse }
    if (typeof parsed?.timestamp === "number" && parsed.data?.id) {
      const entry = { timestamp: parsed.timestamp, data: parsed.data }
      memoryCache.set(cacheKey, entry)
      return entry
    }
  } catch {
    // Ignore storage read errors
  }
  return null
}

function writeCachedMenu(cacheKey: string, data: MenuResponse) {
  const entry = { timestamp: Date.now(), data }
  memoryCache.set(cacheKey, entry)
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(entry))
  } catch {
    // Ignore storage quota errors
  }
}

export function resolveAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed
  }

  const base = getBase()
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return base ? `${base.replace(/\/$/, "")}${path}` : path
}

export const resolveImageUrl = resolveAssetUrl

export function isCampaignCurrentlyValid(campaign: MenuCampaign): boolean {
  if (!campaign || campaign.isActive === false) return false
  if (!campaign.validUntil) return true
  const parsed = new Date(campaign.validUntil)
  if (Number.isNaN(parsed.getTime())) return true
  if (
    parsed.getUTCHours() === 0 &&
    parsed.getUTCMinutes() === 0 &&
    parsed.getUTCSeconds() === 0
  ) {
    return parsed.getTime() + 24 * 60 * 60 * 1000 - 1 >= Date.now()
  }
  return parsed.getTime() >= Date.now()
}

export function formatMenuPrice(amount: number): string {
  if (!Number.isFinite(amount)) return "0"
  const minor = Math.round(amount * 100)
  const major = minor / 100
  const hasMinorUnits = minor % 100 !== 0
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: hasMinorUnits ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major)
}

const TURKIC_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/u

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
  const raw = String(input).trim().replace(/\s+/g, " ")
  if (!raw) return ""
  const resolvedLocale = resolveCasingLocale(raw, locale)
  const lower = (
    resolvedLocale ? raw.toLocaleLowerCase(resolvedLocale) : raw.toLowerCase()
  ).replace(/\u0307/g, "")
  return lower.replace(
    /([^\p{L}']|^)(\p{L})/gu,
    (_match, prefix: string, letter: string) =>
      `${prefix}${resolvedLocale ? letter.toLocaleUpperCase(resolvedLocale) : letter.toUpperCase()}`,
  )
}

function normalizeMenuCategoryTree(cat: MenuCategory): MenuCategory {
  return {
    ...cat,
    name: formatTitleCase(cat.name),
    products: (cat.products ?? []).map((p) => {
      const calories =
        typeof p.calories === "number" && Number.isFinite(p.calories) && p.calories > 0
          ? Math.round(p.calories)
          : undefined
      const allergens = Array.isArray(p.allergens)
        ? p.allergens.map((item) => formatTitleCase(item)).filter(Boolean)
        : []
      return {
        ...p,
        name: formatTitleCase(p.name),
        calories,
        allergens: allergens.length > 0 ? allergens : undefined,
      }
    }),
    children: cat.children ? cat.children.map(normalizeMenuCategoryTree) : undefined,
  }
}

function normalizeMenuResponse(data: MenuResponse, tableToken?: string): MenuResponse {
  const resolvedLogo =
    data.logoUrl ?? data.logo ?? data.restaurant?.logoUrl ?? data.restaurant?.logo ?? null
  const rawTemplate = data.menuTemplate ?? data.restaurant?.menuTemplate ?? "classic"
  const resolvedTemplate: MenuTemplateId = isValidMenuTemplateId(rawTemplate)
    ? rawTemplate
    : "classic"
  const cleanToken = tableToken?.trim() || ""
  const rawCtx = cleanToken ? data.tableContext : null
  const validTableContext =
    rawCtx && typeof rawCtx.tableId === "string" && typeof rawCtx.tableName === "string"
      ? {
          tableId: rawCtx.tableId,
          tableName: formatTitleCase(rawCtx.tableName),
          sectionName: rawCtx.sectionName ? formatTitleCase(rawCtx.sectionName) : null,
          tableToken: rawCtx.tableToken || cleanToken,
        }
      : null

  return {
    ...data,
    name: formatTitleCase(data.name),
    logo: resolvedLogo ?? undefined,
    logoUrl: resolvedLogo,
    menuTemplate: resolvedTemplate,
    restaurant: {
      id: data.restaurant?.id ?? data.id,
      name: formatTitleCase(data.restaurant?.name ?? data.name),
      slug: data.restaurant?.slug ?? data.slug,
      logo: resolvedLogo,
      logoUrl: resolvedLogo,
      menuTemplate: resolvedTemplate,
    },
    tableContext: validTableContext,
    categories: (data.categories ?? []).map(normalizeMenuCategoryTree),
    campaigns: (data.campaigns ?? []).map((c) => ({
      ...c,
      title: formatTitleCase(c.title),
    })),
  }
}

export async function fetchMenu(
  restaurant: string,
  options?: { forceRefresh?: boolean; tableToken?: string }
): Promise<MenuResponse> {
  const cleanSlug = restaurant.trim()
  if (!cleanSlug) {
    throw new MenuFetchError("Restoran bağlantısı belirtilmedi.", "missing_slug")
  }
  const cleanToken = options?.tableToken?.trim() || ""
  const cacheKey = buildCacheKey(cleanSlug, cleanToken)

  const cached = readCachedMenu(cacheKey)
  if (!options?.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const base = getBase().replace(/\/$/, "")
  const q = encodeURIComponent(cleanSlug)
  const tQuery = cleanToken ? `&t=${encodeURIComponent(cleanToken)}` : ""
  const url = `${base}/menu?restaurant=${q}${tQuery}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      const text = await res.text()
      let message = text
      try {
        const j = JSON.parse(text) as { message?: string | string[] }
        message = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? text)
      } catch {
        // Ignore non-JSON body
      }
      const lower = (message || "").toLowerCase()
      if (
        res.status === 403 ||
        res.status === 423 ||
        lower.includes("suspended") ||
        lower.includes("ödeme") ||
        lower.includes("askıya") ||
        lower.includes("durduruldu")
      ) {
        throw new MenuFetchError(
          "Bu işletmenin dijital menü hizmeti geçici olarak kullanım dışıdır.",
          "suspended"
        )
      }
      if (res.status === 404 || lower.includes("not found")) {
        throw new MenuFetchError(
          "Bu işletmeye ait aktif bir dijital menü bulunamadı.",
          "not_found"
        )
      }
      throw new MenuFetchError("Menü yüklenirken bir sorun oluştu.", "network")
    }
    const rawData = (await res.json()) as MenuResponse
    const data = normalizeMenuResponse(rawData, cleanToken)
    writeCachedMenu(cacheKey, data)
    return data
  } catch (err) {
    if (err instanceof MenuFetchError) throw err
    if (cached) return cached.data
    throw new MenuFetchError(
      "Menü yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.",
      "network"
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function callWaiter(
  slug: string,
  payload: CallWaiterPayload
): Promise<CallWaiterResponse> {
  const cleanSlug = slug.trim()
  if (!cleanSlug || !payload.tableToken?.trim()) {
    throw new Error("Geçerli bir masa doğrulaması bulunamadı.")
  }
  const base = getBase().replace(/\/$/, "")
  const url = `${base}/menu/${encodeURIComponent(cleanSlug)}/call-waiter`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tableToken: payload.tableToken.trim(),
      requestType: payload.requestType,
      ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
    }),
  })
  if (!res.ok) {
    const raw = await res.text()
    let message = "Garson çağrısı gönderilemedi."
    try {
      const parsed = JSON.parse(raw) as { message?: string | string[] }
      const extracted = Array.isArray(parsed.message)
        ? parsed.message.join(", ")
        : parsed.message
      if (extracted) message = extracted
    } catch {
      if (raw.trim()) message = raw.trim()
    }
    throw new Error(message)
  }
  return (await res.json().catch(() => ({ ok: true }))) as CallWaiterResponse
}
