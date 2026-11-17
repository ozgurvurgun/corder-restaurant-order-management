const getBase = () => ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim()

export interface MenuProduct {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  inStock: boolean
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

export interface MenuResponse {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  workingHours?: string
  logo?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  website?: string
  categories: MenuCategory[]
  campaigns: MenuCampaign[]
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

const CACHE_PREFIX = "corder_menu_cache_v1:"
const CACHE_TTL_MS = 60_000
const memoryCache = new Map<string, { timestamp: number; data: MenuResponse }>()

function readCachedMenu(slug: string): { timestamp: number; data: MenuResponse } | null {
  const mem = memoryCache.get(slug)
  if (mem) return mem
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${slug}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { timestamp?: number; data?: MenuResponse }
    if (typeof parsed?.timestamp === "number" && parsed.data?.id) {
      const entry = { timestamp: parsed.timestamp, data: parsed.data }
      memoryCache.set(slug, entry)
      return entry
    }
  } catch {
    // Ignore storage read errors
  }
  return null
}

function writeCachedMenu(slug: string, data: MenuResponse) {
  const entry = { timestamp: Date.now(), data }
  memoryCache.set(slug, entry)
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(entry))
  } catch {
    // Ignore storage quota errors
  }
}

export function resolveImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed
  }
  const base = getBase()
  if (!base) return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return `${base.replace(/\/$/, "")}${path}`
}

export function isCampaignCurrentlyValid(campaign: MenuCampaign): boolean {
  if (!campaign || campaign.isActive === false) return false
  if (!campaign.validUntil) return true
  const parsed = new Date(campaign.validUntil)
  if (Number.isNaN(parsed.getTime())) return true
  // If validUntil is at midnight (date-only), treat as valid until end of that day
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

export async function fetchMenu(restaurant: string, options?: { forceRefresh?: boolean }): Promise<MenuResponse> {
  const cleanSlug = restaurant.trim()
  if (!cleanSlug) {
    throw new MenuFetchError("Restoran bağlantısı belirtilmedi.", "missing_slug")
  }

  const cached = readCachedMenu(cleanSlug)
  if (!options?.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const base = getBase().replace(/\/$/, "")
  const q = encodeURIComponent(cleanSlug)
  const url = `${base}/menu?restaurant=${q}`

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
    const data = (await res.json()) as MenuResponse
    writeCachedMenu(cleanSlug, data)
    return data
  } catch (err) {
    if (err instanceof MenuFetchError) throw err
    // Fallback to stale cache if offline/network error occurred
    if (cached) return cached.data
    throw new MenuFetchError(
      "Menü yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.",
      "network"
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
