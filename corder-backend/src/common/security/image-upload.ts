import { extname } from 'path';

export const ALLOWED_IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87A_MAGIC = Buffer.from('GIF87a', 'ascii');
const GIF89A_MAGIC = Buffer.from('GIF89a', 'ascii');
const RIFF_MAGIC = Buffer.from('RIFF', 'ascii');
const WEBP_MAGIC = Buffer.from('WEBP', 'ascii');

export function detectImageMimeFromMagicBytes(buf: Buffer): string | null {
  if (!buf || buf.length < 4) return null;

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'image/png';
  }
  if (
    buf.length >= 6 &&
    (buf.subarray(0, 6).equals(GIF87A_MAGIC) || buf.subarray(0, 6).equals(GIF89A_MAGIC))
  ) {
    return 'image/gif';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).equals(RIFF_MAGIC) &&
    buf.subarray(8, 12).equals(WEBP_MAGIC)
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateOriginalImageFilename(
  originalName: string,
): { ext: string; expectedMime: string } | null {
  const raw = (originalName ?? '').trim();
  if (!raw || raw.includes('\0') || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    return null;
  }
  const ext = extname(raw).toLowerCase();
  const expectedMime = ALLOWED_IMAGE_CONTENT_TYPES[ext];
  if (!expectedMime) {
    return null;
  }
  return { ext, expectedMime };
}

export function contentTypeForUploadPath(filePath: string): string {
  const ext = extname(filePath || '').toLowerCase();
  return ALLOWED_IMAGE_CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

