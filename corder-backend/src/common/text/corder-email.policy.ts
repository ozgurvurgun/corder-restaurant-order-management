export const CORDER_EMAIL_BASE_DOMAIN = 'corder.app';

const TURKISH_ASCII_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  I: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

function transliterateTurkishToAscii(input: string): string {
  return input
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (ch) => TURKISH_ASCII_MAP[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Converts a restaurant slug, restaurant name, or brand name into a valid
 * DNS subdomain label for `<local>@<tenant>.corder.app`.
 */
export function toCorderEmailTenantSlug(raw?: string | null): string {
  if (!raw) return '';
  const ascii = transliterateTurkishToAscii(String(raw).trim());
  return ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

/**
 * Builds the domain part (`<tenant>.corder.app` or `corder.app` when no tenant is given).
 */
export function buildCorderEmailDomain(tenantSlugOrName?: string | null): string {
  const tenant = toCorderEmailTenantSlug(tenantSlugOrName);
  return tenant
    ? `${tenant}.${CORDER_EMAIL_BASE_DOMAIN}`
    : CORDER_EMAIL_BASE_DOMAIN;
}

/**
 * Extracts and sanitizes the local part (before `@`) from either a raw local-part
 * input or a full email address.
 */
export function sanitizeCorderEmailLocalPart(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const beforeAt = trimmed.split('@')[0] ?? '';
  const ascii = transliterateTurkishToAscii(beforeAt.trim());
  return ascii
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._+-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._+-]+|[._+-]+$/g, '')
    .slice(0, 64);
}

/**
 * Formats a canonical `<local>@<tenant>.corder.app` email address.
 * Returns `null` if the local part is empty after sanitization.
 */
export function formatCanonicalCorderEmail(
  rawEmailOrLocalPart?: string | null,
  tenantSlugOrName?: string | null,
): string | null {
  const localPart = sanitizeCorderEmailLocalPart(rawEmailOrLocalPart);
  if (!localPart) return null;
  const domain = buildCorderEmailDomain(tenantSlugOrName);
  return `${localPart}@${domain}`;
}

