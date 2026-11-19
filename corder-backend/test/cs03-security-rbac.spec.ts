import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validateSync } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../src/platform/domain/restaurant.entity';
import { RootAdminEntity } from '../src/platform/domain/root-admin.entity';
import { PlatformAdminEntity } from '../src/platform/domain/platform-admin.entity';
import { RestaurantRoleEntity } from '../src/restaurant/domain/restaurant-role.entity';
import { RestaurantStaffEntity } from '../src/restaurant/domain/restaurant-staff.entity';
import { PERMISSION_KEYS } from '../src/restaurant/domain/permissions.catalog';
import {
  evaluateRestaurantGeofenceAccess,
  evaluateStaffShiftAccess,
} from '../src/restaurant/domain/services/terminal-access.policy';
import { TableQrTokenPolicy } from '../src/restaurant/domain/services/table-qr-token.policy';
import { computeSecretFingerprint } from '../src/restaurant/domain/services/billing-suspension.policy';
import { RolesService } from '../src/restaurant/application/roles.service';
import { StaffService } from '../src/restaurant/application/staff.service';
import { RestaurantAuthService } from '../src/restaurant/application/restaurant-auth.service';
import { RestaurantSessionValidatorService } from '../src/restaurant/application/restaurant-session-validator.service';
import { RestaurantSettingsService } from '../src/restaurant/application/restaurant-settings.service';
import {
  BOSS_ONLY_KEY,
  BossOnly,
  PanelRootGuard,
  REQUIRED_PERMISSIONS_KEY,
  RequirePermissions,
} from '../src/restaurant/infrastructure/panel-root.guard';
import { PrintAgentGuard } from '../src/restaurant/infrastructure/print-agent.guard';
import { RestaurantJwtStrategy } from '../src/restaurant/infrastructure/restaurant-jwt.strategy';
import { FraudAlertsController } from '../src/restaurant/api/fraud-alerts.controller';
import { RolesController } from '../src/restaurant/api/roles.controller';
import { TablesController } from '../src/restaurant/api/tables.controller';
import { OrdersController } from '../src/restaurant/api/orders.controller';
import { RestaurantMenuController } from '../src/restaurant/api/restaurant-menu.controller';
import { NotificationsController } from '../src/restaurant/api/notifications.controller';
import { UploadController } from '../src/restaurant/api/upload.controller';
import { VerifyPinDto } from '../src/restaurant/api/dto/verify-pin.dto';
import { LoginRateLimiterService } from '../src/common/security/login-rate-limiter.service';
import { PlatformAuthService } from '../src/platform/application/platform-auth.service';
import { PlatformSupportService } from '../src/platform/application/platform-support.service';

describe('CS-03: FIX-06 (BG-01) — RolesService.resolveForStaff canAccessPanel revocation', () => {
  it('immediately revokes canAccessPanel when staff.canAccessPanel is false even on a branch_manager with email and passwordHash', async () => {
    const rolesService = new RolesService({ find: async () => [] } as any, {} as any);
    const managerRole = Object.assign(new RestaurantRoleEntity(), {
      key: 'branch_manager', name: 'Branch Manager', color: '#9333ea',
      canAccessPanel: true, canAccessTerminal: true, permissions: [...PERMISSION_KEYS],
      maxDiscountPercent: 50, maxDiscountAmount: '2500',
    });
    const revokedManager = Object.assign(new RestaurantStaffEntity(), {
      id: 'staff-1', restaurantId: 'rest-1', role: 'branch_manager',
      email: 'mudur@sube.corder.app', passwordHash: '$2a$10$validhash',
      canAccessPanel: false, canAccessTerminal: true,
    });
    const resolvedRevoked = await rolesService.resolveForStaff(revokedManager, [managerRole]);
    assert.equal(resolvedRevoked.canAccessPanel, false);

    revokedManager.canAccessPanel = true;
    const resolvedActive = await rolesService.resolveForStaff(revokedManager, [managerRole]);
    assert.equal(resolvedActive.canAccessPanel, true);
  });
});

describe('CS-03: FIX-07 (BG-02) & FIX-49 (BG-18) — FraudAlertsController and UploadController RBAC', () => {
  it('restricts FraudAlertsController updateStatus, removeOne, and bulkDelete strictly to security.manage_fraud_alerts', () => {
    assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, FraudAlertsController.prototype.updateStatus), ['security.manage_fraud_alerts']);
    assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, FraudAlertsController.prototype.removeOne), ['security.manage_fraud_alerts']);
    assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, FraudAlertsController.prototype.bulkDelete), ['security.manage_fraud_alerts']);
  });

  it('grants UploadController access to system.manage_settings and hides raw R2 internal error messages', async () => {
    const uploadPerms = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UploadController);
    assert.ok(Array.isArray(uploadPerms) && uploadPerms.includes('system.manage_settings'));

    const prevDebug = process.env.UPLOAD_DEBUG;
    process.env.UPLOAD_DEBUG = 'true';
    try {
      const controller = new UploadController({
        isConfigured: () => true,
        putObject: async () => {
          const err = new Error('Secret R2 bucket key R2_SECRET_ACCESS_KEY invalid');
          err.name = 'InvalidAccessKeyId';
          throw err;
        },
      } as any);
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      await assert.rejects(
        () => controller.upload({ user: { restaurantId: 'rest-1', slug: 'demo' } } as any, { originalname: 'logo.png', buffer: pngBuffer } as any),
        (err: unknown) => err instanceof InternalServerErrorException && err.message === 'File upload failed',
      );
    } finally {
      if (prevDebug === undefined) delete process.env.UPLOAD_DEBUG;
      else process.env.UPLOAD_DEBUG = prevDebug;
    }
  });
});

describe('CS-03: FIX-24 (BG-03) — StaffService & RolesService privilege ceiling checks', () => {
  it('prevents non-Boss actors from assigning a higher role or exceeding their own permission/discount ceilings', async () => {
    const staffService = new StaffService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const cashierWithStaffManage = {
      id: 'staff-cashier', role: 'staff', isBoss: false,
      permissions: ['staff.manage', 'order.view', 'billing.close_check'] as any,
      limits: { maxDiscountPercent: 10, maxDiscountAmount: 200 },
    };
    assert.throws(
      () => staffService.assertActorCanGrantPolicies(cashierWithStaffManage, { role: 'branch_manager' }),
      (err: unknown) => err instanceof ForbiddenException,
    );

    const branchManagerActor = {
      id: 'staff-bm', role: 'staff', isBoss: false,
      permissions: [...PERMISSION_KEYS],
      limits: { maxDiscountPercent: 50, maxDiscountAmount: 2500 },
    };
    assert.throws(
      () => staffService.assertActorCanGrantPolicies(branchManagerActor, { role: 'waiter', maxDiscountPercentOverride: 75 }),
      (err: unknown) => err instanceof ForbiddenException,
    );
    assert.throws(
      () => staffService.assertActorCanGrantPolicies(branchManagerActor, { role: 'waiter', maxDiscountAmountOverride: 5000 }),
      (err: unknown) => err instanceof ForbiddenException,
    );

    const existingRole = Object.assign(new RestaurantRoleEntity(), {
      id: 'role-1', restaurantId: 'rest-1', key: 'shift_supervisor', name: 'Shift Supervisor',
      color: '#0284c7', isSystem: true, canAccessPanel: true, canAccessTerminal: true,
      permissions: ['order.view'], maxDiscountPercent: 20, maxDiscountAmount: '500',
    });
    const rolesService = new RolesService(
      {
        find: async () => [existingRole],
        findOne: async ({ where }: any) => (where?.key === 'custom_vip' ? null : existingRole),
        create: (d: any) => Object.assign(new RestaurantRoleEntity(), d),
        save: async (d: any) => d,
        createQueryBuilder: () => ({
          insert: function () { return this; },
          into: function () { return this; },
          values: function () { return this; },
          orIgnore: function () { return this; },
          execute: async () => ({}),
        }),
      } as any,
      {} as any,
    );
    const rolesController = new RolesController(rolesService);

    await assert.rejects(
      () => rolesController.create('rest-1', { name: 'Custom VIP', permissions: ['order.view'], maxDiscountPercent: 80, maxDiscountAmount: 1000 }, branchManagerActor),
      (err: unknown) => err instanceof ForbiddenException,
    );
    await assert.rejects(
      () => rolesController.update('rest-1', 'shift_supervisor', { maxDiscountAmount: null as any }, branchManagerActor),
      (err: unknown) => err instanceof ForbiddenException,
    );
    await assert.rejects(
      () => rolesController.reset('rest-1', 'shift_supervisor', cashierWithStaffManage),
      (err: unknown) => err instanceof ForbiddenException,
    );
  });
});

describe('CS-03: FIX-25 (BG-04) — Terminal x-staff-token requirement & notification clear restriction', () => {
  it('requires verified x-staff-token on TablesController, OrdersController, RestaurantMenuController, and NotificationsController for terminal role', async () => {
    let staffSessionCalls = 0;
    const mockStaffSession: any = {
      requireFromRequest: async (req: any) => {
        staffSessionCalls += 1;
        if (!req?.headers?.['x-staff-token']) throw new UnauthorizedException('Staff PIN verification is required');
        return {
          staffId: 'waiter-1', name: 'Ahmet', role: 'waiter', roleLabel: 'Waiter',
          permissions: ['order.view', 'order.create'], limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
        };
      },
    };

    const tablesController = new TablesController(
      { findByRestaurant: async () => [], buildSessionPresenceMap: async () => ({}), findOne: async () => ({ id: 't-1' }) } as any,
      mockStaffSession, {} as any,
    );
    const ordersController = new OrdersController(
      { findByRestaurant: async () => [], findOne: async () => ({ id: 'o-1' }) } as any,
      mockStaffSession,
    );
    const menuController = new RestaurantMenuController(
      { getTerminalMenuByRestaurantId: async () => ({ id: 'rest-1', categories: [] }) } as any,
      mockStaffSession,
    );
    const notificationsController = new NotificationsController(
      { findOne: async () => Object.assign(new RestaurantEntity(), { id: 'rest-1', dismissedNotificationIds: [] }), save: async (r: any) => r } as any,
      { find: async () => [], update: async () => ({}) } as any,
      { find: async () => [] } as any,
      { emitNotificationsUpdated: () => {} } as any,
      mockStaffSession,
    );

    const terminalUser: any = { id: 'rest-1', sub: 'rest-1', name: 'Terminal', role: 'terminal' };
    const reqWithoutPin: any = { headers: {} };
    const reqWithPin: any = { headers: { 'x-staff-token': 'valid-pin-jwt' } };

    await assert.rejects(() => tablesController.findAll('rest-1', terminalUser, reqWithoutPin), (e: unknown) => e instanceof UnauthorizedException);
    await assert.rejects(() => ordersController.findAll('rest-1', terminalUser, undefined, reqWithoutPin), (e: unknown) => e instanceof UnauthorizedException);
    await assert.rejects(() => menuController.getTerminalMenu('rest-1', terminalUser, reqWithoutPin), (e: unknown) => e instanceof UnauthorizedException);
    await assert.rejects(() => notificationsController.getState('rest-1', terminalUser, reqWithoutPin), (e: unknown) => e instanceof UnauthorizedException);
    await assert.rejects(() => notificationsController.clearAll('rest-1', terminalUser), (e: unknown) => e instanceof ForbiddenException);

    await tablesController.findAll('rest-1', terminalUser, reqWithPin);
    await ordersController.findAll('rest-1', terminalUser, undefined, reqWithPin);
    await menuController.getTerminalMenu('rest-1', terminalUser, reqWithPin);
    await notificationsController.getState('rest-1', terminalUser, reqWithPin);
    assert.equal(staffSessionCalls, 8);
  });
});

describe('CS-03: FIX-26 (BG-05) & FIX-27 (BG-06) — Geofence Null-Island fix & Shift cutoff fail-closed', () => {
  it('does not coerce null restaurant coordinates to (0, 0) in evaluateRestaurantGeofenceAccess and validates coordinates in RestaurantSettingsService.update', async () => {
    const nullCoordsEval = evaluateRestaurantGeofenceAccess(
      { terminalLocationRestrictionEnabled: true, locationLatitude: null, locationLongitude: null, locationRadiusMeters: 150 },
      { latitude: 41.0082, longitude: 28.9784 },
    );
    assert.equal(nullCoordsEval.allowed, true);

    const validEvalWithin = evaluateRestaurantGeofenceAccess(
      { terminalLocationRestrictionEnabled: true, locationLatitude: 41.0082, locationLongitude: 28.9784, locationRadiusMeters: 150 },
      { latitude: 41.0083, longitude: 28.9785 },
    );
    assert.equal(validEvalWithin.allowed, true);

    const validEvalOutside = evaluateRestaurantGeofenceAccess(
      { terminalLocationRestrictionEnabled: true, locationLatitude: 41.0082, locationLongitude: 28.9784, locationRadiusMeters: 100 },
      { latitude: 41.05, longitude: 29.05 },
    );
    assert.equal(validEvalOutside.allowed, false);

    const restEntity = Object.assign(new RestaurantEntity(), {
      id: 'rest-1', name: 'Demo', slug: 'demo', terminalLocationRestrictionEnabled: false,
      locationLatitude: null, locationLongitude: null, locationRadiusMeters: 150,
    });
    const settingsService = new RestaurantSettingsService(
      { findOne: async () => restEntity, save: async (r: any) => r } as any,
      {} as any, {} as any, { emitStaffSessionUpdated: () => {} } as any,
    );

    await assert.rejects(
      () => settingsService.update('rest-1', { terminalLocationRestrictionEnabled: true, locationLatitude: null, locationLongitude: null }),
      (err: unknown) => err instanceof BadRequestException,
    );
  });

  it('fails closed in evaluateStaffShiftAccess on missing or malformed shift times and enforces shift window on panel HTTP and WebSocket validation', async () => {
    assert.equal(evaluateStaffShiftAccess({ shiftRestrictionEnabled: true, shiftStartTime: '09:00:00', shiftEndTime: '17:00:00' }).allowed, false);
    assert.equal(evaluateStaffShiftAccess({ shiftRestrictionEnabled: true, shiftStartTime: null, shiftEndTime: null }).allowed, false);

    const outsideNow = new Date('2026-11-19T20:00:00.000Z');
    assert.equal(
      evaluateStaffShiftAccess({ shiftRestrictionEnabled: true, shiftStartTime: '09:00', shiftEndTime: '17:00', shiftCutoffOffsetMinutes: 0 }, outsideNow).allowed,
      false,
    );

    const pwdHash = bcrypt.hashSync('secret123', 4);
    const outOfShiftStaff = Object.assign(new RestaurantStaffEntity(), {
      id: 'staff-shift-1', restaurantId: 'rest-1', name: 'Cashier', email: 'cashier@demo.corder.app',
      passwordHash: pwdHash, role: 'cashier', isActive: true, canAccessPanel: true, canAccessTerminal: true,
      shiftRestrictionEnabled: true, shiftStartTime: 'invalid-time', shiftEndTime: '17:00',
      restaurant: Object.assign(new RestaurantEntity(), { id: 'rest-1', name: 'Demo', slug: 'demo', status: 'active', isAccessSuspended: false }),
    });

    const rolesService = {
      resolveForStaff: async () => ({
        roleKey: 'cashier', roleLabel: 'Cashier', roleColor: '#2563eb',
        canAccessPanel: true, canAccessTerminal: true, permissions: ['order.view'],
        limits: { maxDiscountPercent: 10, maxDiscountAmount: 200 },
      }),
    } as any;

    const authService = new RestaurantAuthService(
      { findOne: async () => null } as any, {} as any, { find: async () => [] } as any, {} as any,
      { find: async () => [outOfShiftStaff] } as any, rolesService, {} as any, {} as any,
    );
    await assert.rejects(
      () => authService.login({ email: 'cashier@demo.corder.app', password: 'secret123' }),
      (err: unknown) => err instanceof UnauthorizedException,
    );

    const validator = new RestaurantSessionValidatorService(
      { findOne: async () => Object.assign(new RestaurantEntity(), { id: 'rest-1', name: 'Demo', slug: 'demo', status: 'active', isAccessSuspended: false }) } as any,
      {} as any, { findOne: async () => outOfShiftStaff } as any, rolesService, authService,
    );

    const tokenPayload: any = {
      sub: 'staff-shift-1', restaurantId: 'rest-1', email: 'cashier@demo.corder.app',
      type: 'restaurant', role: 'staff', pwdFp: computeSecretFingerprint(pwdHash),
    };
    await assert.rejects(
      () => validator.validateHttpPrincipal(tokenPayload, { isBossMultiBranchRoute: false, isBillingInspectionRoute: false, isOpeningNewShift: false }),
      (err: unknown) => err instanceof UnauthorizedException,
    );
    assert.equal(await validator.validateSocketTokenPayload(tokenPayload), null);
  });
});

describe('CS-03: FIX-28 (BG-07) & FIX-29 (BG-08) — Suspended billing route access & PanelRootGuard @BossOnly()', () => {
  it('allows payment-suspended branches when ctx.isBillingInspectionRoute is true (GET /restaurant/settings/billing and GET /restaurant/auth/me)', async () => {
    const suspendedRestaurant = Object.assign(new RestaurantEntity(), {
      id: 'rest-susp', name: 'Suspended Branch', slug: 'suspended',
      status: 'active', isAccessSuspended: true, billingStatus: 'suspended',
    });
    const boss = Object.assign(new RootAdminEntity(), {
      id: 'boss-1', email: 'boss@corder.app', name: 'Boss',
      passwordHash: '$2a$10$hash', isActive: true, restaurantId: 'rest-susp',
    });

    const validator = new RestaurantSessionValidatorService(
      { findOne: async () => suspendedRestaurant } as any,
      { findOne: async () => boss } as any,
      {} as any, {} as any,
      { getBossOwnedRestaurants: async () => [suspendedRestaurant] } as any,
    );

    const payload: any = {
      sub: 'boss-1', restaurantId: 'rest-susp', email: 'boss@corder.app',
      type: 'restaurant', role: 'root', pwdFp: computeSecretFingerprint(boss.passwordHash),
    };

    await assert.rejects(
      () => validator.validateHttpPrincipal(payload, { isBossMultiBranchRoute: false, isBillingInspectionRoute: false, isOpeningNewShift: false }),
      (err: unknown) => err instanceof UnauthorizedException,
    );

    const allowedPrincipal = await validator.validateHttpPrincipal(payload, {
      isBossMultiBranchRoute: true, isBillingInspectionRoute: true, isOpeningNewShift: false,
    });
    assert.equal(allowedPrincipal.restaurantId, 'rest-susp');

    let capturedCtx: any = null;
    const strategy = Object.create(RestaurantJwtStrategy.prototype);
    strategy.sessionValidator = {
      validateHttpPrincipal: async (_p: any, ctx: any) => {
        capturedCtx = ctx;
        return allowedPrincipal;
      },
    };
    await strategy.validate({ method: 'GET', originalUrl: '/restaurant/auth/me', headers: {} } as any, payload);
    assert.equal(capturedCtx.isBillingInspectionRoute, true);
  });

  it('enforces @BossOnly() unconditionally in PanelRootGuard even when @RequirePermissions is present, and attaches PanelRootGuard to TablesController and OrdersController', () => {
    class DualDecoratedController {
      @BossOnly()
      @RequirePermissions('order.view')
      sensitiveAction() {}
    }

    const guard = new PanelRootGuard(new Reflector());
    const makeCtx = (user: any): any => ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => DualDecoratedController.prototype.sensitiveAction,
      getClass: () => DualDecoratedController,
    });

    assert.throws(
      () => guard.canActivate(makeCtx({ role: 'staff', isBoss: false, permissions: ['order.view'] })),
      (err: unknown) => err instanceof ForbiddenException && err.message.includes('Business Owner (Boss)'),
    );
    assert.equal(guard.canActivate(makeCtx({ role: 'root', isBoss: true, permissions: [] })), true);

    const tablesGuards = Reflect.getMetadata('__guards__', TablesController) ?? [];
    const ordersGuards = Reflect.getMetadata('__guards__', OrdersController) ?? [];
    assert.ok(tablesGuards.includes(PanelRootGuard));
    assert.ok(ordersGuards.includes(PanelRootGuard));
    assert.equal(Reflect.getMetadata(BOSS_ONLY_KEY, DualDecoratedController.prototype.sensitiveAction), true);
  });
});

describe('CS-03: FIX-34 (BG-16) & FIX-35 (BG-17, CC-03) — PIN Rate-Limit Isolation & Secret/Fingerprint Hardening', () => {
  it('requires VerifyPinDto.staffId as a UUID and isolates per-staff PIN lockouts while keeping a non-resetting per-IP bucket', () => {
    const missingStaffDto = Object.assign(new VerifyPinDto(), { pin: '1234' });
    assert.ok(validateSync(missingStaffDto).some((e) => e.property === 'staffId'));

    const validDto = Object.assign(new VerifyPinDto(), {
      staffId: '11111111-1111-4111-8111-111111111111', pin: '1234',
    });
    assert.equal(validateSync(validDto).length, 0);

    const limiter = new LoginRateLimiterService();
    const ip = '192.0.2.50';
    const restId = 'rest-1';
    const managerId = '11111111-1111-4111-8111-111111111111';
    const waiterId = '22222222-2222-4222-8222-222222222222';

    for (let i = 0; i < 5; i += 1) limiter.consumePinAttempt(ip, restId, managerId);
    limiter.resetPinAttempts(ip, restId, waiterId);
    assert.throws(() => limiter.consumePinAttempt(ip, restId, managerId), (err: any) => err?.status === 429);

    limiter.consumePinAttempt(ip, restId, waiterId);
    limiter.resetPinAttempts(ip, restId, waiterId);

    for (let i = 0; i < 4; i += 1) {
      limiter.consumePinAttempt(ip, restId, waiterId);
      limiter.resetPinAttempts(ip, restId, waiterId);
    }
    assert.throws(() => limiter.consumePinAttempt(ip, restId, waiterId), (err: any) => err?.status === 429);
  });

  it('hardens TableQrTokenPolicy secret resolution, PlatformAuthService timingSafeEqual, PlatformSupportService reset_staff_password, and PrintAgentGuard pwdFp', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevQrSecret = process.env.TABLE_QR_SECRET;
    const prevJwtSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.TABLE_QR_SECRET;
      delete process.env.JWT_SECRET;
      assert.throws(() => TableQrTokenPolicy.generateToken('rest-1', 'table-1'));

      process.env.TABLE_QR_SECRET = 'custom-qr-secret-key-123456';
      const token = TableQrTokenPolicy.generateToken('rest-1', 'table-1');
      assert.equal(TableQrTokenPolicy.verifyToken('rest-1', 'table-1', token), true);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevQrSecret === undefined) delete process.env.TABLE_QR_SECRET;
      else process.env.TABLE_QR_SECRET = prevQrSecret;
      if (prevJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevJwtSecret;
    }

    const prevAuthCode = process.env.PLATFORM_ADMIN_AUTH_CODE;
    process.env.PLATFORM_ADMIN_AUTH_CODE = 'super-secret-code';
    try {
      const adminRow = Object.assign(new PlatformAdminEntity(), {
        id: 'p-1', email: 'admin@corder.app', name: 'Admin', passwordHash: bcrypt.hashSync('other-pass', 4),
      });
      const platformAuth = new PlatformAuthService(
        { findOne: async () => adminRow, find: async () => [adminRow] } as any,
        { sign: () => 'jwt' } as any,
      );
      assert.equal(await platformAuth.validateAdmin('admin@corder.app', 'wrong-len'), null);
      assert.equal(await platformAuth.validateAdmin('admin@corder.app', 'super-secret-code'), adminRow);
    } finally {
      if (prevAuthCode === undefined) delete process.env.PLATFORM_ADMIN_AUTH_CODE;
      else process.env.PLATFORM_ADMIN_AUTH_CODE = prevAuthCode;
    }

    const supportService = new PlatformSupportService(
      {
        manager: {
          findOne: async (Entity: any) =>
            Entity === RestaurantEntity
              ? Object.assign(new RestaurantEntity(), { id: 'rest-1' })
              : Object.assign(new RestaurantStaffEntity(), { id: 's-1', restaurantId: 'rest-1', name: 'Ali' }),
          save: async (_e: any, row: any) => row,
        },
      } as any,
      {} as any, {} as any, {} as any,
    );
    await assert.rejects(
      () => supportService.executeSupportAction('rest-1', { action: 'reset_staff_password', targetId: 's-1', newPassword: '' }),
      (err: unknown) => err instanceof BadRequestException,
    );

    const agentHash = '$2a$10$agentpasswordhashvalue';
    const printAgentGuard = new PrintAgentGuard(
      {
        verify: (tok: string) =>
          tok === 'missing-fp'
            ? { type: 'restaurant', role: 'print_agent', restaurantId: 'rest-1', email: 'agent@demo' }
            : { type: 'restaurant', role: 'print_agent', restaurantId: 'rest-1', email: 'agent@demo', pwdFp: computeSecretFingerprint(agentHash) },
      } as any,
      { get: () => 'secret-jwt-key' } as any,
      {} as any,
      {
        findOne: async () =>
          Object.assign(new RestaurantEntity(), {
            id: 'rest-1', status: 'active', isAccessSuspended: false,
            printAgentUsername: 'agent@demo', printAgentPasswordHash: agentHash,
          }),
      } as any,
    );

    const makeAgentCtx = (token: string): any => ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }),
    });
    await assert.rejects(() => printAgentGuard.canActivate(makeAgentCtx('missing-fp')), (e: unknown) => e instanceof UnauthorizedException);
    assert.equal(await printAgentGuard.canActivate(makeAgentCtx('valid-fp')), true);
  });
});
