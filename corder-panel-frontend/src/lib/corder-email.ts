export const CORDER_EMAIL_BASE_DOMAIN = "corder.app"

const TURKISH_ASCII_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
}

function transliterateTurkishToAscii(input: string): string {
  return input
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (ch) => TURKISH_ASCII_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function toCorderEmailTenantSlug(raw?: string | null): string {
  if (!raw) return ""
  const ascii = transliterateTurkishToAscii(String(raw).trim())
  return ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "")
}

export function buildCorderEmailDomain(tenantSlugOrName?: string | null): string {
  const tenant = toCorderEmailTenantSlug(tenantSlugOrName)
  return tenant
    ? `${tenant}.${CORDER_EMAIL_BASE_DOMAIN}`
    : CORDER_EMAIL_BASE_DOMAIN
}

export function sanitizeCorderEmailLocalPartInput(raw?: string | null): string {
  if (!raw) return ""
  const beforeAt = String(raw).split("@")[0] ?? ""
  const ascii = transliterateTurkishToAscii(beforeAt)
  return ascii
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._+-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._+-]+/, "")
    .slice(0, 64)
}

export function extractCorderEmailLocalPart(raw?: string | null): string {
  return sanitizeCorderEmailLocalPartInput(raw).replace(/[._+-]+$/, "")
}

export function formatCanonicalCorderEmail(
  rawLocalOrEmail?: string | null,
  tenantSlugOrName?: string | null
): string {
  const localPart = extractCorderEmailLocalPart(rawLocalOrEmail)
  if (!localPart) return ""
  const domain = buildCorderEmailDomain(tenantSlugOrName)
  return `${localPart}@${domain}`
}
