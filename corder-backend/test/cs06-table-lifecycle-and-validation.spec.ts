import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { ArgumentMetadata, BadRequestException, ConflictException, HttpStatus, NotFoundException, ValidationPipe } from '@nestjs/common';
import { TableEntity } from '../src/restaurant/domain/table.entity';
import { TableService } from '../src/restaurant/application/table.service';
import { UpdateTableDto } from '../src/restaurant/api/dto/update-table.dto';
import { CreateOrderUseCase } from '../src/restaurant/application/orders/create-order.use-case';
import { TransferOrderUseCase } from '../src/restaurant/application/orders/transfer-order.use-case';
import { OrderLedgerUseCase } from '../src/restaurant/application/orders/order-ledger.use-case';
import { OrderEntity } from '../src/restaurant/domain/order.entity';
import { OrderItemEntity } from '../src/restaurant/domain/order-item.entity';
import { RootAdminService } from '../src/platform/application/root-admin.service';
import { PlatformSupportService } from '../src/platform/application/platform-support.service';
import { CashShiftEntity } from '../src/restaurant/domain/cash-shift.entity';
import { CategoryService } from '../src/restaurant/application/category.service';
import { ExecuteSupportActionDto } from '../src/platform/api/dto/execute-support-action.dto';
import { CreatePlatformNotificationDto } from '../src/platform/api/dto/create-platform-notification.dto';
import { CallWaiterDto } from '../src/menu/api/dto/call-waiter.dto';
import { BulkDeleteFraudAlertsDto, UpdateFraudAlertStatusDto } from '../src/restaurant/api/dto/fraud-alert.dto';
import { DismissNotificationsDto } from '../src/restaurant/api/dto/dismiss-notifications.dto';
import { SyncPrintersDto } from '../src/restaurant/api/dto/sync-printers.dto';
import { UpdateCompletedOrderDto } from '../src/restaurant/api/dto/update-completed-order.dto';
import { CreateAuditLogBodyDto } from '../src/restaurant/api/dto/create-audit-log.dto';
import { AuditLogsController } from '../src/restaurant/api/audit-logs.controller';
import { REQUIRED_PERMISSIONS_KEY } from '../src/restaurant/infrastructure/panel-root.guard';
import { mapUnhandledErrorToHttp } from '../src/common/database/http-exception.filter';
import { BossOverviewPolicy } from '../src/restaurant/domain/services/boss-overview.policy';
import { RestaurantAuthService } from '../src/restaurant/application/restaurant-auth.service';
import { NotificationsController } from '../src/restaurant/api/notifications.controller';
import { MenuQueryService } from '../src/menu/application/menu-query.service';

const strictPipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
function validateDto<T>(metatype: new () => T, value: unknown): Promise<T> {
  return strictPipe.transform(value, { type: 'body', metatype } as ArgumentMetadata) as Promise<T>;
}

describe('CS-06: Table Status Lifecycle & Atomic Auto-Heal (FIX-18, FIX-23)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
  });

  it('never auto-heals ordering/reserved tables or active session locks, and heals stale occupied/checkout tables via conditional SQL', async () => {
    const now = new Date();
    const restId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const orderingTable = Object.assign(new TableEntity(), {
      id: '11111111-1111-4111-8111-111111111111', restaurantId: restId, name: 'Masa 1', section: 'Salon', status: 'ordering',
    });
    const reservedTable = Object.assign(new TableEntity(), {
      id: '22222222-2222-4222-8222-222222222222', restaurantId: restId, name: 'Masa 2', section: 'Salon', status: 'reserved',
    });
    const lockedOccupiedTable = Object.assign(new TableEntity(), {
      id: '33333333-3333-4333-8333-333333333333', restaurantId: restId, name: 'Masa 3', section: 'Salon', status: 'occupied',
      sessionStaffId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionStaffName: 'Ali',
      sessionLockedAt: new Date(now.getTime() - 15_000),
    });
    const staleOccupiedTable = Object.assign(new TableEntity(), {
      id: '44444444-4444-4444-8444-444444444444', restaurantId: restId, name: 'Masa 4', section: 'Salon', status: 'occupied',
    });

    let saveCalled = false;
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const service = new TableService(
      {
        find: async () => [orderingTable, reservedTable, lockedOccupiedTable, staleOccupiedTable],
        save: async () => { saveCalled = true; },
        manager: {
          find: async () => [],
          query: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return []; },
        },
      } as any,
      {} as any,
    );

    const result = await service.findByRestaurant(restId);
    assert.equal(saveCalled, false);
    assert.equal(result.find((t) => t.id === orderingTable.id)?.status, 'ordering');
    assert.equal(result.find((t) => t.id === reservedTable.id)?.status, 'reserved');
    assert.equal(result.find((t) => t.id === lockedOccupiedTable.id)?.status, 'occupied');
    assert.equal(result.find((t) => t.id === staleOccupiedTable.id)?.status, 'empty');
    assert.equal(queries.length, 1);
    assert.equal(queries[0].sql.includes("t.status IN ('occupied', 'checkout')"), true);
    assert.equal(queries[0].sql.includes('NOT EXISTS'), true);
    assert.deepEqual(queries[0].params[1], [staleOccupiedTable.id]);
  });

  it('accepts reserved in UpdateTableDto and preserves reserved/ordering in TableService.update when hasBillableItems is false', async () => {
    const validated = await validateDto(UpdateTableDto, { status: 'reserved' });
    assert.equal(validated.status, 'reserved');

    const table = Object.assign(new TableEntity(), {
      id: '11111111-1111-4111-8111-111111111111',
      restaurantId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      name: 'Masa 1', section: 'Salon', status: 'empty',
    });
    const service = new TableService(
      {
        manager: {
          transaction: async (cb: (em: unknown) => Promise<unknown>) =>
            cb({
              findOne: async () => table,
              find: async () => [],
              save: async (_cls: unknown, ent: TableEntity) => ent,
            }),
        },
      } as any,
      {} as any,
    );

    const afterOrdering = await service.update(table.id, table.restaurantId, { status: 'ordering' });
    assert.equal(afterOrdering.status, 'ordering');
    const afterReserved = await service.update(table.id, table.restaurantId, { status: 'reserved' });
    assert.equal(afterReserved.status, 'reserved');
  });

  it('transitions reserved and ordering tables to occupied in CreateOrderUseCase, TransferOrderUseCase, and OrderLedgerUseCase', async () => {
    const restId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const prodId = '55555555-5555-4555-8555-555555555555';
    for (const initialStatus of ['reserved', 'ordering'] as const) {
      const lockedTable = Object.assign(new TableEntity(), {
        id: '11111111-1111-4111-8111-111111111111', restaurantId: restId, name: 'Masa 1', status: initialStatus,
      });
      const createOrderUseCase = new CreateOrderUseCase(
        {
          manager: {
            transaction: async (cb: (em: unknown) => Promise<unknown>) =>
              cb({
                findOne: async () => lockedTable,
                getRepository: (cls: unknown) => ({
                  create: (x: unknown) => x,
                  save: async (x: Record<string, unknown>) =>
                    cls === OrderEntity ? { ...x, id: 'ord-1' } : x,
                }),
                save: async (_cls: unknown, ent: unknown) => ent,
              }),
          },
        } as any,
        { findOne: async () => lockedTable } as any,
        { findOne: async () => null } as any,
        {
          find: async () => [{
            id: prodId, name: 'Kahve', price: 80, inStock: true,
            categoryId: 'cat-1', category: { restaurantId: restId },
          }],
        } as any,
        { emitOrderCreated: () => undefined, emitOrdersUpdated: () => undefined } as any,
        { requireCurrent: async () => ({ id: 'shift-1' }) } as any,
        { assertStaffMayUseTable: () => undefined } as any,
        { serializeOrderEntityById: async () => ({ id: 'ord-1', items: [] }) } as any,
      );
      await createOrderUseCase.execute(restId, {
        tableId: lockedTable.id,
        items: [{ productId: prodId, quantity: 1 }],
      });
      assert.equal(lockedTable.status, 'occupied');
    }

    const fromTable = Object.assign(new TableEntity(), {
      id: '11111111-1111-4111-8111-111111111111', restaurantId: restId, name: 'Masa 1', status: 'occupied',
    });
    const toTable = Object.assign(new TableEntity(), {
      id: '22222222-2222-4222-8222-222222222222', restaurantId: restId, name: 'Masa 2', status: 'reserved',
    });
    const transferUseCase = new TransferOrderUseCase(
      {
        transaction: async (cb: (em: unknown) => Promise<unknown>) =>
          cb({
            findOne: async (_cls: unknown, opts: { where: { id: string } }) =>
              opts.where.id === fromTable.id ? fromTable : toTable,
            find: async (_cls: unknown, opts: { where: { tableId: string } }) =>
              opts.where.tableId === fromTable.id ? [{ id: 'ord-1', items: [{ status: 'sent' }] }] : [],
            update: async () => undefined,
            save: async (_cls: unknown, ent: unknown) => ent,
          }),
      } as any,
      {
        emitTableSessionPresence: async () => undefined,
        emitOrdersMoved: () => undefined,
        emitOrdersUpdated: () => undefined,
      } as any,
      { requireCurrent: async () => ({ id: 'shift-1' }) } as any,
      { assertStaffMayUseTable: () => undefined, assertTableFreeForMergeOrMove: () => undefined } as any,
      {} as any,
    );
    await transferUseCase.moveTable(restId, fromTable.id, toTable.id);
    assert.equal(toTable.status, 'occupied');

    const revertTable = Object.assign(new TableEntity(), {
      id: '33333333-3333-4333-8333-333333333333', restaurantId: restId, name: 'Masa 3', status: 'reserved',
    });
    const ledgerItem = Object.assign(new OrderItemEntity(), {
      id: '66666666-6666-4666-8666-666666666666',
      orderId: '77777777-7777-4777-8777-777777777777',
      productId: prodId, productName: 'Çay', price: 30, quantity: 2, status: 'ledger',
    });
    const orderLedgerUseCase = new OrderLedgerUseCase(
      {
        transaction: async (cb: (em: unknown) => Promise<unknown>) =>
          cb({
            findOne: async (cls: unknown) => {
              if (cls === OrderItemEntity) return ledgerItem;
              if (cls === OrderEntity) {
                return { id: ledgerItem.orderId, tableId: revertTable.id, restaurantId: restId, status: 'active' };
              }
              if (cls === TableEntity) return revertTable;
              return null;
            },
            find: async () => [],
            save: async (_cls: unknown, ent: unknown) => ent,
            update: async () => undefined,
          }),
      } as any,
      { emitOrdersUpdated: () => undefined } as any,
      { requireCurrent: async () => ({ id: 'shift-1' }) } as any,
      {
        findStandaloneDebtEntryForOrderItem: async () => ({ id: 'debt-1', customerId: 'cust-1' }),
        recordStandaloneCredit: async () => undefined,
      } as any,
      { reverseRecipeIngredients: async () => undefined } as any,
      { assertStaffMayUseTable: () => undefined } as any,
    );
    await orderLedgerUseCase.revertLedgerOrderItem(restId, ledgerItem.id, 'Garson');
    assert.equal(revertTable.status, 'occupied');
  });
});

describe('CS-06: RootAdminService Transactions, Email Collision & Canonicalization (FIX-32)', () => {
  it('throws ConflictException on email collision in RootAdminService.create instead of hijacking existing Boss', async () => {
    let txStarted = false;
    const service = new RootAdminService(
      { findOne: async () => ({ id: 'existing-boss', email: 'boss@demo.corder.app' }) } as any,
      {} as any,
      { find: async () => [{ id: 'rest-1', slug: 'demo' }] } as any,
      {} as any,
      {} as any,
      {
        transaction: async (cb: (em: unknown) => Promise<unknown>) => {
          txStarted = true;
          return cb({});
        },
      } as any,
    );

    await assert.rejects(
      () => service.create({ name: 'Attacker', email: 'boss@demo.corder.app', password: 'password123', restaurantIds: ['rest-1'] }),
      ConflictException,
    );
    assert.equal(txStarted, true);
  });

  it('validates restaurantIds before deleting boss_restaurants links and canonicalizes terminalEmail in RootAdminService.update', async () => {
    let deleteCalled = false;
    let updatedRestaurantPayload: Record<string, unknown> | null = null;
    const bossEntity = {
      id: 'boss-1', name: 'Boss User', email: 'boss@demo.corder.app',
      bossTier: 'franchise_owner' as const, brandName: null, isActive: true,
      restaurantId: 'rest-1', createdAt: new Date(),
    };

    const serviceInvalid = new RootAdminService(
      { findOne: async () => ({ ...bossEntity }) } as any,
      { delete: async () => { deleteCalled = true; } } as any,
      { find: async () => [] } as any,
      {} as any,
      {} as any,
      { transaction: async (cb: (em: unknown) => Promise<unknown>) => cb({}) } as any,
    );

    await assert.rejects(
      () => serviceInvalid.update('boss-1', { restaurantIds: ['non-existent-id'] }),
      NotFoundException,
    );
    assert.equal(deleteCalled, false);

    const rest1 = {
      id: 'rest-1', name: 'Demo Branch', slug: 'demobranch', status: 'active',
      brandName: null, branchType: 'independent', billingStatus: 'paid',
      isAccessSuspended: false, createdAt: new Date(),
    };
    const serviceValid = new RootAdminService(
      { findOne: async () => ({ ...bossEntity }), save: async (x: unknown) => x } as any,
      { delete: async () => undefined, find: async () => [], create: (x: unknown) => x, save: async (x: unknown) => x } as any,
      {
        find: async () => [rest1],
        findOne: async ({ where }: { where: { id?: string; terminalEmail?: string } }) =>
          where.id === 'rest-1' ? rest1 : null,
        update: async (_id: string, payload: Record<string, unknown>) => { updatedRestaurantPayload = payload; },
      } as any,
      { syncActorNameChange: async () => undefined } as any,
      { emitOrdersUpdated: () => undefined } as any,
      { transaction: async (cb: (em: unknown) => Promise<unknown>) => cb({}) } as any,
    );

    await serviceValid.update('boss-1', { restaurantIds: ['rest-1'], terminalEmail: 'kasa' });
    assert.deepEqual(updatedRestaurantPayload, { terminalEmail: 'kasa@demobranch.corder.app' });
  });
});

describe('CS-06: Strict DTO Validation, No Implicit Boolean Coercion, Audit Log Lockdown & PG Error Mapping (FIX-33, FIX-44, FIX-56)', () => {
  it('validates all 6 new DTO classes and rejects invalid values or unwhitelisted properties', async () => {
    await assert.rejects(() => validateDto(ExecuteSupportActionDto, { action: 'invalid_action' }), BadRequestException);
    const validSupport = await validateDto(ExecuteSupportActionDto, { action: 'force_close_shift' });
    assert.equal(validSupport.action, 'force_close_shift');

    await assert.rejects(() => validateDto(CreatePlatformNotificationDto, { title: '', message: 'Test' }), BadRequestException);
    await assert.rejects(() => validateDto(CallWaiterDto, { tableToken: 'abc', requestType: 'invalid_type' }), BadRequestException);
    await assert.rejects(() => validateDto(UpdateFraudAlertStatusDto, { status: 'arbitrary_invalid_state' }), BadRequestException);
    await assert.rejects(() => validateDto(BulkDeleteFraudAlertsDto, { deleteAll: 'false' }), BadRequestException);
    await assert.rejects(() => validateDto(DismissNotificationsDto, { ids: [123] }), BadRequestException);
    await assert.rejects(() => validateDto(SyncPrintersDto, { printers: [{ name: 'Printer 1', port: 99999 }] }), BadRequestException);
  });

  it('enforces @IsInt() on item quantity and @IsIn() on payment split methods in UpdateCompletedOrderDto (FIX-56)', async () => {
    const basePayload = {
      orders: [{
        id: 'ord-1', tableId: 'tbl-1', userId: 'usr-1', status: 'closed',
        createdAt: '2026-11-19T10:00:00.000Z', updatedAt: '2026-11-19T10:05:00.000Z',
        items: [{
          id: 'itm-1', productId: 'prd-1', productName: 'Burger',
          price: 200, quantity: 2.5, status: 'served', createdAt: '2026-11-19T10:00:00.000Z',
        }],
      }],
      payment: {
        id: 'pay-1', tableId: 'tbl-1', tableName: 'Masa 1', orderIds: ['ord-1'],
        amount: 500, method: 'split', splitDetails: [{ method: 'cash', amount: 500 }],
        processedBy: 'Kasiyer', createdAt: '2026-11-19T10:05:00.000Z',
      },
    };
    await assert.rejects(() => validateDto(UpdateCompletedOrderDto, basePayload), BadRequestException);

    const invalidSplitPayload = {
      ...basePayload,
      orders: [{ ...basePayload.orders[0], items: [{ ...basePayload.orders[0].items[0], quantity: 2 }] }],
      payment: { ...basePayload.payment, splitDetails: [{ method: 'crypto-wallet', amount: 500 }] },
    };
    await assert.rejects(() => validateDto(UpdateCompletedOrderDto, invalidSplitPayload), BadRequestException);
  });

  it('maps PostgreSQL 22001, 22003, 23514, and 23502 to 400 Bad Request in GlobalExceptionFilter', () => {
    for (const code of ['22001', '22003', '23514', '23502']) {
      const mapped = mapUnhandledErrorToHttp({ code });
      assert.equal(mapped.status, HttpStatus.BAD_REQUEST);
      assert.equal(mapped.shouldLogStack, false);
    }
  });

  it('rejects server-reserved completed_order_updated action on POST /restaurant/audit-logs and requires write-level permissions (FIX-44)', async () => {
    await assert.rejects(
      () => validateDto(CreateAuditLogBodyDto, { action: 'completed_order_updated', category: 'payment', details: 'Spoofed' }),
      BadRequestException,
    );

    const controller = new AuditLogsController(
      { create: async (_rId: string, x: unknown) => x } as any,
      { resolveOptionalFromRequest: async () => null } as any,
    );
    await assert.rejects(
      () => controller.create({} as any, 'rest-1', { id: 'u-1', sub: 'u-1', name: 'Staff' }, { action: 'COMPLETED_ORDER_UPDATED', category: 'payment', details: 'Spoofed' }),
      BadRequestException,
    );

    const perms: string[] = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, AuditLogsController.prototype.create);
    assert.equal(perms.includes('order.view'), false);
    assert.equal(perms.includes('cash.view'), false);
    assert.equal(perms.includes('inventory.view'), false);
    assert.equal(perms.includes('reports.view_audit_logs'), false);
    assert.equal(perms.includes('order.create'), true);
  });
});

describe('CS-06: PlatformSupportService Locking & SQL Aggregates, Dead Code Removal & Europe/Istanbul Boundaries (FIX-47, FIX-50, FIX-57, FIX-58)', () => {
  it('wraps force_close_shift and release_stuck_tables in locked transactions and uses SQL aggregates in getDiagnostics', async () => {
    const locksUsed: string[] = [];
    let batchSavedTablesCount = 0;
    const openShift = Object.assign(new CashShiftEntity(), {
      id: 'shift-1', restaurantId: 'rest-1', status: 'open',
      openedBy: 'Kasiyer', openedAt: new Date(), openingBalance: 500, cashIn: 200, cashOut: 50,
    });
    const stuckTable = Object.assign(new TableEntity(), {
      id: 'tbl-1', restaurantId: 'rest-1', name: 'Masa 1', section: 'Salon',
      status: 'checkout', sessionStaffId: 'staff-1', sessionLockedAt: new Date(),
    });

    let completedOrderFindCalled = false;
    let ledgerEntryFindCalled = false;
    const supportService = new PlatformSupportService(
      {
        manager: {
          findOne: async (cls: unknown) =>
            (cls as { name?: string })?.name === 'RestaurantEntity'
              ? { id: 'rest-1', name: 'Demo', slug: 'demo', status: 'active' }
              : openShift,
          find: async (cls: unknown) => {
            const name = (cls as { name?: string })?.name;
            if (name === 'CompletedOrderEntity') completedOrderFindCalled = true;
            if (name === 'LedgerEntryEntity') ledgerEntryFindCalled = true;
            if (name === 'TableEntity') return [stuckTable];
            return [];
          },
          count: async () => 0,
          createQueryBuilder: (_cls: unknown, alias: string) => ({
            select: function () { return this; },
            addSelect: function () { return this; },
            where: function () { return this; },
            getRawOne: async () =>
              alias === 'co'
                ? { totalRevenue: '1250.50', todayRevenue: '450.25' }
                : { netReceivable: '300.00' },
          }),
        },
        transaction: async (cb: (em: unknown) => Promise<unknown>) =>
          cb({
            findOne: async (_cls: unknown, opts: { lock?: { mode?: string } }) => {
              if (opts?.lock?.mode) locksUsed.push(`shift:${opts.lock.mode}`);
              return openShift;
            },
            find: async (cls: unknown, opts?: { lock?: { mode?: string } }) => {
              const name = (cls as { name?: string })?.name;
              if (name === 'TableEntity') {
                if (opts?.lock?.mode) locksUsed.push(`tables:${opts.lock.mode}`);
                return [stuckTable];
              }
              return [];
            },
            save: async (_cls: unknown, entities: unknown) => {
              if (Array.isArray(entities)) batchSavedTablesCount = entities.length;
              return entities;
            },
          }),
      } as any,
      { serializeAlert: (a: unknown) => a } as any,
      { list: async () => [] } as any,
      { emitOrdersUpdated: () => undefined, emitTableSessionPresence: async () => undefined } as any,
    );

    const diag = await supportService.getDiagnostics('rest-1');
    assert.equal(completedOrderFindCalled, false);
    assert.equal(ledgerEntryFindCalled, false);
    assert.equal(diag.totalRevenue, 1250.5);
    assert.equal(diag.todayRevenue, 450.25);
    assert.equal(diag.ledgerSummary.totalReceivable, 300);

    await supportService.executeSupportAction('rest-1', { action: 'force_close_shift' });
    await supportService.executeSupportAction('rest-1', { action: 'release_stuck_tables' });
    assert.deepEqual(locksUsed, ['shift:pessimistic_write', 'tables:pessimistic_write']);
    assert.equal(batchSavedTablesCount, 1);
    assert.equal(stuckTable.status, 'empty');
  });

  it('batches CategoryService.reorder lookups inside a single transaction', async () => {
    let findCalls = 0;
    let findOneCalls = 0;
    const catService = new CategoryService(
      { find: async () => [] } as any,
      {
        transaction: async (cb: (em: unknown) => Promise<unknown>) =>
          cb({
            getRepository: () => ({
              find: async () => {
                findCalls += 1;
                return [
                  { id: 'c-1', restaurantId: 'r-1', parentId: null },
                  { id: 'c-2', restaurantId: 'r-1', parentId: null },
                ];
              },
              findOne: async () => { findOneCalls += 1; return null; },
            }),
            update: async () => undefined,
          }),
      } as any,
    );

    await catService.reorder('r-1', { ids: ['c-1', 'c-2'] });
    assert.equal(findCalls, 1);
    assert.equal(findOneCalls, 0);
  });

  it('removes dead methods and evaluates campaign validity & notifications with Europe/Istanbul day boundaries (FIX-57, FIX-58)', async () => {
    assert.equal('buildHourlySales' in BossOverviewPolicy, false);
    assert.equal('buildTopProductsAndStaffPerformance' in BossOverviewPolicy, false);
    assert.equal('hasOpenCashShift' in RestaurantAuthService.prototype, false);

    let capturedWaiterCallWhere: Record<string, unknown> | null = null;
    const notifController = new NotificationsController(
      { findOne: async () => ({ id: 'rest-1', notificationsClearedAt: null, dismissedNotificationIds: [] }) } as any,
      { find: async (opts: { where: Record<string, unknown> }) => { capturedWaiterCallWhere = opts.where; return []; } } as any,
      { find: async () => [] } as any,
      { emitNotificationsUpdated: () => undefined } as any,
    );
    await notifController.getState('rest-1', { role: 'root' });
    assert.notEqual(capturedWaiterCallWhere, null);

    const menuService = new MenuQueryService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    assert.equal(menuService.isCampaignCurrentlyValid('2026-11-19', new Date('2026-11-19T20:30:00.000Z')), true);
    assert.equal(menuService.isCampaignCurrentlyValid('2026-11-19', new Date('2026-11-19T21:05:00.000Z')), false);
  });
});
