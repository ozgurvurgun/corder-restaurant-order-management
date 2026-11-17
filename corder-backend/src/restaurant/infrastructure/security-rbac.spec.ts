import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  BOSS_ONLY_KEY,
  PanelRootGuard,
  REQUIRED_PERMISSIONS_KEY,
} from './panel-root.guard';
import { LoginRateLimiterService } from '../../common/security/login-rate-limiter.service';
import { parseAllowedCorsOrigins } from '../../common/security/cors.config';
import { validateOriginalImageFilename } from '../../common/security/image-upload';
import {
  computeSecretFingerprint,
  isRestaurantPaymentSuspended,
} from '../domain/services/billing-suspension.policy';
import { getCurrentBillingPeriod } from '../../platform/application/restaurant.service';
import {
  resolveEffectiveLimits,
  resolveEffectivePermissions,
} from '../domain/permissions.catalog';

function buildExecutionContext(
  user: Record<string, unknown> | undefined,
  meta: { bossOnly?: boolean; requiredPermissions?: string[] } = {},
) {
  const handler = function testHandler() {};
  const cls = class TestController {};
  if (meta.bossOnly !== undefined) {
    Reflect.defineMetadata(BOSS_ONLY_KEY, meta.bossOnly, handler);
  }
  if (meta.requiredPermissions !== undefined) {
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, meta.requiredPermissions, handler);
  }
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        url: '/restaurant/roles',
        originalUrl: '/restaurant/roles',
        user,
      }),
    }),
  } as any;
}

describe('Security, RBAC & Multi-Tenancy Policies', () => {
  it('PanelRootGuard enforces strict default-deny when no explicit metadata exists', () => {
    const guard = new PanelRootGuard(new Reflector());
    const ctx = buildExecutionContext({
      role: 'staff',
      isBoss: false,
      permissions: ['staff.manage', 'order.view'],
    });
    assert.throws(() => guard.canActivate(ctx), ForbiddenException);
  });

  it('PanelRootGuard blocks non-Boss staff from @BossOnly endpoints even if they have staff.manage', () => {
    const guard = new PanelRootGuard(new Reflector());
    const staffCtx = buildExecutionContext(
      {
        role: 'staff',
        isBoss: false,
        permissions: ['staff.manage'],
      },
      { bossOnly: true },
    );
    assert.throws(() => guard.canActivate(staffCtx), ForbiddenException);

    const bossCtx = buildExecutionContext(
      {
        role: 'root',
        isBoss: true,
        permissions: [],
      },
      { bossOnly: true },
    );
    assert.equal(guard.canActivate(bossCtx), true);
  });

  it('PanelRootGuard enforces explicit @RequirePermissions on staff', () => {
    const guard = new PanelRootGuard(new Reflector());
    const deniedCtx = buildExecutionContext(
      {
        role: 'staff',
        isBoss: false,
        permissions: ['staff.manage'],
      },
      { requiredPermissions: ['roles.manage'] },
    );
    assert.throws(() => guard.canActivate(deniedCtx), ForbiddenException);

    const allowedCtx = buildExecutionContext(
      {
        role: 'staff',
        isBoss: false,
        permissions: ['roles.manage'],
      },
      { requiredPermissions: ['roles.manage'] },
    );
    assert.equal(guard.canActivate(allowedCtx), true);
  });

  it('LoginRateLimiterService enforces per-staff PIN limits and resets on success', () => {
    const limiter = new LoginRateLimiterService();
    const restId = '11111111-1111-4111-8111-111111111111';
    const staffId = '22222222-2222-4222-8222-222222222222';

    for (let i = 1; i <= 5; i++) {
      limiter.consumePinAttempt(`10.0.0.${i}`, restId, staffId);
    }
    assert.throws(
      () => limiter.consumePinAttempt('10.0.0.99', restId, staffId),
      (err: unknown) => err instanceof HttpException && err.getStatus() === 429,
    );

    limiter.resetPinAttempts('10.0.0.99', restId, staffId);
    assert.doesNotThrow(() => limiter.consumePinAttempt('10.0.0.99', restId, staffId));
  });

  it('computeSecretFingerprint produces deterministic 16-char SHA-256 digests', () => {
    assert.equal(computeSecretFingerprint(null), '');
    const fp1 = computeSecretFingerprint('$2a$10$abcdefghijklmnopqrstuv');
    const fp2 = computeSecretFingerprint('$2a$10$abcdefghijklmnopqrstuv');
    const fp3 = computeSecretFingerprint('$2a$10$differentpasswordhash00');
    assert.equal(fp1.length, 16);
    assert.equal(fp1, fp2);
    assert.notEqual(fp1, fp3);
  });

  it('isRestaurantPaymentSuspended distinguishes overdue grace from suspended', () => {
    assert.equal(
      isRestaurantPaymentSuspended({ billingStatus: 'overdue', isAccessSuspended: false }),
      false,
    );
    assert.equal(
      isRestaurantPaymentSuspended({ billingStatus: 'suspended', isAccessSuspended: false }),
      true,
    );
    assert.equal(
      isRestaurantPaymentSuspended({ billingStatus: 'pending', isAccessSuspended: true }),
      true,
    );
  });

  it('getCurrentBillingPeriod uses Europe/Istanbul timezone', () => {
    // 2026-04-30T22:30:00Z is 2026-05-01T01:30:00+03:00 in Istanbul
    const d = new Date('2026-04-30T22:30:00.000Z');
    assert.equal(getCurrentBillingPeriod(d), '2026-05');
  });

  it('parseAllowedCorsOrigins includes port 3005 in dev and strips trailing slashes', () => {
    const devOrigins = parseAllowedCorsOrigins('');
    assert.ok(devOrigins.includes('http://localhost:3005'));
    const custom = parseAllowedCorsOrigins('https://panel.corder.app/, https://boss.corder.app');
    assert.deepEqual(custom, ['https://panel.corder.app', 'https://boss.corder.app']);
  });

  it('validateOriginalImageFilename allows double dots in basename and blocks path traversal', () => {
    assert.deepEqual(validateOriginalImageFilename('burger..final.jpg'), {
      ext: '.jpg',
      expectedMime: 'image/jpeg',
    });
    assert.equal(validateOriginalImageFilename('../secret.png'), null);
    assert.equal(validateOriginalImageFilename('Vector.svg'), null);
  });

  it('resolveEffectivePermissions and resolveEffectiveLimits respect overrides and revocations', () => {
    const perms = resolveEffectivePermissions({
      isBoss: false,
      rolePermissions: ['order.view', 'order.create', 'order.cancel_item'],
      grantedPermissions: ['discount.apply_percent'],
      revokedPermissions: ['order.cancel_item'],
    });
    assert.deepEqual(perms.sort(), ['discount.apply_percent', 'order.create', 'order.view']);

    const limits = resolveEffectiveLimits({
      isBoss: false,
      roleMaxDiscountPercent: 25,
      roleMaxDiscountAmount: 500,
      userMaxDiscountPercentOverride: 10,
      userMaxDiscountAmountOverride: null,
    });
    assert.deepEqual(limits, { maxDiscountPercent: 10, maxDiscountAmount: 500 });
  });
});
