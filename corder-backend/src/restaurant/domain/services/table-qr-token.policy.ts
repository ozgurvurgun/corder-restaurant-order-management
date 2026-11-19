import { createHmac, timingSafeEqual } from 'crypto';

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

  static generateToken(restaurantId: string, tableId: string): string {
    return createHmac('sha256', TableQrTokenPolicy.getSecret())
      .update(`table-qr:${restaurantId}:${tableId}`)
      .digest('base64url')
      .slice(0, 16);
  }

  static verifyToken(
    restaurantId: string,
    tableId: string,
    candidate: string | undefined | null,
  ): boolean {
    const clean = (candidate ?? '').trim();
    if (!clean || clean.length !== 16) return false;
    const expected = TableQrTokenPolicy.generateToken(restaurantId, tableId);
    const a = Buffer.from(clean, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  static findMatchingTable<T extends { id: string }>(
    restaurantId: string,
    token: string | undefined | null,
    tables: T[],
  ): T | null {
    const clean = (token ?? '').trim();
    if (!clean) return null;
    for (const table of tables) {
      if (TableQrTokenPolicy.verifyToken(restaurantId, table.id, clean)) {
        return table;
      }
    }
    return null;
  }
}
