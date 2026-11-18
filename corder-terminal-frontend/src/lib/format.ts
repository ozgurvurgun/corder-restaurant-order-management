import { getBase } from "./api"

export function toMinorUnits(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") return 0
  const num = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 100)
}

export function fromMinorUnits(minorUnits: number): number {
  if (!Number.isFinite(minorUnits)) return 0
  return Number((Math.round(minorUnits) / 100).toFixed(2))
}

export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? fromMinorUnits(toMinorUnits(amount)) : 0
  return new Intl.NumberFormat("tr-TR", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
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

export function translateApiError(raw: unknown, fallback = "İşlem gerçekleştirilemedi"): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : ""
  const trimmed = msg.trim()
  if (!trimmed) return fallback
  const lower = trimmed.toLowerCase()

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin."
  }
  if (lower.includes("invalid email or password")) {
    return "E-posta veya parola hatalı."
  }
  if (lower.includes("invalid pin") || lower.includes("pin must")) {
    return "Geçersiz PIN kodu."
  }
  if (lower.includes("too many") || lower.includes("rate limit") || lower.includes("çok fazla")) {
    return "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin."
  }
  if (lower.includes("terminal access is disabled")) {
    return "Bu personelin terminal erişim yetkisi kapatılmış."
  }
  if (lower.includes("no open cash shift") || lower.includes("cash shift") || lower.includes("açık kasa")) {
    return "Açık kasa vardiyası bulunmuyor. Lütfen kasa panelinden vardiya açın."
  }
  if (lower.includes("checkout") || lower.includes("register checkout")) {
    return "Bu masa şu anda kasada hesap kesiminde."
  }
  if (lower.includes("currently being served by")) {
    const match = trimmed.match(/served by\s+(.+)$/i)
    const holder = formatTitleCase(match?.[1]?.trim()) || "başka bir garson"
    return `Masa şu anda ${holder} tarafından kullanılıyor.`
  }
  if (lower.includes("out of stock") || lower.includes("not in stock") || lower.includes("stokta yok")) {
    return "Seçilen ürünlerden biri tükenmiş (stokta yok)."
  }
  if (lower.includes("do not have permission") || lower.includes("forbidden")) {
    return "Bu işlem için yetkiniz bulunmuyor."
  }
  if (lower.includes("table not found")) {
    return "Masa bulunamadı."
  }
  if (lower.includes("order item not found") || lower.includes("order items were not found")) {
    return "Sipariş kalemi bulunamadı veya zaten işlem görmüş."
  }
  if (lower.includes("no active orders")) {
    return "Bu masada aktif adisyon bulunmuyor."
  }
  return trimmed
}
