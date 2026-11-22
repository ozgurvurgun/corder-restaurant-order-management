import * as crypto from 'node:crypto';
import * as net from 'node:net';
import { formatTitleCase } from '../../../common/text/text-normalizer';
import type { WebPushAppType } from '../web-push-subscription.entity';

export interface WebPushSubscriptionInput {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface ValidatedWebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushNotificationPayload {
  title: string;
  body: string;
  tag: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

const ALLOWED_PUSH_HOST_SUFFIXES = [
  '.googleapis.com',
  '.google.com',
  '.mozilla.com',
  '.mozilla.org',
  '.apple.com',
  '.windows.com',
  '.live.com',
  '.microsoft.com',
  '.opera.com',
  '.samsungosp.com',
  '.dbankcloud.cn',
  '.hicloud.com',
] as const;

export function isAllowedWebPushEndpoint(rawEndpoint: string): boolean {
  try {
    const parsed = new URL(rawEndpoint);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const host = parsed.hostname.toLowerCase().trim();
    if (!host || net.isIP(host) !== 0) return false;
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return false;
    }
    return ALLOWED_PUSH_HOST_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
  } catch {
    return false;
  }
}

export function decodeBase64Flexible(input: string): Buffer {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export function validateWebPushSubscriptionInput(
  sub: WebPushSubscriptionInput,
): ValidatedWebPushSubscription | null {
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint.trim() : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth.trim() : '';
  if (!endpoint || !p256dh || !auth) return null;
  if (!isAllowedWebPushEndpoint(endpoint)) return null;
  try {
    const pubBuf = decodeBase64Flexible(p256dh);
    const authBuf = decodeBase64Flexible(auth);
    if (pubBuf.length !== 65 || pubBuf[0] !== 0x04 || authBuf.length < 12) {
      return null;
    }
    return { endpoint, p256dh, auth };
  } catch {
    return null;
  }
}

export function generateVapidKeyPair(): {
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

export function buildVapidJwt(
  endpoint: string,
  privateKey: crypto.KeyObject,
): string {
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
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    })
    .toString('base64url');
  return `${unsigned}.${sig}`;
}

export function encryptWebPushPayload(
  p256dh: string,
  auth: string,
  payloadText: string,
): Buffer {
  const uaPublic = decodeBase64Flexible(p256dh);
  const authSecret = decodeBase64Flexible(auth);
  const payloadBuf = Buffer.from(payloadText, 'utf8');

  const asEcdh = crypto.createECDH('prime256v1');
  asEcdh.generateKeys();
  const asPublic = asEcdh.getPublicKey();
  const sharedSecret = asEcdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    uaPublic,
    asPublic,
  ]);
  const ikm = Buffer.from(
    crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32),
  );
  const cek = Buffer.from(
    crypto.hkdfSync(
      'sha256',
      ikm,
      salt,
      Buffer.from('Content-Encoding: aes128gcm\0', 'ascii'),
      16,
    ),
  );
  const nonce = Buffer.from(
    crypto.hkdfSync(
      'sha256',
      ikm,
      salt,
      Buffer.from('Content-Encoding: nonce\0', 'ascii'),
      12,
    ),
  );
  const padded = Buffer.concat([payloadBuf, Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(padded),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const rsBuf = Buffer.alloc(4);
  rsBuf.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    rsBuf,
    Buffer.from([asPublic.length]),
    asPublic,
    encrypted,
  ]);
}

export function buildWaiterCallPushNotification(
  payload: Record<string, unknown>,
): WebPushNotificationPayload {
  const rawTable = typeof payload.tableName === 'string' ? payload.tableName.trim() : '';
  const rawSection =
    typeof payload.sectionName === 'string' ? payload.sectionName.trim() : '';
  const tableName = rawTable ? formatTitleCase(rawTable, 'tr') : 'Masa';
  const sectionName = rawSection ? formatTitleCase(rawSection, 'tr') : 'Salon';
  const isBill = payload.requestType === 'bill';
  const actionLabel = isBill ? 'Hesap İstiyor!' : 'Garson Çağırıyor!';
  const note = typeof payload.note === 'string' ? payload.note.trim() : '';
  const callId =
    typeof payload.id === 'string' && payload.id.trim()
      ? payload.id.trim()
      : `${Date.now()}`;

  return {
    title: `🔔 ${tableName} (${sectionName}) - ${actionLabel}`,
    body: note ? `Not: ${note}` : `${tableName} masası çağrı gönderdi.`,
    tag: `waiter-call-${callId}`,
    data: { type: 'waiter-call', callId, tableId: payload.tableId },
  };
}

export function buildFraudAlertPushNotification(
  payload: Record<string, unknown>,
): WebPushNotificationPayload {
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

  return {
    title: `🚨 [${sev}] ${rawTitle}`,
    body: desc,
    tag: `corder-fraud-${alertId}`,
    data: { type: 'fraud-alert', alertId, tab: 'security' },
  };
}

export function buildPlatformPushNotification(payload: {
  id: string;
  title: string;
  message: string;
  level: string;
  targetApps: string[];
}): { appTypes: WebPushAppType[]; notification: WebPushNotificationPayload } {
  const rawApps = Array.isArray(payload.targetApps)
    ? payload.targetApps
    : ['merchant', 'boss'];
  const appTypes: WebPushAppType[] = [];
  if (rawApps.includes('terminal')) appTypes.push('terminal');
  if (rawApps.includes('merchant') || rawApps.includes('panel')) {
    appTypes.push('merchant');
  }
  if (rawApps.includes('boss')) appTypes.push('boss');

  return {
    appTypes,
    notification: {
      title: `📢 ${payload.title || 'Corder Bildirimi'}`,
      body: payload.message || '',
      tag: `corder-platform-${payload.id}`,
      data: { type: 'platform-notification', notificationId: payload.id },
    },
  };
}

