import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../src/platform/domain/restaurant.entity';
import { RootAdminEntity } from '../src/platform/domain/root-admin.entity';
import { PlatformNotificationEntity } from '../src/platform/domain/platform-notification.entity';
import { PrinterConfigEntity } from '../src/restaurant/domain/printer-config.entity';
import { RestaurantRoleEntity } from '../src/restaurant/domain/restaurant-role.entity';
import { RestaurantStaffEntity } from '../src/restaurant/domain/restaurant-staff.entity';
import { computeSecretFingerprint } from '../src/restaurant/domain/services/billing-suspension.policy';
import { OrdersGateway } from '../src/restaurant/api/orders.gateway';
import { PrintAgentController } from '../src/restaurant/api/print-agent.controller';
import { CategoriesController } from '../src/restaurant/api/categories.controller';
import { NotificationsController } from '../src/restaurant/api/notifications.controller';
import { PrintersService } from '../src/restaurant/application/printers.service';
import { RolesService } from '../src/restaurant/application/roles.service';
import { BossHierarchyService } from '../src/restaurant/application/boss-hierarchy.service';
import { StaffService } from '../src/restaurant/application/staff.service';
import { StaffSessionService } from '../src/restaurant/application/staff-session.service';
import { RestaurantSessionValidatorService } from '../src/restaurant/application/restaurant-session-validator.service';
import { PlatformSupportService } from '../src/platform/application/platform-support.service';

const printAgentSettingsStore = require(path.resolve(__dirname, '../../../print-agent/src/settings-store.js'));
const printAgentKitchenSplit = require(path.resolve(__dirname, '../../../print-agent/src/kitchen-split.js'));
const printAgentUiServer = require(path.resolve(__dirname, '../../../print-agent/src/ui-server.js'));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('CS-04: FIX-08 (FE-01, CC-02) — Print-Agent ↔ Backend infinite sync loop fix', () => {
  it('does not emit printers:updated unconditionally when print_agent connects to OrdersGateway', async () => {
    const emitted: Array<{ room: string; event: string }> = [];
    const registeredSockets: Array<{ restaurantId: string; socketId: string }> = [];
    const gateway = new OrdersGateway(
      {} as any, {} as any, {} as any,
      { buildSessionPresenceMap: async () => ({}) } as any,
      {
        registerAgentSocket: async (restaurantId: string, socketId: string) => {
          registeredSockets.push({ restaurantId, socketId });
        },
      } as any,
    );
    gateway.server = {
      to: (room: string) => ({ emit: (event: string) => emitted.push({ room, event }) }),
    } as any;

    const joinedRooms: string[] = [];
    await gateway.handleConnection({
      id: 'sock-pa-1',
      data: { verifiedAuth: { sub: 'rest-1', restaurantId: 'rest-1', role: 'print_agent', authType: 'print-agent-jwt', expMs: null } },
      join: (room: string) => joinedRooms.push(room), emit: () => {}, disconnect: () => {},
    } as any);

    assert.deepEqual(joinedRooms, ['restaurant:rest-1', 'restaurant:rest-1:print-agent']);
    assert.equal(registeredSockets.length, 1);
    assert.equal(emitted.some((e) => e.event === 'printers:updated'), false);
  });

  it('only emits printers:updated in PrintersService.syncFromPrintAgent when printer rows were actually inserted, updated, or deleted', async () => {
    const printerId = '11111111-1111-4111-8111-111111111111';
    let dbPrinters: PrinterConfigEntity[] = [
      Object.assign(new PrinterConfigEntity(), {
        id: printerId, restaurantId: 'rest-1', name: 'mutfak yazıcı', type: 'kitchen',
        connection: 'usb', ipAddress: 'EPSON_TM_T20II', port: null,
        department: 'mutfak', paperWidth: 80, autoCut: true, status: 'online',
      }),
    ];
    let emittedCount = 0;
    const mockGateway = { emitPrintersUpdated: () => { emittedCount += 1; } } as any;
    const mockRepo = {
      manager: {
        transaction: async (cb: any) =>
          cb({
            find: async () => dbPrinters.map((p) => Object.assign(new PrinterConfigEntity(), p)),
            create: (_cls: any, data: any) =>
              Object.assign(new PrinterConfigEntity(), { id: '22222222-2222-4222-8222-222222222222', ...data }),
            save: async (_cls: any, entity: PrinterConfigEntity) => {
              const idx = dbPrinters.findIndex((p) => p.id === entity.id);
              if (idx >= 0) dbPrinters[idx] = entity;
              else dbPrinters.push(entity);
              return entity;
            },
            remove: async (_cls: any, entity: PrinterConfigEntity) => {
              dbPrinters = dbPrinters.filter((p) => p.id !== entity.id);
            },
          }),
      },
    } as any;

    const printersService = new PrintersService(mockRepo, mockGateway);

    await printersService.syncFromPrintAgent('rest-1', {
      printers: [{
        id: printerId, name: 'Mutfak Yazıcı', mode: 'system',
        systemPrinterName: 'EPSON_TM_T20II', paperWidth: 80,
        department: 'Mutfak', autoCut: true, role: 'kitchen',
      }],
    });
    assert.equal(emittedCount, 0);

    await printersService.syncFromPrintAgent('rest-1', {
      printers: [{
        id: printerId, name: 'Ana Mutfak Yazıcı', mode: 'system',
        systemPrinterName: 'EPSON_TM_T20II', paperWidth: 80,
        department: 'Mutfak', autoCut: true, role: 'kitchen',
      }],
    });
    assert.equal(emittedCount, 1);

    await printersService.syncFromPrintAgent('rest-1', { printers: [] });
    assert.equal(emittedCount, 2);
    assert.equal(dbPrinters.length, 0);
  });
});

describe('CS-04: FIX-36 (FE-02, FE-03, CC-05 #4) — USB systemPrinterName, UUID generation & kitchen-split routing', () => {
  it('returns systemPrinterName for USB printers in PrintAgentController.getAgentContext() and preserves it in print-agent settings-store', async () => {
    const usbId = '33333333-3333-4333-8333-333333333333';
    const netId = '44444444-4444-4444-8444-444444444444';
    const controller = new PrintAgentController(
      {} as any, {} as any, {} as any,
      { findByRestaurant: async () => [] } as any,
      {
        recordAgentHttpHeartbeat: async () => false,
        list: async () => [
          {
            id: usbId, name: 'Kasa Termal', type: 'receipt', connection: 'usb',
            ipAddress: 'EPSON_TM_T20II_USB', port: null, department: 'Kasa', paperWidth: 80, autoCut: true,
          },
          {
            id: netId, name: 'Bar Ağ Yazıcı', type: 'kitchen', connection: 'network',
            ipAddress: '192.168.1.200', port: 9100, department: 'Bar', paperWidth: 80, autoCut: true,
          },
        ],
      } as any,
      { get: async () => ({ name: 'Demo Şube', address: 'İstanbul', phone: '0212' }) } as any,
      {} as any,
    );

    const ctx = await controller.getAgentContext({ printAgentRestaurantId: 'rest-1', headers: {} });
    assert.equal(ctx.printers.find((p) => p.id === usbId)?.systemPrinterName, 'EPSON_TM_T20II_USB');
    assert.equal(ctx.printers.find((p) => p.id === netId)?.systemPrinterName, null);

    const mapped = printAgentSettingsStore.mapBackendPrinters([{
      id: usbId, name: 'Kasa Termal', type: 'receipt', connection: 'usb',
      ipAddress: 'EPSON_TM_T20II_USB', systemPrinterName: null, paperWidth: 80, autoCut: true,
    }]);
    assert.equal(mapped[0].systemPrinterName, 'EPSON_TM_T20II_USB');

    const runtimeCfg = printAgentSettingsStore.buildRuntimeConfig({
      printers: mapped, categories: [], categoryRoutes: {},
    });
    assert.equal('categoryPrinterRoutes' in runtimeCfg, false);
    assert.equal('categoryNetworkRoutes' in runtimeCfg, false);
    assert.equal('managementReceiptPrinter' in runtimeCfg, false);
  });

  it('generates an RFC 4122 UUID when adding a local printer in print-agent ui-server and returns [] for unrouted kitchen items without a default printer', async () => {
    const uiServer = printAgentUiServer.createUiServer({
      store: { getPendingJobs: () => [], getRecentPrinted: () => [], clearQueue: () => {} },
      agent: { reloadConfig: () => {}, getStatus: () => ({}), flushQueue: async () => {} },
    });
    const addRes = await uiServer.dispatchApi('POST', '/api/printers', {
      name: 'Yeni USB Yazıcı', mode: 'system', systemPrinterName: 'CUPS_USB_QUEUE_1', paperWidth: 80,
    });
    assert.equal(addRes.statusCode, 200);
    assert.ok(UUID_RE.test(addRes.payload.printer.id));
    assert.equal(addRes.payload.printer.systemPrinterName, 'CUPS_USB_QUEUE_1');
    await uiServer.dispatchApi('DELETE', `/api/printers/${addRes.payload.printer.id}`);

    const emptyRuntimeConfig = {
      printers: [], printersById: {}, defaultKitchenPrinterId: '', receiptPrinterId: '',
      defaultKitchenPrinter: null, receiptPrinter: null, categoryRoutes: {},
      categoryParentMap: {}, categoriesById: {},
    };
    assert.deepEqual(
      printAgentKitchenSplit.expandKitchenPrintJobs(
        { jobId: 'job-1', items: [{ productName: 'Adana', quantity: 1, price: 320, categoryId: 'cat-1' }] },
        emptyRuntimeConfig,
      ),
      [],
    );
    assert.deepEqual(
      printAgentKitchenSplit.expandReceiptPrintJobs(
        { jobId: 'job-2', items: [{ productName: 'Adana', quantity: 1, price: 320 }] },
        emptyRuntimeConfig,
      ),
      [],
    );
  });
});

describe('CS-04: FIX-30 (BG-09, FE-08, CC-04 #3-#5) — Mandatory pwdFp/pinFp & real-time session/printer broadcasts', () => {
  it('rejects HTTP and WebSocket tokens missing pwdFp or with mismatched pwdFp (including root on WebSocket) and requires pinFp in StaffSessionService', async () => {
    const bossHash = await bcrypt.hash('BossPass!2026', 10);
    const staffHash = await bcrypt.hash('StaffPass!2026', 10);
    const pinHash = await bcrypt.hash('1234', 10);
    const boss = Object.assign(new RootAdminEntity(), {
      id: 'boss-1', email: 'boss@corder.app', name: 'Boss',
      passwordHash: bossHash, isActive: true, restaurantId: 'rest-1',
    });
    const restaurant = Object.assign(new RestaurantEntity(), {
      id: 'rest-1', name: 'Demo', slug: 'demo', status: 'active',
      isAccessSuspended: false, billingStatus: 'paid',
    });
    const staff = Object.assign(new RestaurantStaffEntity(), {
      id: 'staff-1', restaurantId: 'rest-1', name: 'Garson', email: 'garson@demo.corder.app',
      passwordHash: staffHash, pinHash, isActive: true, canAccessPanel: true,
      canAccessTerminal: true, shiftRestrictionEnabled: false,
    });

    const validator = new RestaurantSessionValidatorService(
      { findOne: async () => restaurant } as any,
      { findOne: async () => boss } as any,
      { findOne: async () => staff } as any,
      {
        resolveForStaff: async () => ({
          roleKey: 'waiter', roleLabel: 'Garson', roleColor: '#e63462',
          canAccessPanel: true, canAccessTerminal: true,
          permissions: ['order.view'], limits: { maxDiscountPercent: 10, maxDiscountAmount: 100 },
        }),
      } as any,
      {
        getBossOwnedRestaurants: async () => [restaurant],
        assertBossOwnsRestaurant: async () => restaurant,
      } as any,
    );

    const ctx = { isBossMultiBranchRoute: false, isBillingInspectionRoute: false, isOpeningNewShift: false };
    const baseBossPayload = {
      sub: 'boss-1', restaurantId: 'rest-1', slug: 'demo',
      email: 'boss@corder.app', name: 'Boss',
      type: 'restaurant' as const, role: 'root' as const,
    };

    await assert.rejects(
      () => validator.validateHttpPrincipal(baseBossPayload, ctx),
      (err: unknown) => err instanceof UnauthorizedException,
    );
    assert.equal(await validator.validateSocketTokenPayload(baseBossPayload), null);
    assert.equal(await validator.validateSocketTokenPayload({ ...baseBossPayload, pwdFp: 'stale-fp' }), null);

    const validBossWs = await validator.validateSocketTokenPayload({
      ...baseBossPayload, pwdFp: computeSecretFingerprint(bossHash),
    });
    assert.equal(validBossWs?.role, 'root');

    const staffSessionService = new StaffSessionService(
      {
        verify: (tok: string) =>
          tok === 'no-pin-fp'
            ? { typ: 'staff_session', sub: 'staff-1', restaurantId: 'rest-1', name: 'Garson', role: 'waiter' }
            : {
                typ: 'staff_session', sub: 'staff-1', restaurantId: 'rest-1',
                name: 'Garson', role: 'waiter', pinFp: computeSecretFingerprint(pinHash),
              },
      } as any,
      { get: () => 'test-jwt-secret-that-is-at-least-32-chars!!' } as any,
      { findOne: async () => staff } as any,
      { findOne: async () => restaurant } as any,
      {
        resolveForStaff: async () => ({
          roleKey: 'waiter', roleLabel: 'Garson', roleColor: '#e63462',
          canAccessPanel: true, canAccessTerminal: true,
          permissions: ['order.view'], limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
        }),
      } as any,
    );

    await assert.rejects(
      () => staffSessionService.requireFromRequest({ headers: { 'x-staff-token': 'no-pin-fp' } } as any, 'rest-1'),
      (err: unknown) => err instanceof UnauthorizedException,
    );
    const verifiedPinSession = await staffSessionService.requireFromRequest(
      { headers: { 'x-staff-token': 'valid-pin-fp' } } as any,
      'rest-1',
    );
    assert.equal(verifiedPinSession.staffId, 'staff-1');
  });

  it('emits staff:session-updated in RolesService, BossHierarchyService, PlatformSupportService, emits printers:updated in CategoriesController, and includes permissions & limits in StaffService.listTerminalUsers()', async () => {
    const staffSessionEvents: Array<{ restaurantId: string; staffId?: string }> = [];
    const printerEvents: string[] = [];
    const mockGateway = {
      emitStaffSessionUpdated: (restaurantId: string, staffId?: string) => {
        staffSessionEvents.push({ restaurantId, staffId });
      },
      emitPrintersUpdated: (restaurantId: string) => {
        printerEvents.push(restaurantId);
      },
    } as any;

    let customRole = Object.assign(new RestaurantRoleEntity(), {
      id: 'role-custom-1', restaurantId: 'rest-1', key: 'waiter', name: 'Waiter',
      color: '#e63462', isSystem: false, canAccessPanel: false, canAccessTerminal: true,
      permissions: ['order.view'], maxDiscountPercent: 5, maxDiscountAmount: '50',
    });
    const rolesService = new RolesService(
      {
        find: async () => [customRole],
        findOne: async () => customRole,
        save: async (r: any) => r,
        remove: async (r: any) => r,
        createQueryBuilder: () => ({
          insert: () => ({ into: () => ({ values: () => ({ orIgnore: () => ({ execute: async () => ({}) }) }) }) }),
        }),
        create: (d: any) => Object.assign(new RestaurantRoleEntity(), d),
      } as any,
      { count: async () => 0 } as any,
      mockGateway,
    );

    await rolesService.update('rest-1', 'waiter', { name: 'Kıdemli Garson' });
    await rolesService.reset('rest-1', 'waiter');
    customRole = Object.assign(customRole, { key: 'barista_custom', isSystem: false });
    await rolesService.remove('rest-1', 'barista_custom');
    assert.equal(staffSessionEvents.length, 3);

    const bossHierarchy = new BossHierarchyService(
      { findOne: async () => Object.assign(new RootAdminEntity(), { id: 'boss-1', isActive: true, restaurantId: 'rest-1' }) } as any,
      {} as any,
      { find: async () => [], save: async (r: any) => r, create: (d: any) => d } as any,
      {
        getBossOwnedRestaurants: async () => [
          Object.assign(new RestaurantEntity(), { id: 'rest-1' }),
          Object.assign(new RestaurantEntity(), { id: 'rest-2' }),
        ],
      } as any,
      rolesService, {} as any, mockGateway,
    );
    await bossHierarchy.syncRolesAcrossBranches('boss-1', 'rest-1', ['rest-2']);
    assert.equal(staffSessionEvents.some((e) => e.restaurantId === 'rest-2'), true);

    const targetStaff = Object.assign(new RestaurantStaffEntity(), {
      id: 'staff-99', restaurantId: 'rest-1', name: 'Kasiyer Ali', isActive: true,
    });
    const supportService = new PlatformSupportService(
      {
        manager: {
          findOne: async (cls: any) =>
            cls === RestaurantEntity ? Object.assign(new RestaurantEntity(), { id: 'rest-1' }) : targetStaff,
          save: async (_cls: any, entity: any) => entity,
        },
      } as any,
      {} as any, {} as any, mockGateway,
    );
    const beforeSupportCount = staffSessionEvents.length;
    await supportService.executeSupportAction('rest-1', {
      action: 'reset_staff_password', targetId: 'staff-99', newPassword: '5678',
    });
    await supportService.executeSupportAction('rest-1', {
      action: 'toggle_staff_active', targetId: 'staff-99',
    });
    assert.equal(staffSessionEvents.length, beforeSupportCount + 2);

    const categoriesController = new CategoriesController(
      {
        create: async () => ({ id: 'cat-1' }),
        update: async () => ({ id: 'cat-1' }),
        remove: async () => ({ ok: true }),
      } as any,
      mockGateway,
    );
    await categoriesController.create('rest-1', { name: 'Soğuk İçecekler' } as any);
    await categoriesController.update('cat-1', 'rest-1', { name: 'Sıcak İçecekler' } as any);
    await categoriesController.remove('cat-1', 'rest-1');
    assert.deepEqual(printerEvents, ['rest-1', 'rest-1', 'rest-1']);

    const staffService = new StaffService(
      {
        find: async () => [
          Object.assign(new RestaurantStaffEntity(), {
            id: 'staff-term-1', restaurantId: 'rest-1', name: 'Garson Ayşe',
            role: 'waiter', pinHash: '$2a$10$pin', isActive: true, canAccessTerminal: true,
          }),
        ],
      } as any,
      { findOne: async () => Object.assign(new RestaurantEntity(), { id: 'rest-1' }) } as any,
      {} as any,
      {
        ensureDefaultRoles: async () => [],
        resolveForStaff: async () => ({
          roleKey: 'waiter', roleLabel: 'Garson', roleColor: '#e63462',
          canAccessPanel: false, canAccessTerminal: true,
          permissions: ['order.view', 'order.create'],
          limits: { maxDiscountPercent: 15, maxDiscountAmount: 250 },
        }),
      } as any,
      mockGateway, {} as any,
    );
    const terminalUsers = await staffService.listTerminalUsers('rest-1');
    assert.equal(terminalUsers.length, 1);
    assert.deepEqual(terminalUsers[0].permissions, ['order.view', 'order.create']);
    assert.deepEqual(terminalUsers[0].limits, { maxDiscountPercent: 15, maxDiscountAmount: 250 });
  });
});

describe('CS-04: FIX-38 (FE-05..07) & FIX-48 (BG-12, CC-04 #6) — Boss multi-branch WS rooms, role-scoped broadcasts & SQL platform notification filter', () => {
  it('joins all active Boss-owned branch rooms on root WS connection and scopes fraud:alert and platform:notification strictly to :panel and :boss rooms', async () => {
    const emitted: Array<{ room: string; event: string }> = [];
    const gateway = new OrdersGateway(
      {} as any, {} as any,
      { getActiveBossRestaurantIds: async () => ['rest-1', 'rest-2', 'rest-3'] } as any,
      { buildSessionPresenceMap: async () => ({}) } as any, {} as any,
    );
    gateway.server = {
      to: (room: string) => ({ emit: (event: string) => emitted.push({ room, event }) }),
    } as any;

    const bossRooms: string[] = [];
    await gateway.handleConnection({
      id: 'sock-boss-1',
      data: { verifiedAuth: { sub: 'boss-1', restaurantId: 'rest-1', role: 'root', authType: 'jwt', expMs: null } },
      join: (r: string) => bossRooms.push(r), emit: () => {}, disconnect: () => {},
    } as any);
    assert.deepEqual(bossRooms, [
      'restaurant:rest-1', 'restaurant:rest-1:boss',
      'restaurant:rest-2', 'restaurant:rest-2:boss',
      'restaurant:rest-3', 'restaurant:rest-3:boss',
    ]);

    const staffRooms: string[] = [];
    await gateway.handleConnection({
      id: 'sock-staff-1',
      data: { verifiedAuth: { sub: 'staff-1', restaurantId: 'rest-1', role: 'staff', authType: 'jwt', expMs: null } },
      join: (r: string) => staffRooms.push(r), emit: () => {}, disconnect: () => {},
    } as any);
    assert.deepEqual(staffRooms, ['restaurant:rest-1', 'restaurant:rest-1:panel']);

    const terminalRooms: string[] = [];
    await gateway.handleConnection({
      id: 'sock-term-1',
      data: { verifiedAuth: { sub: 'rest-1', restaurantId: 'rest-1', role: 'terminal', authType: 'jwt', expMs: null } },
      join: (r: string) => terminalRooms.push(r), emit: () => {}, disconnect: () => {},
    } as any);
    assert.deepEqual(terminalRooms, ['restaurant:rest-1']);

    gateway.emitFraudAlert('rest-1', { id: 'fa-1' });
    assert.deepEqual(emitted, [
      { room: 'restaurant:rest-1:panel', event: 'fraud:alert' },
      { room: 'restaurant:rest-1:boss', event: 'fraud:alert' },
    ]);

    emitted.length = 0;
    gateway.emitPlatformNotification(['rest-1'], {
      id: 'pn-1', title: 'Boss Only', message: 'HQ', level: 'info',
      targetApps: ['boss'], targetRestaurantIds: ['rest-1'],
      sentAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });
    assert.deepEqual(emitted, [{ room: 'restaurant:rest-1:boss', event: 'platform:notification' }]);
  });

  it('filters PlatformNotificationEntity in SQL by restaurantId and targetApp in NotificationsController.getState()', async () => {
    const whereClauses: string[] = [];
    const boundParams: Record<string, unknown> = {};
    const mockQb: any = {
      where: (sql: string, params?: Record<string, unknown>) => {
        whereClauses.push(sql); Object.assign(boundParams, params); return mockQb;
      },
      andWhere: (sql: string, params?: Record<string, unknown>) => {
        whereClauses.push(sql); Object.assign(boundParams, params); return mockQb;
      },
      orderBy: () => mockQb, take: () => mockQb,
      getMany: async () => [
        Object.assign(new PlatformNotificationEntity(), {
          id: 'pn-sql-1', title: 'Panel Duyurusu', message: 'Bakım', level: 'info',
          targetApps: ['merchant'], targetRestaurantIds: ['rest-1'],
          status: 'sent', sentAt: new Date(), createdAt: new Date(),
        }),
      ],
    };

    const controller = new NotificationsController(
      { findOne: async () => Object.assign(new RestaurantEntity(), { id: 'rest-1', dismissedNotificationIds: [] }) } as any,
      { find: async () => [] } as any,
      { createQueryBuilder: () => mockQb } as any,
      { emitNotificationsUpdated: () => {} } as any,
    );

    const state = await controller.getState('rest-1', { role: 'staff' });
    assert.equal(state.platformNotifications.length, 1);
    assert.equal(boundParams.targetRestJson, JSON.stringify(['rest-1']));
    assert.equal(boundParams.targetAppJson, JSON.stringify(['merchant']));
    assert.ok(whereClauses.some((c) => c.includes('pn.target_restaurant_ids @> :targetRestJson::jsonb')));
    assert.ok(whereClauses.some((c) => c.includes('pn.target_apps @> :targetAppJson::jsonb')));
  });
});
