import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlatformBillingService } from '../src/platform/application/platform-billing.service';
import { RestaurantService } from '../src/platform/application/restaurant.service';
import { RestaurantEntity } from '../src/platform/domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../src/platform/domain/platform-billing-config.entity';
import { RestaurantSubscriptionPaymentEntity } from '../src/platform/domain/restaurant-subscription-payment.entity';
import { OrderStatusPolicy } from '../src/restaurant/domain/services/order-status.policy';
import { CheckSettlementPolicy } from '../src/restaurant/domain/services/check-settlement.policy';
import { CloseCheckUseCase } from '../src/restaurant/application/orders/close-check.use-case';
import { CancelOrderItemUseCase } from '../src/restaurant/application/orders/cancel-order-item.use-case';
import { OrderLedgerUseCase } from '../src/restaurant/application/orders/order-ledger.use-case';
import { TransferOrderUseCase } from '../src/restaurant/application/orders/transfer-order.use-case';
import { OrderQueryService } from '../src/restaurant/application/orders/order-query.service';
import { CompletedOrdersService } from '../src/restaurant/application/completed-orders.service';
import { LedgerService } from '../src/restaurant/application/ledger.service';
import { TableService } from '../src/restaurant/application/table.service';
import { TablesController } from '../src/restaurant/api/tables.controller';
import { TableEntity } from '../src/restaurant/domain/table.entity';
import { OrderEntity } from '../src/restaurant/domain/order.entity';
import { OrderItemEntity } from '../src/restaurant/domain/order-item.entity';
import { CashShiftEntity } from '../src/restaurant/domain/cash-shift.entity';
import { CashTransactionEntity } from '../src/restaurant/domain/cash-transaction.entity';
import { CompletedOrderEntity } from '../src/restaurant/domain/completed-order.entity';
import { LedgerCustomerEntity } from '../src/restaurant/domain/ledger-customer.entity';
import { dateToIstanbulPeriod } from '../src/platform/domain/subscription-billing.policy';

describe('CS-01: FIX-01 & FIX-19 — PlatformBillingService overdue suspension & locking', () => {
  it('skips pending restaurants during collection window and only suspends overdue restaurants with pessimistic_write lock', async () => {
    const now = new Date();
    const currentPeriod = dateToIstanbulPeriod(now);
    const pendingRest = Object.assign(new RestaurantEntity(), {
      id: 'rest-pending', name: 'Pending Cafe', status: 'active', monthlyFee: '1500',
      billingStartPeriod: currentPeriod, createdAt: now, isAccessSuspended: false,
    });
    const overdueRest = Object.assign(new RestaurantEntity(), {
      id: 'rest-overdue', name: 'Overdue Bistro', status: 'active', monthlyFee: '1500',
      billingStartPeriod: '2025-01', createdAt: new Date('2025-01-05T10:00:00Z'), isAccessSuspended: false,
    });

    const lockedEntities: string[] = [];
    const emittedExpired: string[] = [];
    const mockEm: any = {
      find: async (entity: any, opts?: any) => {
        if (entity === RestaurantEntity) {
          if (opts?.lock?.mode === 'pessimistic_write') lockedEntities.push('RestaurantEntity');
          return [pendingRest, overdueRest];
        }
        if (entity === RestaurantSubscriptionPaymentEntity) return [];
        if (entity === PlatformBillingConfigEntity) return [{ collectionStartDay: 1, collectionEndDay: 31 }];
        return [];
      },
      exists: async () => false,
      save: async (_entity: any, row: RestaurantEntity) => row,
    };
    const service = new PlatformBillingService(
      { manager: mockEm } as any, {} as any, {} as any, {} as any,
      { emitAuthExpired: (id: string) => emittedExpired.push(id) } as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );

    const res = await service.suspendAllUnpaidRestaurants();
    assert.equal(res.suspendedCount, 1);
    assert.equal(res.deferredOpenShiftCount, 0);
    assert.deepEqual(lockedEntities, ['RestaurantEntity']);
    assert.equal(pendingRest.isAccessSuspended, false);
    assert.equal(overdueRest.isAccessSuspended, true);
    assert.equal(overdueRest.billingStatus, 'suspended');
    assert.deepEqual(emittedExpired, ['rest-overdue']);
  });

  it('locks RestaurantEntity with pessimistic_write in RestaurantService.syncPersistedBillingSummary', async () => {
    let lockedRestaurantId: string | null = null;
    const rest = Object.assign(new RestaurantEntity(), {
      id: 'rest-1', status: 'active', monthlyFee: '1000', billingStartPeriod: '2026-01',
      createdAt: new Date('2026-01-01T00:00:00Z'), isAccessSuspended: false,
    });
    const mockEm: any = {
      findOne: async (entity: any, opts: any) => {
        if (entity === RestaurantEntity && opts?.lock?.mode === 'pessimistic_write') {
          lockedRestaurantId = opts.where.id;
          return rest;
        }
        return null;
      },
      find: async () => [],
      save: async (_e: any, r: any) => r,
    };
    const restaurantService = new RestaurantService(
      { manager: { transaction: async (cb: any) => cb(mockEm) } } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );
    await restaurantService.syncPersistedBillingSummary('rest-1');
    assert.equal(lockedRestaurantId, 'rest-1');
  });
});

describe('CS-01: FIX-03 — Partial check close preserves paid OrderItemEntity for unprinted kitchen tickets', () => {
  it('marks paid status as non-billable but printable for kitchen tickets', () => {
    assert.equal(OrderStatusPolicy.isItemOnActiveBill('sent'), true);
    assert.equal(OrderStatusPolicy.isItemOnActiveBill('paid'), false);
    assert.equal(OrderStatusPolicy.isItemOnActiveBill('cancelled'), false);
    assert.equal(OrderStatusPolicy.isItemOnActiveBill('ledger'), false);
    assert.equal(OrderStatusPolicy.isItemPrintableForKitchen('sent'), true);
    assert.equal(OrderStatusPolicy.isItemPrintableForKitchen('paid'), true);
    assert.equal(OrderStatusPolicy.isItemPrintableForKitchen('cancelled'), false);
    assert.equal(OrderStatusPolicy.isItemPrintableForKitchen('ledger'), false);
  });

  it('splits partial quantity into a paid row and transitions full line to paid without em.remove', async () => {
    const table = Object.assign(new TableEntity(), {
      id: 'table-1', restaurantId: 'rest-1', name: 'Masa 1', section: 'Salon',
      status: 'occupied', discount: null, splitInfo: null,
    });
    const order = Object.assign(new OrderEntity(), {
      id: 'order-1', restaurantId: 'rest-1', tableId: 'table-1', status: 'active',
      createdAt: new Date(), updatedAt: new Date(), kitchenTicketPrintedAt: null,
    });
    const item1 = Object.assign(new OrderItemEntity(), {
      id: 'item-1', orderId: 'order-1', productId: 'prod-1', productName: 'Kebab',
      price: 200, quantity: 3, status: 'sent', createdAt: new Date(),
    });
    const item2 = Object.assign(new OrderItemEntity(), {
      id: 'item-2', orderId: 'order-1', productId: 'prod-2', productName: 'Ayran',
      price: 50, quantity: 1, status: 'sent', createdAt: new Date(),
    });
    const shift = Object.assign(new CashShiftEntity(), {
      id: 'shift-1', restaurantId: 'rest-1', status: 'open', openedAt: new Date(),
      openingBalance: 0, cashIn: 0, cashOut: 0, totalRevenue: 0, totalCash: 0,
      totalCard: 0, totalMealCard: 0, totalMultinet: 0, transactionCount: 0,
    });

    const savedOrderItems: OrderItemEntity[] = [];
    let removeCalled = false;
    const mockEm: any = {
      findOne: async (entity: any) => (entity === CashShiftEntity ? shift : entity === TableEntity ? table : null),
      find: async (entity: any) => (entity === OrderEntity ? [order] : entity === OrderItemEntity ? [item1, item2] : []),
      create: (EntityCls: any, data: any) => Object.assign(new EntityCls(), data),
      save: async (entity: any, data: any) => {
        if (entity === OrderItemEntity) savedOrderItems.push(data);
        if (entity === CompletedOrderEntity) data.id = 'comp-1';
        if (entity === CashTransactionEntity) data.id = 'tx-1';
        return data;
      },
      update: async () => ({}),
      remove: async () => { removeCalled = true; },
    };

    const useCase = new CloseCheckUseCase(
      { manager: { transaction: async (cb: any) => cb(mockEm) } } as any,
      { emitTableSessionPresence: async () => {}, emitOrdersUpdated: () => {} } as any,
      {} as any, { deductRecipeIngredients: async () => [] } as any,
      new TableService({} as any, {} as any),
    );

    const res = await useCase.execute(
      'rest-1',
      { tableId: 'table-1', method: 'cash', lines: [{ itemId: 'item-1', quantity: 1 }, { itemId: 'item-2', quantity: 1 }] },
      { id: 'staff-1', name: 'Cashier', isBoss: true },
    );

    assert.equal(removeCalled, false);
    assert.equal(res.tableFullyClosed, false);
    assert.equal(item1.quantity, 2);
    assert.equal(item1.status, 'sent');
    assert.equal(item2.quantity, 1);
    assert.equal(item2.status, 'paid');
    const createdPaidSplit = savedOrderItems.find((i) => i !== item1 && i !== item2);
    assert.ok(createdPaidSplit);
    assert.equal(createdPaidSplit.quantity, 1);
    assert.equal(createdPaidSplit.status, 'paid');

    let queriedStatusFilter: any = null;
    const queryService = new OrderQueryService(
      {
        find: async (opts: any) => {
          queriedStatusFilter = opts.where.status;
          return [Object.assign(new OrderEntity(), { ...order, status: 'closed', items: [item1, createdPaidSplit, item2] })];
        },
        update: async () => ({}),
      } as any,
      { find: async () => [] } as any, { find: async () => [] } as any, { find: async () => [] } as any, {} as any,
    );
    const pendingTickets = await queryService.findPendingKitchenOrdersForPrintAgent('rest-1');
    assert.equal(pendingTickets.length, 1);
    const ticketItems = (pendingTickets[0].items as any[]) ?? [];
    assert.equal(ticketItems.reduce((sum, i) => sum + i.quantity, 0), 4);
    assert.deepEqual(queriedStatusFilter?.value, ['active', 'closed']);
  });
});

describe('CS-01: FIX-04 & FIX-45 — Canonical lock ordering & assertStaffMayUseTable enforcement', () => {
  it('acquires pessimistic_write locks in canonical order TableEntity -> OrderEntity -> OrderItemEntity -> LedgerCustomerEntity', async () => {
    const cancelLockOrder: string[] = [];
    const table = Object.assign(new TableEntity(), {
      id: 'table-1', restaurantId: 'rest-1', name: 'Masa 1', status: 'occupied',
      sessionStaffId: null, sessionLockedAt: null,
    });
    const order = Object.assign(new OrderEntity(), {
      id: 'order-1', restaurantId: 'rest-1', tableId: 'table-1', status: 'active',
    });
    const item = Object.assign(new OrderItemEntity(), {
      id: 'item-1', orderId: 'order-1', productId: 'prod-1', productName: 'Soup',
      price: 100, quantity: 1, status: 'sent',
    });

    const cancelEm: any = {
      findOne: async (entity: any, opts: any) => {
        if (opts?.lock?.mode === 'pessimistic_write') cancelLockOrder.push(entity.name);
        if (entity === TableEntity) return table;
        if (entity === OrderEntity) return order;
        if (entity === OrderItemEntity) return item;
        return null;
      },
      find: async (entity: any, opts: any) => {
        if (opts?.lock?.mode === 'pessimistic_write') cancelLockOrder.push(`${entity.name}[]`);
        return entity === OrderItemEntity ? [item] : [];
      },
      create: (Cls: any, d: any) => Object.assign(new Cls(), d),
      save: async (_e: any, d: any) => d,
      update: async () => ({}),
    };

    const cancelUseCase = new CancelOrderItemUseCase(
      { transaction: async (cb: any) => cb(cancelEm) } as any,
      { emitTableSessionPresence: async () => {}, emitOrdersUpdated: () => {}, emitPrintJob: () => {} } as any,
      { requireCurrent: async () => ({}) } as any,
      new TableService({} as any, {} as any),
      { attachCategoryIdsToItems: async () => {} } as any,
    );
    await cancelUseCase.execute('rest-1', 'item-1', 'Void', 'Waiter 1', 'staff-1', 1);
    assert.deepEqual(cancelLockOrder.slice(0, 3), ['TableEntity', 'OrderEntity', 'OrderItemEntity']);

    const ledgerLockOrder: string[] = [];
    const itemForLedger = Object.assign(new OrderItemEntity(), {
      id: 'item-2', orderId: 'order-1', productId: 'prod-1', productName: 'Soup',
      price: 100, quantity: 1, status: 'sent',
    });
    const customer = Object.assign(new LedgerCustomerEntity(), {
      id: 'cust-1', restaurantId: 'rest-1', name: 'Ali Veli',
    });
    const ledgerEm: any = {
      findOne: async (entity: any, opts: any) => {
        if (opts?.lock?.mode === 'pessimistic_write') ledgerLockOrder.push(entity.name);
        if (entity === TableEntity) return table;
        if (entity === LedgerCustomerEntity) return customer;
        if (entity === OrderEntity) return order;
        if (entity === OrderItemEntity) return itemForLedger;
        return null;
      },
      find: async (entity: any, opts: any) => {
        if (opts?.lock?.mode === 'pessimistic_write') ledgerLockOrder.push(entity.name);
        if (entity === OrderItemEntity) return [itemForLedger];
        if (entity === OrderEntity) return [order];
        return [];
      },
      save: async (_e: any, d: any) => d,
      update: async () => ({}),
    };

    const ledgerUseCase = new OrderLedgerUseCase(
      { transaction: async (cb: any) => cb(ledgerEm) } as any,
      { emitTableSessionPresence: async () => {}, emitOrdersUpdated: () => {} } as any,
      { requireCurrent: async () => ({}) } as any,
      { recordStandaloneDebt: async () => {} } as any,
      { deductRecipeIngredients: async () => [] } as any,
      new TableService({} as any, {} as any),
    );
    await ledgerUseCase.assignItemsToLedger(
      'rest-1', [{ itemId: 'item-2', quantity: 1 }], 'cust-1', 'Waiter 1', 'staff-1',
    );
    assert.deepEqual(ledgerLockOrder.slice(0, 4), [
      'TableEntity', 'OrderEntity', 'OrderItemEntity', 'LedgerCustomerEntity',
    ]);

    table.lockSession('staff-1', 'Waiter A', new Date());
    await assert.rejects(
      () => ledgerUseCase.assignItemsToLedger('rest-1', [{ itemId: 'item-2', quantity: 1 }], 'cust-1', 'Waiter B', 'staff-2'),
      (err: unknown) => err instanceof ForbiddenException,
    );
  });
});

describe('CS-01: FIX-05 — CompletedOrdersService reconciles closed shifts covering row.closedAt', () => {
  it('updates closed CashShiftEntity totals and CashTransactionEntity when editing a historical completed order', async () => {
    const closedShift = Object.assign(new CashShiftEntity(), {
      id: 'shift-closed-1', restaurantId: 'rest-1', status: 'closed',
      openedAt: new Date('2026-11-18T08:00:00Z'), closedAt: new Date('2026-11-18T22:00:00Z'),
      cashIn: 500, cashOut: 0, totalRevenue: 500, totalCash: 500,
      totalCard: 0, totalMealCard: 0, totalMultinet: 0, transactionCount: 1,
    });
    const completedOrder = Object.assign(new CompletedOrderEntity(), {
      id: 'comp-closed-1', restaurantId: 'rest-1', tableName: 'Masa 4', section: 'Salon',
      waiter: 'Waiter 1', totalAmount: 500, discountAmount: 0, netAmount: 500,
      paymentMethod: 'cash', paymentSplit: null, paymentDiscount: null, paymentTip: 0,
      openedAt: new Date('2026-11-18T19:00:00Z'), closedAt: new Date('2026-11-18T20:00:00Z'),
      ordersSnapshot: [{ id: 'ord-1', items: [{ id: 'it-1', productId: 'p-1', productName: 'Steak', price: 500, quantity: 1, status: 'served' }] }],
      paymentSnapshot: { method: 'cash', amount: 500 },
    });
    const existingCashTx = Object.assign(new CashTransactionEntity(), {
      id: 'ctx-1', restaurantId: 'rest-1', shiftId: 'shift-closed-1', type: 'sale', amount: 500, reference: 'comp-closed-1',
    });

    let removedCashTx = false;
    const mockEm: any = {
      findOne: async (entity: any) => (entity === CompletedOrderEntity ? completedOrder : entity === CashTransactionEntity ? existingCashTx : null),
      createQueryBuilder: () => ({
        setLock: function () { return this; }, where: function () { return this; },
        andWhere: function () { return this; }, orderBy: function () { return this; },
        getOne: async () => closedShift,
      }),
      create: (Cls: any, d: any) => Object.assign(new Cls(), d),
      save: async (_e: any, d: any) => d,
      remove: async (entity: any) => { if (entity === CashTransactionEntity) removedCashTx = true; },
    };

    const service = new CompletedOrdersService(
      {} as any, { transaction: async (cb: any) => cb(mockEm) } as any,
      { reconcileCompletedOrderDebtInTransaction: async () => null } as any,
      { reconcileRecipeIngredientsDelta: async () => {} } as any,
      { emitOrdersUpdated: () => {} } as any,
    );

    await service.update(
      'rest-1', 'comp-closed-1',
      { orders: completedOrder.ordersSnapshot as any, payment: { method: 'credit-card', amount: 500 } as any },
      'Manager', { isBoss: true },
    );

    assert.equal(closedShift.totalCash, 0);
    assert.equal(closedShift.cashIn, 0);
    assert.equal(closedShift.totalCard, 500);
    assert.equal(closedShift.totalRevenue, 500);
    assert.equal(removedCashTx, true);
  });
});

describe('CS-01: FIX-17, FIX-20, FIX-21 & FIX-43 — Discounts, Ledger & Table Merge', () => {
  it('enforces maxDiscountPercent on fixed-amount discounts even when maxDiscountAmount is null', () => {
    assert.throws(
      () => CheckSettlementPolicy.assertDiscountAllowedForActor(
        20000, 5000, { type: 'amount', value: 50 },
        { isBoss: false, permissions: ['discount.apply_amount'], limits: { maxDiscountPercent: 10, maxDiscountAmount: null } },
      ),
      (err: unknown) => err instanceof ForbiddenException,
    );
    assert.doesNotThrow(() =>
      CheckSettlementPolicy.assertDiscountAllowedForActor(
        20000, 2000, { type: 'amount', value: 20 },
        { isBoss: false, permissions: ['discount.apply_amount'], limits: { maxDiscountPercent: 10, maxDiscountAmount: null } },
      ),
    );
  });

  it('rejects fixed-amount discount on TablesController.update when exceeding maxDiscountPercent of table subtotal', async () => {
    const controller = new TablesController(
      { getBillableSubtotalMinorUnits: async () => 20000, update: async () => ({}) } as any,
      {} as any,
      { emitTableSessionPresence: async () => {}, emitOrdersUpdated: () => {} } as any,
    );
    await assert.rejects(
      () => controller.update(
        'table-1', 'rest-1',
        { name: 'Cashier', isBoss: false, permissions: ['discount.apply_amount'], limits: { maxDiscountPercent: 10, maxDiscountAmount: 200 } },
        { discount: { type: 'amount', value: 150, reason: 'Promo' } },
      ),
      (err: unknown) => err instanceof ForbiddenException,
    );
  });

  it('rejects ledger overpayment in LedgerService.recordPayment and excludes credited debt in findStandaloneDebtEntryForOrderItem', async () => {
    const shift = Object.assign(new CashShiftEntity(), { id: 'shift-1', restaurantId: 'rest-1', status: 'open' });
    const customer = Object.assign(new LedgerCustomerEntity(), { id: 'cust-1', restaurantId: 'rest-1', name: 'Mehmet' });
    let recordedWhereSql = '';
    const mockEm: any = {
      findOne: async (entity: any) => (entity === CashShiftEntity ? shift : entity === LedgerCustomerEntity ? customer : null),
      createQueryBuilder: () => ({
        select: function () { return this; }, addSelect: function () { return this; },
        where: function (sql: string) { recordedWhereSql += ' ' + sql; return this; },
        andWhere: function (sql: string) { recordedWhereSql += ' ' + sql; return this; },
        orderBy: function () { return this; },
        getRawOne: async () => ({ debtSum: '350.00', paySum: '50.00', creditSum: '0.00' }),
        getOne: async () => null,
      }),
    };

    const ledgerService = new LedgerService(
      {} as any, {} as any, { transaction: async (cb: any) => cb(mockEm) } as any,
    );
    await assert.rejects(
      () => ledgerService.recordPayment('rest-1', 'cust-1', 350, 'Cashier'),
      (err: unknown) => err instanceof BadRequestException,
    );

    recordedWhereSql = '';
    await ledgerService.findStandaloneDebtEntryForOrderItem(mockEm, 'rest-1', 'item-99');
    assert.ok(recordedWhereSql.includes("cr.snapshot->>'originalDebtEntryId' = e.id::text"));
  });

  it('does not copy source table discount onto an occupied target table and merges paidShares in TransferOrderUseCase.moveTable', async () => {
    const fromTable = Object.assign(new TableEntity(), {
      id: 'table-a', restaurantId: 'rest-1', name: 'Masa 1', status: 'occupied',
      discount: { type: 'percent', value: 20, reason: 'VIP' },
      splitInfo: { type: 'person', personCount: 2, paidShares: [{ shareIndex: 0, method: 'cash', amount: 100, paidAt: '2026-11-19T10:00:00Z' }] },
    });
    const toTable = Object.assign(new TableEntity(), {
      id: 'table-b', restaurantId: 'rest-1', name: 'Masa 2', status: 'occupied',
      discount: null,
      splitInfo: { type: 'person', personCount: 2, paidShares: [{ shareIndex: 0, method: 'credit-card', amount: 250, paidAt: '2026-11-19T10:05:00Z' }] },
    });

    const mockEm: any = {
      findOne: async (_e: any, opts: any) => (opts.where.id === 'table-a' ? fromTable : toTable),
      find: async () => [Object.assign(new OrderEntity(), { id: 'ord-1', items: [Object.assign(new OrderItemEntity(), { status: 'sent', price: 200, quantity: 1 })] })],
      update: async () => ({}),
      save: async (_e: any, d: any) => d,
    };

    const transferUseCase = new TransferOrderUseCase(
      { transaction: async (cb: any) => cb(mockEm) } as any,
      { emitTableSessionPresence: async () => {}, emitOrdersMoved: () => {}, emitOrdersUpdated: () => {} } as any,
      { requireCurrent: async () => ({}) } as any,
      new TableService({} as any, {} as any),
      {} as any,
    );

    await transferUseCase.moveTable('rest-1', 'table-a', 'table-b', 'staff-1');
    assert.equal(toTable.discount, null);
    assert.equal(toTable.splitInfo?.paidShares?.length, 2);
  });
});
