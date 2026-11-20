import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
import { DataSource } from 'typeorm';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import type { WebPushAppType } from '../domain/web-push-subscription.entity';

export type { WebPushAppType };

export interface WebPushSubscriptionInput {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface WebPushNotificationPayload {
  title: string;
  body: string;
  tag: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

interface StoredSubscriptionRow {
  endpoint: string;
  restaurantId: string;
  rootAdminId: string | null;
  appType: WebPushAppType;
  p256dh: string;
  auth: string;
}

const ALLOWED_PUSH_HOST_SUFFIXES = [
  '.googleapis.com', '.google.com', '.mozilla.com', '.mozilla.org', '.apple.com',
  '.windows.com', '.live.com', '.microsoft.com', '.opera.com', '.samsungosp.com',
  '.dbankcloud.cn', '.hicloud.com',
] as const;

export function isAllowedWebPushEndpoint(rawEndpoint: string): boolean {
  try {
    const parsed = new URL(rawEndpoint);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const host = parsed.hostname.toLowerCase().trim();
    if (!host || net.isIP(host) !== 0) return false;
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
      return false;
    }
    return ALLOWED_PUSH_HOST_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
  } catch {
    return false;
  }
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private vapidPublicKey = '';
  private vapidPrivateKey: crypto.KeyObject | null = null;
  private initialized = false;
  private readonly memorySubs = new Map<string, StoredSubscriptionRow>();

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  private generateVapidKeyPair(): {
    publicKey: string;
    privateJwk: crypto.JsonWebKey;
    privateKeyObj: crypto.KeyObject;
  } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const pubJwk = publicKey.export({ format: 'jwk' });
    const privJwk = privateKey.export({ format: 'jwk' });
    const rawPub = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(pubJwk.x!, 'base64url'),
      Buffer.from(pubJwk.y!, 'base64url'),
    ]).toString('base64url');
    return {
      publicKey: rawPub,
      privateJwk: privJwk,
      privateKeyObj: privateKey,
    };
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized && this.vapidPublicKey && this.vapidPrivateKey) {
      return;
    }
    if (!this.dataSource || typeof this.dataSource.query !== 'function') {
      const generated = this.generateVapidKeyPair();
      this.vapidPublicKey = generated.publicKey;
      this.vapidPrivateKey = generated.privateKeyObj;
      this.initialized = true;
      return;
    }

    try {
      const existing = (await this.dataSource.query(
        `SELECT public_key AS "publicKey", private_jwk AS "privateJwk"
         FROM web_push_vapid_keys WHERE id = 'default' LIMIT 1`,
      )) as Array<{ publicKey: string; privateJwk: crypto.JsonWebKey }>;

      if (Array.isArray(existing) && existing[0]?.publicKey && existing[0]?.privateJwk) {
        this.vapidPublicKey = existing[0].publicKey;
        this.vapidPrivateKey = crypto.createPrivateKey({
          key: existing[0].privateJwk,
          format: 'jwk',
        });
        this.initialized = true;
        return;
      }

      const generated = this.generateVapidKeyPair();
      await this.dataSource.query(
        `INSERT INTO web_push_vapid_keys (id, public_key, private_jwk)
         VALUES ('default', $1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [generated.publicKey, JSON.stringify(generated.privateJwk)],
      );

      const confirmed = (await this.dataSource.query(
        `SELECT public_key AS "publicKey", private_jwk AS "privateJwk"
         FROM web_push_vapid_keys WHERE id = 'default' LIMIT 1`,
      )) as Array<{ publicKey: string; privateJwk: crypto.JsonWebKey }>;

      if (Array.isArray(confirmed) && confirmed[0]?.publicKey) {
        this.vapidPublicKey = confirmed[0].publicKey;
        this.vapidPrivateKey = crypto.createPrivateKey({
          key: confirmed[0].privateJwk,
          format: 'jwk',
        });
      } else {
        this.vapidPublicKey = generated.publicKey;
        this.vapidPrivateKey = generated.privateKeyObj;
      }
      this.initialized = true;
    } catch (err) {
      this.logger.warn(
        `Falling back to in-memory VAPID keys: ${err instanceof Error ? err.message : String(err)}`,
      );
      const generated = this.generateVapidKeyPair();
      this.vapidPublicKey = generated.publicKey;
      this.vapidPrivateKey = generated.privateKeyObj;
      this.initialized = true;
    }
  }

  async getVapidPublicKey(): Promise<string> {
    await this.ensureInitialized();
    return this.vapidPublicKey;
  }

  private decodeBase64Flexible(input: string): Buffer {
    const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, 'base64');
  }

  async saveSubscription(
    restaurantId: string,
    appType: WebPushAppType,
    sub: WebPushSubscriptionInput,
    rootAdminId: string | null = null,
  ): Promise<boolean> {
    await this.ensureInitialized();
    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint.trim() : '';
    const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';
    const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth.trim() : '';
    if (!endpoint || !p256dh || !auth) return false;
    if (!isAllowedWebPushEndpoint(endpoint)) return false;

    try {
      const pubBuf = this.decodeBase64Flexible(p256dh);
      const authBuf = this.decodeBase64Flexible(auth);
      if (pubBuf.length !== 65 || pubBuf[0] !== 0x04 || authBuf.length < 12) {
        return false;
      }
    } catch {
      return false;
    }

    const row: StoredSubscriptionRow = {
      endpoint,
      restaurantId,
      rootAdminId,
      appType,
      p256dh,
      auth,
    };
    this.memorySubs.set(endpoint, row);

    if (this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        await this.dataSource.query(
          `INSERT INTO web_push_subscriptions (endpoint, restaurant_id, root_admin_id, app_type, p256dh, auth, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (endpoint) DO UPDATE
           SET restaurant_id = EXCLUDED.restaurant_id,
               root_admin_id = EXCLUDED.root_admin_id,
               app_type = EXCLUDED.app_type,
               p256dh = EXCLUDED.p256dh,
               auth = EXCLUDED.auth,
               updated_at = now()`,
          [endpoint, restaurantId, rootAdminId, appType, p256dh, auth],
        );
        await this.dataSource.query(
          `DELETE FROM web_push_subscriptions WHERE updated_at < now() - interval '90 days'`,
        );
      } catch {
        // Ignore DB persistence error if in-memory succeeded
      }
    }
    return true;
  }

  async removeSubscription(restaurantId: string, endpoint: string): Promise<void> {
    const clean = (endpoint ?? '').trim();
    if (!clean) return;
    this.memorySubs.delete(clean);
    if (this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        await this.dataSource.query(
          `DELETE FROM web_push_subscriptions WHERE endpoint = $1 AND restaurant_id = $2`,
          [clean, restaurantId],
        );
      } catch {
        // Ignore DB cleanup errors
      }
    }
  }

  private buildVapidJwt(endpoint: string): string {
    const origin = new URL(endpoint).origin;
    const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({
        aud: origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: 'mailto:bildirim@corderapp.com',
      }),
    ).toString('base64url');
    const unsigned = `${header}.${payload}`;
    const sig = crypto
      .sign('sha256', Buffer.from(unsigned), {
        key: this.vapidPrivateKey!,
        dsaEncoding: 'ieee-p1363',
      })
      .toString('base64url');
    return `${unsigned}.${sig}`;
  }

  encryptPayload(p256dh: string, auth: string, payloadText: string): Buffer {
    const uaPublic = this.decodeBase64Flexible(p256dh);
    const authSecret = this.decodeBase64Flexible(auth);
    const payloadBuf = Buffer.from(payloadText, 'utf8');

    const asEcdh = crypto.createECDH('prime256v1');
    asEcdh.generateKeys();
    const asPublic = asEcdh.getPublicKey();
    const sharedSecret = asEcdh.computeSecret(uaPublic);
    const salt = crypto.randomBytes(16);

    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'ascii'), uaPublic, asPublic]);
    const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));
    const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'ascii'), 16));
    const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'ascii'), 12));
    const padded = Buffer.concat([payloadBuf, Buffer.from([2])]);
    const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
    const rsBuf = Buffer.alloc(4);
    rsBuf.writeUInt32BE(4096, 0);
    return Buffer.concat([salt, rsBuf, Buffer.from([asPublic.length]), asPublic, encrypted]);
  }

  async sendToRestaurantApps(
    restaurantIds: string[],
    appTypes: WebPushAppType[],
    notification: WebPushNotificationPayload,
  ): Promise<void> {
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) return;
    if (!Array.isArray(appTypes) || appTypes.length === 0) return;
    await this.ensureInitialized();
    if (!this.vapidPublicKey || !this.vapidPrivateKey) return;

    const includeBossMultiBranch = appTypes.includes('boss');
    let targets: StoredSubscriptionRow[] = [];
    if (this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        targets = (await this.dataSource.query(
          `SELECT DISTINCT
                  s.endpoint,
                  s.restaurant_id AS "restaurantId",
                  s.root_admin_id AS "rootAdminId",
                  s.app_type AS "appType",
                  s.p256dh,
                  s.auth
           FROM web_push_subscriptions s
           WHERE (
             s.restaurant_id = ANY($1::uuid[])
             AND s.app_type = ANY($2::varchar[])
           )
           OR (
             $3::boolean = true
             AND s.app_type = 'boss'
             AND s.root_admin_id IS NOT NULL
             AND (
               s.root_admin_id IN (
                 SELECT r.root_admin_id FROM restaurants r
                 WHERE r.id = ANY($1::uuid[]) AND r.root_admin_id IS NOT NULL
               )
               OR s.root_admin_id IN (
                 SELECT br.boss_id FROM boss_restaurants br
                 WHERE br.restaurant_id = ANY($1::uuid[])
               )
             )
           )`,
          [restaurantIds, appTypes, includeBossMultiBranch],
        )) as StoredSubscriptionRow[];
      } catch {
        targets = [];
      }
    }
    if (targets.length === 0 && this.memorySubs.size > 0) {
      const restSet = new Set(restaurantIds);
      const appSet = new Set(appTypes);
      targets = Array.from(this.memorySubs.values()).filter(
        (s) => restSet.has(s.restaurantId) && appSet.has(s.appType),
      );
    }
    if (targets.length === 0) return;

    const payloadJson = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: notification.tag,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/icon-96x96.png',
      data: notification.data || {},
    });

    await Promise.allSettled(
      targets.map(async (sub) => {
        if (!isAllowedWebPushEndpoint(sub.endpoint)) return;
        try {
          const body = this.encryptPayload(sub.p256dh, sub.auth, payloadJson);
          const jwt = this.buildVapidJwt(sub.endpoint);
          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              TTL: '300',
              Urgency: 'high',
              Authorization: `vapid t=${jwt}, k=${this.vapidPublicKey}`,
            },
            body: new Uint8Array(body),
          });
          if (res.status === 404 || res.status === 410) {
            await this.removeSubscription(sub.restaurantId, sub.endpoint);
          }
        } catch {
          // Ignore network failures to individual push endpoints
        }
      }),
    );
  }

  async sendWaiterCallPush(
    restaurantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const rawTable = typeof payload.tableName === 'string' ? payload.tableName.trim() : '';
    const rawSection =
      typeof payload.sectionName === 'string' ? payload.sectionName.trim() : '';
    const tableName = rawTable ? normalizeStorageText(rawTable) : 'Masa';
    const sectionName = rawSection ? normalizeStorageText(rawSection) : 'Salon';
    const isBill = payload.requestType === 'bill';
    const actionLabel = isBill ? 'Hesap İstiyor!' : 'Garson Çağırıyor!';
    const note = typeof payload.note === 'string' ? payload.note.trim() : '';
    const callId =
      typeof payload.id === 'string' && payload.id.trim()
        ? payload.id.trim()
        : `${Date.now()}`;

    await this.sendToRestaurantApps(
      [restaurantId],
      ['terminal', 'merchant'],
      {
        title: `🔔 ${tableName} (${sectionName}) - ${actionLabel}`,
        body: note ? `Not: ${note}` : `${tableName} masası çağrı gönderdi.`,
        tag: `waiter-call-${callId}`,
        data: { type: 'waiter-call', callId, tableId: payload.tableId },
      },
    );
  }

  async sendFraudAlertPush(
    restaurantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const sev = payload.severity === 'critical' ? 'KRİTİK' : 'YÜKSEK';
    const rawTitle =
      typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : 'Şüpheli İşlem Tespit Edildi';
    const desc =
      typeof payload.description === 'string' && payload.description.trim()
        ? payload.description.trim()
        : 'Güvenlik ve suistimal tespit merkezi yeni bir uyarı kaydetti.';
    const alertId =
      typeof payload.id === 'string' && payload.id.trim()
        ? payload.id.trim()
        : `${Date.now()}`;

    await this.sendToRestaurantApps(
      [restaurantId],
      ['boss', 'merchant'],
      {
        title: `🚨 [${sev}] ${rawTitle}`,
        body: desc,
        tag: `corder-fraud-${alertId}`,
        data: { type: 'fraud-alert', alertId, tab: 'security' },
      },
    );
  }

  async sendPlatformNotificationPush(
    restaurantIds: string[],
    payload: {
      id: string;
      title: string;
      message: string;
      level: string;
      targetApps: string[];
    },
  ): Promise<void> {
    const rawApps = Array.isArray(payload.targetApps) ? payload.targetApps : ['merchant', 'boss'];
    const appTypes: WebPushAppType[] = [];
    if (rawApps.includes('terminal')) appTypes.push('terminal');
    if (rawApps.includes('merchant') || rawApps.includes('panel')) appTypes.push('merchant');
    if (rawApps.includes('boss')) appTypes.push('boss');
    if (appTypes.length === 0) return;

    await this.sendToRestaurantApps(restaurantIds, appTypes, {
      title: `📢 ${payload.title || 'Corder Bildirimi'}`,
      body: payload.message || '',
      tag: `corder-platform-${payload.id}`,
      data: { type: 'platform-notification', notificationId: payload.id },
    });
  }
}
