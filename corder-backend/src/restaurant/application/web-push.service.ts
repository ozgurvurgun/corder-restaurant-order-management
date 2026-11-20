import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DataSource } from 'typeorm';
import type { WebPushAppType } from '../domain/web-push-subscription.entity';
import {
  buildFraudAlertPushNotification,
  buildPlatformPushNotification,
  buildVapidJwt,
  buildWaiterCallPushNotification,
  encryptWebPushPayload,
  generateVapidKeyPair,
  isAllowedWebPushEndpoint,
  validateWebPushSubscriptionInput,
  type WebPushNotificationPayload,
  type WebPushSubscriptionInput,
} from '../domain/services/web-push.policy';

export {
  type WebPushAppType,
  type WebPushNotificationPayload,
  type WebPushSubscriptionInput,
};

interface StoredSubscriptionRow {
  endpoint: string;
  restaurantId: string;
  rootAdminId: string | null;
  appType: WebPushAppType;
  p256dh: string;
  auth: string;
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

  private applyInMemoryVapidKeys(): void {
    const generated = generateVapidKeyPair();
    this.vapidPublicKey = generated.publicKey;
    this.vapidPrivateKey = generated.privateKeyObj;
    this.initialized = true;
  }

  private async queryDefaultVapidRow(): Promise<{
    publicKey: string;
    privateJwk: crypto.JsonWebKey;
  } | null> {
    if (!this.dataSource || typeof this.dataSource.query !== 'function') return null;
    const rows = (await this.dataSource.query(
      `SELECT public_key AS "publicKey", private_jwk AS "privateJwk"
       FROM web_push_vapid_keys WHERE id = 'default' LIMIT 1`,
    )) as Array<{ publicKey: string; privateJwk: crypto.JsonWebKey }>;
    return Array.isArray(rows) && rows[0]?.publicKey && rows[0]?.privateJwk
      ? rows[0]
      : null;
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized && this.vapidPublicKey && this.vapidPrivateKey) return;
    if (!this.dataSource || typeof this.dataSource.query !== 'function') {
      this.applyInMemoryVapidKeys();
      return;
    }

    try {
      const existing = await this.queryDefaultVapidRow();
      if (existing) {
        this.vapidPublicKey = existing.publicKey;
        this.vapidPrivateKey = crypto.createPrivateKey({
          key: existing.privateJwk,
          format: 'jwk',
        });
        this.initialized = true;
        return;
      }

      const generated = generateVapidKeyPair();
      await this.dataSource.query(
        `INSERT INTO web_push_vapid_keys (id, public_key, private_jwk)
         VALUES ('default', $1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [generated.publicKey, JSON.stringify(generated.privateJwk)],
      );

      const confirmed = await this.queryDefaultVapidRow();
      this.vapidPublicKey = confirmed?.publicKey ?? generated.publicKey;
      this.vapidPrivateKey = confirmed
        ? crypto.createPrivateKey({ key: confirmed.privateJwk, format: 'jwk' })
        : generated.privateKeyObj;
      this.initialized = true;
    } catch (err) {
      this.logger.warn(
        `Falling back to in-memory VAPID keys: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.applyInMemoryVapidKeys();
    }
  }

  async getVapidPublicKey(): Promise<string> {
    await this.ensureInitialized();
    return this.vapidPublicKey;
  }

  async saveSubscription(
    restaurantId: string,
    appType: WebPushAppType,
    sub: WebPushSubscriptionInput,
    rootAdminId: string | null = null,
  ): Promise<boolean> {
    await this.ensureInitialized();
    const validated = validateWebPushSubscriptionInput(sub);
    if (!validated) return false;

    const row: StoredSubscriptionRow = {
      ...validated,
      restaurantId,
      rootAdminId,
      appType,
    };
    this.memorySubs.set(validated.endpoint, row);

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
          [
            validated.endpoint,
            restaurantId,
            rootAdminId,
            appType,
            validated.p256dh,
            validated.auth,
          ],
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

  private async queryTargetSubscriptions(
    restaurantIds: string[],
    appTypes: WebPushAppType[],
  ): Promise<StoredSubscriptionRow[]> {
    const includeBossMultiBranch = appTypes.includes('boss');
    if (this.dataSource && typeof this.dataSource.query === 'function') {
      try {
        const rows = (await this.dataSource.query(
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
        if (Array.isArray(rows) && rows.length > 0) return rows;
      } catch {
        // Fall through to in-memory cache
      }
    }
    const restSet = new Set(restaurantIds);
    const appSet = new Set(appTypes);
    return Array.from(this.memorySubs.values()).filter(
      (s) => restSet.has(s.restaurantId) && appSet.has(s.appType),
    );
  }

  private async deliverToSubscription(
    sub: StoredSubscriptionRow,
    payloadJson: string,
  ): Promise<void> {
    if (!isAllowedWebPushEndpoint(sub.endpoint) || !this.vapidPrivateKey) return;
    try {
      const body = encryptWebPushPayload(sub.p256dh, sub.auth, payloadJson);
      const jwt = buildVapidJwt(sub.endpoint, this.vapidPrivateKey);
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

    const targets = await this.queryTargetSubscriptions(restaurantIds, appTypes);
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
      targets.map((sub) => this.deliverToSubscription(sub, payloadJson)),
    );
  }

  async sendWaiterCallPush(
    restaurantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.sendToRestaurantApps(
      [restaurantId],
      ['terminal', 'merchant'],
      buildWaiterCallPushNotification(payload),
    );
  }

  async sendFraudAlertPush(
    restaurantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.sendToRestaurantApps(
      [restaurantId],
      ['boss', 'merchant'],
      buildFraudAlertPushNotification(payload),
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
    const { appTypes, notification } = buildPlatformPushNotification(payload);
    if (appTypes.length === 0) return;
    await this.sendToRestaurantApps(restaurantIds, appTypes, notification);
  }
}
