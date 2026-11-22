import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { resolveDatabaseRuntimeFlags } from '../src/common/database/database.config';
import { mapUnhandledErrorToHttp } from '../src/common/database/http-exception.filter';
import { resolveTrustProxySetting } from '../src/main';
import { HealthController } from '../src/health/health.controller';
import dataSource from '../src/data-source';
import * as crypto from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WebPushService } from '../src/restaurant/application/web-push.service';
import {
  encryptWebPushPayload,
  isAllowedWebPushEndpoint,
} from '../src/restaurant/domain/services/web-push.policy';
import {
  SubscribeWebPushDto,
  UnsubscribeWebPushDto,
} from '../src/restaurant/api/dto/web-push.dto';
import { buildCompletedOrderEditLogEntry } from '../src/restaurant/domain/services/completed-order-edit-log.policy';

describe('Database runtime flags (resolveDatabaseRuntimeFlags)', () => {
  it('never enables synchronize in production even if DB_SYNCHRONIZE=true', () => {
    const flags = resolveDatabaseRuntimeFlags({
      NODE_ENV: 'production',
      DB_SYNCHRONIZE: 'true',
      SKIP_MIGRATIONS_ON_START: '',
    });
    assert.equal(flags.isProd, true);
    assert.equal(flags.synchronize, false);
    assert.equal(flags.migrationsRun, true);
  });

  it('runs migrations on startup in production by default', () => {
    const flags = resolveDatabaseRuntimeFlags({
      NODE_ENV: 'production',
    });
    assert.equal(flags.synchronize, false);
    assert.equal(flags.migrationsRun, true);
  });

  it('skips migrations on startup when SKIP_MIGRATIONS_ON_START=true', () => {
    const flags = resolveDatabaseRuntimeFlags({
      NODE_ENV: 'production',
      SKIP_MIGRATIONS_ON_START: 'true',
    });
    assert.equal(flags.synchronize, false);
    assert.equal(flags.migrationsRun, false);
  });

  it('disables migrationsRun in development when DB_SYNCHRONIZE=true to avoid DDL collision', () => {
    const flags = resolveDatabaseRuntimeFlags({
      NODE_ENV: 'development',
      DB_SYNCHRONIZE: 'true',
    });
    assert.equal(flags.synchronize, true);
    assert.equal(flags.migrationsRun, false);
  });
});

describe('GlobalExceptionFilter error mapping (mapUnhandledErrorToHttp)', () => {
  it('preserves NestJS HttpException status and structured payload', () => {
    const err = new BadRequestException({
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    });
    const res = mapUnhandledErrorToHttp(err);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    });
    assert.equal(res.shouldLogStack, false);
  });

  it('maps PostgreSQL 23505 unique_violation to 409 Conflict', () => {
    const res = mapUnhandledErrorToHttp({ code: '23505', message: 'duplicate key' });
    assert.equal(res.status, 409);
    assert.equal(res.body.statusCode, 409);
    assert.equal(res.shouldLogStack, false);
  });

  it('maps PostgreSQL 23503 foreign_key_violation and 22P02 invalid UUID to 400 Bad Request', () => {
    const fkRes = mapUnhandledErrorToHttp({ code: '23503' });
    assert.equal(fkRes.status, 400);
    const uuidRes = mapUnhandledErrorToHttp({ code: '22P02' });
    assert.equal(uuidRes.status, 400);
  });

  it('maps Express entity.too.large to 413 Payload Too Large', () => {
    const res = mapUnhandledErrorToHttp({ type: 'entity.too.large' });
    assert.equal(res.status, 413);
  });

  it('sanitizes unexpected errors into 500 without leaking internal SQL details', () => {
    const res = mapUnhandledErrorToHttp(new Error('SELECT * FROM secret_table failed'));
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, {
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    assert.equal(res.shouldLogStack, true);
  });
});

describe('resolveTrustProxySetting', () => {
  it('returns false when unset or false', () => {
    assert.equal(resolveTrustProxySetting(undefined), false);
    assert.equal(resolveTrustProxySetting(''), false);
    assert.equal(resolveTrustProxySetting('false'), false);
    assert.equal(resolveTrustProxySetting('0'), false);
  });

  it('returns true when set to "true"', () => {
    assert.equal(resolveTrustProxySetting('true'), true);
    assert.equal(resolveTrustProxySetting(' TRUE '), true);
  });

  it('returns hop count when set to a positive integer', () => {
    assert.equal(resolveTrustProxySetting('1'), 1);
    assert.equal(resolveTrustProxySetting('2'), 2);
  });
});

describe('HealthController', () => {
  it('returns ok for /health and /health/ready when database query succeeds', async () => {
    const mockDs = {
      isInitialized: true,
      query: async () => [{ '?column?': 1 }],
    } as any;
    const controller = new HealthController(mockDs);

    const health = await controller.getHealth();
    assert.equal(health.status, 'ok');
    assert.equal(health.database, 'up');

    const ready = await controller.getReadiness();
    assert.equal(ready.status, 'ok');
    assert.equal(ready.database, 'up');

    const live = controller.getLiveness();
    assert.equal(live.status, 'ok');
  });

  it('throws ServiceUnavailableException when database is uninitialized or down', async () => {
    const downDs = {
      isInitialized: true,
      query: async () => {
        throw new Error('connection refused');
      },
    } as any;
    const controller = new HealthController(downDs);
    await assert.rejects(
      () => controller.getHealth(),
      (err: unknown) => err instanceof ServiceUnavailableException,
    );
  });
});

describe('TypeORM DataSource metadata integrity', () => {
  it('loads all 35 entities and 21 migrations cleanly', async () => {
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
    assert.equal(dataSource.entityMetadatas.length, 35);
    assert.equal(dataSource.migrations.length, 21);
    const migrationNames = dataSource.migrations
      .map((m) => m.name ?? '')
      .sort((a, b) => Number(a.match(/\d+$/)?.[0] ?? 0) - Number(b.match(/\d+$/)?.[0] ?? 0));
    assert.deepEqual(migrationNames, [
      'CoreAndCatalogSchema1760000000000',
      'BillingAndInventorySchema1760000001000',
      'FranchiseHierarchyAndBillingSchema1760000002000',
      'ProductionSchemaAlignmentAndHardening1760000003000',
      'SubscriptionPeriodLedgerSchema1760000004000',
      'StandardizeCorderAppEmails1760000005000',
      'SeparateMerchantMenuContactFields1760000006000',
      'AddEnterpriseFeaturesAndFraudAlerts1760000007000',
      'AddRestaurantMenuTemplate1760000008000',
      'CreatePlatformNotificationsTable1760000009000',
      'AddStaffShiftAndRestaurantGeofence1760000010000',
      'DatabaseHardeningAndConstraints1760000011000',
      'AddOrderNumberToOrders1760000012000',
      'AddProductCaloriesAndAllergens1760000013000',
      'AddCompletedOrderEditHistory1760000014000',
      'CreateWebPushTables1760000015000',
      'AddHotPathPerformanceIndexes1760000016000',
      'AddScale10kPerformanceIndexes1760000017000',
      'AddProductShowInMenuAndBackfillCashDescriptions1760000018000',
      'BackfillCashAndLedgerDescriptionsTitleCase1760000019000',
      'AddAutoCloseShiftAndRolloverSchema1760000020000',
    ]);
  });

  it('executes all 21 migrations up() and down() cleanly against a recording QueryRunner', async () => {
    const executedQueries: string[] = [];
    const mockRunner = {
      query: async (sql: string) => {
        assert.ok(sql.trim().length > 0, 'SQL query should not be empty');
        executedQueries.push(sql);
        return [];
      },
    } as any;

    const sorted = [...dataSource.migrations].sort(
      (a, b) =>
        Number((a.name ?? '').match(/\d+$/)?.[0] ?? 0) -
        Number((b.name ?? '').match(/\d+$/)?.[0] ?? 0),
    );
    for (const migration of sorted) {
      await migration.up(mockRunner);
    }
    for (const migration of [...sorted].reverse()) {
      await migration.down(mockRunner);
    }
    assert.ok(executedQueries.length >= 95);
  });
});

describe('WebPushService, DTO validation & CompletedOrderEditLogPolicy', () => {
  it('enforces SSRF allowlist on Web Push endpoints and validates SubscribeWebPushDto & UnsubscribeWebPushDto', async () => {
    assert.equal(isAllowedWebPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
    assert.equal(isAllowedWebPushEndpoint('https://web.push.apple.com/Qxyz'), true);
    assert.equal(isAllowedWebPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
    assert.equal(isAllowedWebPushEndpoint('http://fcm.googleapis.com/fcm/send/abc'), false);
    assert.equal(isAllowedWebPushEndpoint('https://localhost:4000/restaurant/push'), false);
    assert.equal(isAllowedWebPushEndpoint('https://127.0.0.1/hook'), false);
    assert.equal(isAllowedWebPushEndpoint('https://169.254.169.254/latest/meta-data'), false);
    assert.equal(isAllowedWebPushEndpoint('https://evil.example.com/push'), false);

    const validDto = plainToInstance(SubscribeWebPushDto, {
      appType: 'terminal',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/token-1',
        keys: { p256dh: 'BOrk...key', auth: 'authSecret123456' },
      },
    });
    const validErrors = await validate(validDto);
    assert.equal(validErrors.length, 0);

    const invalidDto = plainToInstance(SubscribeWebPushDto, {
      appType: 'invalid_app',
    });
    const invalidErrors = await validate(invalidDto);
    assert.ok(invalidErrors.length > 0);

    const unsubDto = plainToInstance(UnsubscribeWebPushDto, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token-1',
    });
    assert.equal((await validate(unsubDto)).length, 0);
  });

  it('generates valid P-256 VAPID keys, encrypts RFC 8291 aes128gcm payloads, and computes post-close edit diffs', async () => {
    const svc = new WebPushService();
    const pubKey = await svc.getVapidPublicKey();
    const pubBuf = Buffer.from(pubKey, 'base64url');
    assert.equal(pubBuf.length, 65);
    assert.equal(pubBuf[0], 0x04);

    const uaEcdh = crypto.createECDH('prime256v1');
    uaEcdh.generateKeys();
    const p256dh = uaEcdh.getPublicKey().toString('base64url');
    const auth = crypto.randomBytes(16).toString('base64url');

    const savedOk = await svc.saveSubscription(
      'rest-1',
      'terminal',
      { endpoint: 'https://fcm.googleapis.com/fcm/send/test-1', keys: { p256dh, auth } },
      null,
    );
    assert.equal(savedOk, true);

    const blockedSsrf = await svc.saveSubscription(
      'rest-1',
      'terminal',
      { endpoint: 'https://127.0.0.1/internal', keys: { p256dh, auth } },
      null,
    );
    assert.equal(blockedSsrf, false);

    const encrypted = encryptWebPushPayload(p256dh, auth, '{"title":"Test"}');
    assert.ok(encrypted.length > 86);
    assert.equal(encrypted[20], 65);

    const editLog = buildCompletedOrderEditLogEntry({
      editedBy: 'şehmus y.',
      editedByUserId: 'staff-1',
      previousOrdersSnapshot: [
        {
          id: 'ord-1',
          orderNumber: '261120-001',
          items: [{ id: 'it-1', productName: 'lahmacun', price: 200, quantity: 1, status: 'served' }],
        },
      ],
      nextOrdersSnapshot: [
        {
          id: 'ord-1',
          orderNumber: '261120-001',
          items: [
            {
              id: 'it-1',
              productName: 'lahmacun',
              price: 200,
              quantity: 1,
              status: 'cancelled',
              cancelReason: 'Müşteri vazgeçti',
            },
          ],
        },
      ],
      previousTotalAmount: 200,
      nextTotalAmount: 0,
      previousDiscountAmount: 0,
      nextDiscountAmount: 0,
      previousNetAmount: 200,
      nextNetAmount: 0,
      previousMethod: 'cash',
      nextMethod: 'cash',
      previousSplit: null,
      nextSplit: null,
    });
    assert.equal(editLog.changes.some((c) => c.type === 'item_cancelled'), true);
    assert.equal(editLog.changes.some((c) => c.type === 'payment_method_changed'), false);
    assert.equal(editLog.changes.some((c) => c.type === 'net_amount_changed'), true);
  });

  it('filters product showInMenu=false on public QR menu while keeping it visible on waiter terminal and supports historical cashTransactions queries', async () => {
    const { buildMenuCategoryTree } = await import('../src/menu/domain/menu-tree.policy');
    const { CashTransactionsService } = await import('../src/restaurant/application/cash-transactions.service');

    const cat = {
      id: 'cat-1',
      restaurantId: 'rest-1',
      name: 'İçecekler',
      slug: 'icecekler',
      order: 1,
      showInMenu: true,
      showInTerminal: true,
    } as any;
    const products = [
      { id: 'p-visible', categoryId: 'cat-1', name: 'Ayran', price: 45, inStock: true, showInMenu: true, order: 1 },
      { id: 'p-hidden', categoryId: 'cat-1', name: 'Personel Çayı', price: 10, inStock: true, showInMenu: false, order: 2 },
    ] as any;

    const qrTree = buildMenuCategoryTree([cat], new Set(['cat-1']), [cat], products, false);
    assert.equal(qrTree[0].products.length, 1);
    assert.equal(qrTree[0].products[0].id, 'p-visible');

    const terminalTree = buildMenuCategoryTree([cat], new Set(['cat-1']), [cat], products, true);
    assert.equal(terminalTree[0].products.length, 2);

    const mockTxRows = [
      {
        id: 'tx-1',
        restaurantId: 'rest-1',
        shiftId: 'shift-closed-1',
        type: 'expense',
        amount: 1400,
        description: 'SEFA',
        reference: 'cash',
        createdBy: 'Şehmus Y.',
        createdAt: new Date('2026-11-20T12:00:00Z'),
      },
    ];
    const txService = new CashTransactionsService(
      {
        find: async () => mockTxRows,
      } as any,
      {
        getCurrent: async () => null,
      } as any,
    );
    const listed = await txService.listForRestaurant('rest-1', { limit: 100 });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].description, 'SEFA');
    assert.equal(listed[0].shiftId, 'shift-closed-1');
  });

  it('computes Europe/Istanbul end-of-day shift auto-close cutoff with active checkout grace and open-table rollover', async () => {
    const { ShiftAutoClosePolicy } = await import(
      '../src/restaurant/domain/services/shift-auto-close.policy'
    );

    // Shift opened Nov 20 at 15:30 Istanbul (12:30 UTC). Cutoff is 04:00 Istanbul (01:00 UTC next day).
    const openedAt = new Date('2026-11-20T12:30:00.000Z');
    const cutoff = ShiftAutoClosePolicy.computeShiftAutoCloseCutoffDate(
      openedAt,
      '04:00',
    );
    assert.equal(cutoff.toISOString(), '2026-11-21T01:00:00.000Z');

    // Before 04:00 Istanbul (00:59 UTC): not due
    const beforeCheck = ShiftAutoClosePolicy.isShiftDueForAutoClose({
      openedAt,
      autoCloseEnabled: true,
      autoCloseTime: '04:00',
      now: new Date('2026-11-21T00:59:00.000Z'),
    });
    assert.equal(beforeCheck.due, false);

    // At 04:01 Istanbul (01:01 UTC) when last transaction was 3 minutes ago (03:58 Istanbul): deferred by 15m grace
    const activeGraceCheck = ShiftAutoClosePolicy.isShiftDueForAutoClose({
      openedAt,
      autoCloseEnabled: true,
      autoCloseTime: '04:00',
      now: new Date('2026-11-21T01:01:00.000Z'),
      lastActivityAt: new Date('2026-11-21T00:58:00.000Z'),
    });
    assert.equal(activeGraceCheck.due, false);

    // At 04:20 Istanbul (01:20 UTC) when last transaction was at 03:58 Istanbul (> 15m quiet): due!
    const dueCheck = ShiftAutoClosePolicy.isShiftDueForAutoClose({
      openedAt,
      autoCloseEnabled: true,
      autoCloseTime: '04:00',
      now: new Date('2026-11-21T01:20:00.000Z'),
      lastActivityAt: new Date('2026-11-21T00:58:00.000Z'),
    });
    assert.equal(dueCheck.due, true);

    // Shift opened at 03:30 Istanbul (00:30 UTC), only 30 mins before 04:00 cutoff: next cutoff is next day 04:00!
    const lateOpen = new Date('2026-11-21T00:30:00.000Z');
    const nextDayCutoff = ShiftAutoClosePolicy.computeShiftAutoCloseCutoffDate(
      lateOpen,
      '04:00',
    );
    assert.equal(nextDayCutoff.toISOString(), '2026-11-22T01:00:00.000Z');

    const note = ShiftAutoClosePolicy.buildAutoCloseShiftNotes({
      cutoffTime: '04:00',
      carriedOverTablesCount: 2,
      carriedOverTablesAmount: 1450,
      tableNames: ['B4', 'Teras 3'],
    });
    assert.ok(note.includes('Yeni vardiyaya devreden açık masa: 2 adet (B4, Teras 3)'));

    // When openTablesCount > 0 (active late-night service), defer up to 45m of idle time after last activity
    const openTablesActiveCheck = ShiftAutoClosePolicy.isShiftDueForAutoClose({
      openedAt,
      autoCloseEnabled: true,
      autoCloseTime: '04:00',
      now: new Date('2026-11-21T01:30:00.000Z'), // 04:30 Istanbul
      lastActivityAt: new Date('2026-11-21T01:05:00.000Z'), // 04:05 Istanbul (25m ago < 45m)
      openTablesCount: 3,
    });
    assert.equal(openTablesActiveCheck.due, false);

    // Once open tables have been completely idle for > 45m past cutoff, auto-close and carry over
    const openTablesIdleDueCheck = ShiftAutoClosePolicy.isShiftDueForAutoClose({
      openedAt,
      autoCloseEnabled: true,
      autoCloseTime: '04:00',
      now: new Date('2026-11-21T02:00:00.000Z'), // 05:00 Istanbul
      lastActivityAt: new Date('2026-11-21T01:05:00.000Z'), // 04:05 Istanbul (55m ago > 45m)
      openTablesCount: 3,
    });
    assert.equal(openTablesIdleDueCheck.due, true);

    // RFC 4648 Base32 & RFC 6238 Google Authenticator TOTP verification
    const {
      decodeBase32Secret,
      computeTotpCode,
      verifyTotpCode,
    } = await import('../src/platform/application/platform-auth.service');
    const base32Secret = 'K4M7P2V5X3N6R4T7W2Z5C3F6H4J7L2Q5';
    const decoded = decodeBase32Secret(base32Secret);
    assert.ok(decoded && decoded.length === 20);
    const fixedNowMs = 1_795_340_000_000;
    const step = Math.floor(fixedNowMs / 30_000);
    const valid6Digit = computeTotpCode(decoded!, step, 6);
    assert.equal(valid6Digit.length, 6);
    assert.equal(verifyTotpCode(base32Secret, valid6Digit, fixedNowMs), true);
    assert.equal(verifyTotpCode(base32Secret, '000000', fixedNowMs), valid6Digit === '000000');
  });
});
