import { createHmac, timingSafeEqual } from 'crypto';
import { normalizeStorageText } from '../../../common/text/text-normalizer';

export class TableQrTokenPolicy {
  private static getSecret(): string {
    const secret =
      process.env.TABLE_QR_SECRET?.trim() || process.env.JWT_SECRET?.trim();
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'TABLE_QR_SECRET or JWT_SECRET must be configured in production',
      );
    }
    return 'corder-table-qr-secret';
  }

  static generateToken(restaurantId: string, tableName: string): string {
    const canonicalTableName = normalizeStorageText(tableName);
    return createHmac('sha256', TableQrTokenPolicy.getSecret())
      .update(`table-qr:${restaurantId}:${canonicalTableName}`)
      .digest('base64url')
      .slice(0, 16);
  }

  static verifyToken(
    restaurantId: string,
    tableName: string,
    candidate: string | undefined | null,
  ): boolean {
    const clean = (candidate ?? '').trim();
    if (!clean || clean.length !== 16) return false;
    const expected = TableQrTokenPolicy.generateToken(restaurantId, tableName);
    const a = Buffer.from(clean, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  static findMatchingTable<T extends { name: string }>(
    restaurantId: string,
    token: string | undefined | null,
    tables: T[],
  ): T | null {
    const clean = (token ?? '').trim();
    if (!clean) return null;
    for (const table of tables) {
      if (TableQrTokenPolicy.verifyToken(restaurantId, table.name, clean)) {
        return table;
      }
    }
    return null;
  }
}
