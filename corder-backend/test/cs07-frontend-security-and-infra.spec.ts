import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from '../src/restaurant/api/notifications.controller';
import { FraudAlertsController } from '../src/restaurant/api/fraud-alerts.controller';
import { FraudDetectionService } from '../src/restaurant/application/fraud-detection.service';
import { FraudAlertEntity } from '../src/restaurant/domain/fraud-alert.entity';

const backendRoot = resolve(__dirname, '..', '..');
const repoRoot = resolve(backendRoot, '..');

describe('CS-07: FIX-43 (DB-12 #1 / FE-11) — Atomic column-scoped SQL updates in NotificationsController', () => {
  it('executes atomic UPDATE restaurants SET dismissed_notification_ids = ... WHERE id = $1 in dismiss() without full-entity save', async () => {
    const executedSql: Array<{ sql: string; params: unknown[] }> = [];
    let fullEntitySaveCalled = false;
    const waiterUpdates: Array<{ criteria: unknown; partial: unknown }> = [];
    const emittedRooms: string[] = [];

    const clearedAtDate = new Date('2026-11-19T10:00:00.000Z');
    const mockRestaurantRepo: any = {
      query: async (sql: string, params: unknown[]) => {
        executedSql.push({ sql, params });
        const incoming: string[] = JSON.parse(String(params[1] ?? '[]'));
        const merged = Array.from(new Set(['existing-1', ...incoming]));
        return [
          {
            notificationsClearedAt: clearedAtDate,
            dismissedNotificationIds: merged,
          },
        ];
      },
      save: async () => {
        fullEntitySaveCalled = true;
        throw new Error('Full entity save must not be called in dismiss()');
      },
    };

    const mockWaiterCallRepo: any = {
      update: async (criteria: unknown, partial: unknown) => {
        waiterUpdates.push({ criteria, partial });
        return { affected: 1 };
      },
    };

    const controller = new NotificationsController(
      mockRestaurantRepo,
      mockWaiterCallRepo,
      {} as any,
      {
        emitNotificationsUpdated: (restId: string) => {
          emittedRooms.push(restId);
        },
      } as any,
    );

    const callUuid = '11111111-2222-4333-8444-555555555555';
    const result = await controller.dismiss(
      'rest-1',
      { role: 'root' },
      { ids: [`waiter:${callUuid}`, 'notif-stock-1', 'notif-stock-1'] },
    );

    assert.equal(fullEntitySaveCalled, false);
    assert.equal(executedSql.length, 1);
    assert.match(executedSql[0].sql, /UPDATE\s+restaurants/i);
    assert.match(executedSql[0].sql, /SET\s+dismissed_notification_ids\s*=/i);
    assert.match(executedSql[0].sql, /WHERE\s+id\s*=\s*\$1/i);
    assert.equal(executedSql[0].params[0], 'rest-1');
    assert.deepEqual(JSON.parse(String(executedSql[0].params[1])), [
      `waiter:${callUuid}`,
      'notif-stock-1',
    ]);
    assert.equal(waiterUpdates.length, 1);
    assert.deepEqual(waiterUpdates[0].partial, { acknowledged: true });
    assert.deepEqual(emittedRooms, ['rest-1']);
    assert.equal(result.ok, true);
    assert.equal(result.clearedAt, clearedAtDate.toISOString());
    assert.deepEqual(result.dismissedIds, [
      'existing-1',
      `waiter:${callUuid}`,
      'notif-stock-1',
    ]);
  });

  it('throws NotFoundException in dismiss() when atomic UPDATE matches zero restaurant rows', async () => {
    const controller = new NotificationsController(
      {
        query: async () => [],
      } as any,
      { update: async () => ({}) } as any,
      {} as any,
      { emitNotificationsUpdated: () => {} } as any,
    );

    await assert.rejects(
      () =>
        controller.dismiss(
          'missing-rest',
          { role: 'root' },
          { ids: ['notif-1'] },
        ),
      (err: unknown) => err instanceof NotFoundException,
    );
  });

  it('executes atomic UPDATE restaurants SET notifications_cleared_at = $1, dismissed_notification_ids = \'[]\'::jsonb WHERE id = $2 in clearAll() without full-entity save', async () => {
    const executedSql: Array<{ sql: string; params: unknown[] }> = [];
    let fullEntitySaveCalled = false;
    let waiterCleared = false;
    const emittedRooms: string[] = [];

    const mockRestaurantRepo: any = {
      query: async (sql: string, params: unknown[]) => {
        executedSql.push({ sql, params });
        return [{ id: params[1] }];
      },
      save: async () => {
        fullEntitySaveCalled = true;
        throw new Error('Full entity save must not be called in clearAll()');
      },
    };

    const mockWaiterCallRepo: any = {
      update: async (criteria: any, partial: any) => {
        if (
          criteria.restaurantId === 'rest-2' &&
          criteria.acknowledged === false &&
          partial.acknowledged === true
        ) {
          waiterCleared = true;
        }
        return { affected: 2 };
      },
    };

    const controller = new NotificationsController(
      mockRestaurantRepo,
      mockWaiterCallRepo,
      {} as any,
      {
        emitNotificationsUpdated: (restId: string) => {
          emittedRooms.push(restId);
        },
      } as any,
    );

    const res = await controller.clearAll('rest-2', { role: 'staff' });
    assert.equal(fullEntitySaveCalled, false);
    assert.equal(executedSql.length, 1);
    assert.match(
      executedSql[0].sql,
      /UPDATE\s+restaurants\s+SET\s+notifications_cleared_at\s*=\s*\$1,\s*dismissed_notification_ids\s*=\s*'(\[\])'::jsonb\s+WHERE\s+id\s*=\s*\$2/i,
    );
    assert.ok(executedSql[0].params[0] instanceof Date);
    assert.equal(executedSql[0].params[1], 'rest-2');
    assert.equal(waiterCleared, true);
    assert.deepEqual(emittedRooms, ['rest-2']);
    assert.equal(res.ok, true);
    assert.deepEqual(res.dismissedIds, []);
    assert.deepEqual(res.waiterCalls, []);
  });
});

describe('CS-07: FIX-52 (FE-12 / CC-05 #2) — FraudAlertsController @Query("severity") filter & scan response contract', () => {
  it('filters fraud alerts by both status and severity in FraudAlertsController.list() while keeping summary across all active alerts', async () => {
    const now = new Date('2026-11-19T15:00:00.000Z');
    const sampleAlerts: FraudAlertEntity[] = [
      Object.assign(new FraudAlertEntity(), {
        id: 'a-1',
        restaurantId: 'rest-1',
        ruleCode: 'POST_PRINT_VOID_OR_DISCOUNT',
        severity: 'critical',
        riskScore: 92,
        title: 'Critical post-print void',
        description: 'Desc 1',
        actorName: 'Ali',
        actorId: null,
        tableName: 'M1',
        amountImpact: 450,
        status: 'open',
        resolutionNote: null,
        resolvedBy: null,
        resolvedAt: null,
        evidence: { sourceKey: 'k1' },
        createdAt: now,
      }),
      Object.assign(new FraudAlertEntity(), {
        id: 'a-2',
        restaurantId: 'rest-1',
        ruleCode: 'THRESHOLD_DISCOUNT_ABUSE',
        severity: 'medium',
        riskScore: 55,
        title: 'Medium threshold discount',
        description: 'Desc 2',
        actorName: 'Veli',
        actorId: null,
        tableName: 'M2',
        amountImpact: 120,
        status: 'open',
        resolutionNote: null,
        resolvedBy: null,
        resolvedAt: null,
        evidence: { sourceKey: 'k2' },
        createdAt: now,
      }),
      Object.assign(new FraudAlertEntity(), {
        id: 'a-3',
        restaurantId: 'rest-1',
        ruleCode: 'CASH_DRAWER_DISCREPANCY',
        severity: 'critical',
        riskScore: 88,
        title: 'Resolved critical shortage',
        description: 'Desc 3',
        actorName: 'Ayse',
        actorId: null,
        tableName: null,
        amountImpact: 300,
        status: 'resolved',
        resolutionNote: 'Checked',
        resolvedBy: 'Boss',
        resolvedAt: now,
        evidence: { sourceKey: 'k3' },
        createdAt: now,
      }),
    ];

    const service = new FraudDetectionService(
      {
        find: async () => sampleAlerts,
      } as any,
      {} as any,
      { emitFraudAlert: () => {} } as any,
    );
    const controller = new FraudAlertsController(service);

    const criticalOnly = await controller.list('rest-1', 'all', 'critical');
    assert.equal(criticalOnly.alerts.length, 2);
    assert.deepEqual(
      criticalOnly.alerts.map((a) => a.id),
      ['a-1', 'a-3'],
    );
    assert.equal(criticalOnly.summary.openCount, 2);
    assert.equal(criticalOnly.summary.resolvedCount, 1);
    assert.equal(criticalOnly.summary.criticalCount, 1);
    assert.equal(criticalOnly.summary.mediumCount, 1);

    const openCritical = await controller.list('rest-1', 'open', 'critical');
    assert.equal(openCritical.alerts.length, 1);
    assert.equal(openCritical.alerts[0].id, 'a-1');
  });
});

describe('CS-07: FIX-54, FIX-55, FIX-59 — Infrastructure, Test Runner & Dead Shim Cleanup', () => {
  it('sets TRUST_PROXY default to 1 in docker-compose.yml and .env.production.example, adds backups to .dockerignore, and guards duplicate headers in deploy/nginx.conf', () => {
    const compose = readFileSync(
      join(backendRoot, 'docker-compose.yml'),
      'utf8',
    );
    assert.match(compose, /TRUST_PROXY:\s*\$\{TRUST_PROXY:-1\}/);

    const envExample = readFileSync(
      join(backendRoot, '.env.production.example'),
      'utf8',
    );
    assert.match(envExample, /TRUST_PROXY=(\$\{TRUST_PROXY:-1\}|1)/);

    const dockerignore = readFileSync(
      join(backendRoot, '.dockerignore'),
      'utf8',
    );
    assert.ok(
      dockerignore
        .split(/\r?\n/)
        .map((l) => l.trim())
        .includes('backups'),
      '.dockerignore must exclude backups directory',
    );

    const nginxConf = readFileSync(
      join(backendRoot, 'deploy', 'nginx.conf'),
      'utf8',
    );
    assert.match(nginxConf, /proxy_hide_header\s+X-Content-Type-Options;/);
    assert.match(nginxConf, /proxy_hide_header\s+X-Frame-Options;/);
    assert.match(nginxConf, /proxy_hide_header\s+Referrer-Policy;/);
  });

  it('cleans dist-test via rmSync before compiling in scripts/run-tests.mjs', () => {
    const runnerScript = readFileSync(
      join(backendRoot, 'scripts', 'run-tests.mjs'),
      'utf8',
    );
    assert.match(
      runnerScript,
      /rmSync\(distTestDir,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/,
    );
  });

  it('pins electron to ^35.1.5 in print-agent/package.json and removes dead 1-line re-export shims', () => {
    const printAgentPkg = JSON.parse(
      readFileSync(join(repoRoot, 'print-agent', 'package.json'), 'utf8'),
    );
    assert.equal(printAgentPkg.devDependencies?.electron, '^35.1.5');

    assert.equal(
      existsSync(
        join(
          repoRoot,
          'corder-admin-frontend',
          'src',
          'components',
          'DashboardLayout.tsx',
        ),
      ),
      false,
    );
    assert.equal(
      existsSync(
        join(
          repoRoot,
          'corder-boss-frontend',
          'src',
          'components',
          'dashboard-tab.tsx',
        ),
      ),
      false,
    );
    assert.equal(
      existsSync(
        join(
          repoRoot,
          'corder-panel-frontend',
          'src',
          'lib',
          'panel-api-sync.ts',
        ),
      ),
      false,
    );
  });
});

