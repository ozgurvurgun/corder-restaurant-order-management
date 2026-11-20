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
  it('loads all 33 entities and 14 migrations cleanly', async () => {
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
    assert.equal(dataSource.entityMetadatas.length, 33);
    assert.equal(dataSource.migrations.length, 14);
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
    ]);
  });

  it('executes all 14 migrations up() and down() cleanly against a recording QueryRunner', async () => {
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
    assert.ok(executedQueries.length >= 90);
  });
});
