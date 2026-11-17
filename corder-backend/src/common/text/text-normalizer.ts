/**
 * Canonical text normalization and Turkish Title Case formatting utilities.
 *
 * Engineering standard:
 * - Persistence layer stores human-entered names (products, categories, staff,
 *   customers, materials, suppliers, campaigns) in canonical Turkish lowercase
 *   with collapsed single spaces (`normalizeStorageText`).
 * - Presentation / UI layers format stored names into Turkish Title Case
 *   (`formatTitleCaseTr`) where each word starts with an uppercase letter.
 */

export function normalizeStorageText(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0307/g, '');
}

export function formatTitleCaseTr(input: string | null | undefined): string {
  const lower = normalizeStorageText(input);
  if (!lower) return '';
  return lower.replace(
    /([^\p{L}']|^)(\p{L})/gu,
    (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('tr-TR')}`,
  );
}

