/**
 * Universal Unicode text normalization & Title Case formatting.
 *
 * - `normalizeStorageText`: trims leading/trailing whitespace, collapses consecutive
 *   whitespace into a single space, and converts letters across all Unicode scripts
 *   (\p{L}: Latin, Extended Latin, Cyrillic, Greek, Turkic, etc.) to canonical lowercase.
 * - `formatTitleCase`: formats text into Title Case where every word across any
 *   Unicode alphabet starts with an uppercase letter.
 */

const TURKIC_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/u;

function resolveCasingLocale(text: string, explicitLocale?: string): string | undefined {
  if (explicitLocale) return explicitLocale;
  if (TURKIC_CHAR_RE.test(text)) return 'tr';
  return undefined;
}

export function normalizeStorageText(
  input: string | null | undefined,
  locale?: string,
): string {
  if (!input) return '';
  const raw = String(input).trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const resolvedLocale = resolveCasingLocale(raw, locale);
  return (resolvedLocale ? raw.toLocaleLowerCase(resolvedLocale) : raw.toLowerCase()).replace(
    /\u0307/g,
    '',
  );
}

export function formatTitleCase(
  input: string | null | undefined,
  locale?: string,
): string {
  const lower = normalizeStorageText(input, locale);
  if (!lower) return '';
  const resolvedLocale = resolveCasingLocale(lower, locale);
  return lower.replace(
    /([^\p{L}']|^)(\p{L})/gu,
    (_match, prefix: string, letter: string) =>
      `${prefix}${resolvedLocale ? letter.toLocaleUpperCase(resolvedLocale) : letter.toUpperCase()}`,
  );
}
