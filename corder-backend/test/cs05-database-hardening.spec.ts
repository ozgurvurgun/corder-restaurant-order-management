import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import dataSource from '../src/data-source';
import {
  numericColumnTransformer,
} from '../src/common/database/numeric-column.transformer';
import { AddEnterpriseFeaturesAndFraudAlerts1760000007000 } from '../src/migrations/1760000007000-AddEnterpriseFeaturesAndFraudAlerts';
import { CreatePlatformNotificationsTable1760000009000 } from '../src/migrations/1760000009000-CreatePlatformNotificationsTable';
import { DatabaseHardeningAndConstraints1760000011000 } from '../src/migrations/1760000011000-DatabaseHardeningAndConstraints';
import { StockMaterialEntity } from '../src/restaurant/domain/stock-material.entity';
import { TableService } from '../src/restaurant/application/table.service';
import {
  FraudRulesPolicy,
  toIstanbulDayKey,
} from '../src/restaurant/domain/services/fraud-rules.policy';
import { FraudDetectionService } from '../src/restaurant/application/fraud-detection.service';
import { FraudAlertsController } from '../src/restaurant/api/fraud-alerts.controller';
import { ActorNameSyncService } from '../src/common/text/actor-name-sync.service';
import { BossOverviewDetailsPolicy } from '../src/restaurant/domain/services/boss-overview-details.policy';
import { OrderQueryService } from '../src/restaurant/application/orders/order-query.service';
import { StockMovementsService } from '../src/restaurant/application/stock-movements.service';

describe('CS-05: Migrations 1760000007000, 1760000009000 & 1760000011000 (FIX-11..16, FIX-39..41)', () => {
  it('prepends uuid-ossp extension creation in 1760000007000 and 1760000009000', async () => {
    const q7: string[] = [];
    const q9: string[] = [];
    await new AddEnterpriseFeaturesAndFraudAlerts1760000007000().up({
      query: async (sql: string) => {
        q7.push(sql);
        return [];
      },
    } as any);
    await new CreatePlatformNotificationsTable1760000009000().up({
      query: async (sql: string) => {
        q9.push(sql);
        return [];
      },
    } as any);

    assert.match(q7[0], /CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/);
    assert.match(q9[0], /CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/);
  });

  it('executes DatabaseHardeningAndConstraints1760000011000 up() and down() with all constraints, FKs, and indexes', async () => {
    const upSql: string[] = [];
    const downSql: string[] = [];
    const migration = new DatabaseHardeningAndConstraints1760000011000();

    await migration.up({
      query: async (sql: string) => {
        upSql.push(sql);
        return [];
      },
    } as any);

    await migration.down({
      query: async (sql: string) => {
        downSql.push(sql);
        return [];
      },
    } as any);

    const joinedUp = upSql.join('\n');
    assert.match(joinedUp, /UQ_inventory_counts_one_in_progress_per_restaurant/);
    assert.match(joinedUp, /FK_waiter_calls_table/);
    assert.match(joinedUp, /IDX_waiter_calls_restaurant_table_created/);
    assert.match(joinedUp, /IDX_waiter_calls_restaurant_ack_created/);
    assert.match(joinedUp, /UQ_restaurant_staff_email/);
    assert.match(joinedUp, /UQ_fraud_alerts_restaurant_source_key/);
    assert.match(joinedUp, /FK_purchase_orders_supplier[\s\S]*ON DELETE SET NULL/);
    assert.match(joinedUp, /FK_stock_movements_material[\s\S]*ON DELETE SET NULL/);
    assert.match(joinedUp, /FK_orders_table[\s\S]*ON DELETE SET NULL/);
    assert.match(joinedUp, /CHK_products_price_non_negative/);
    assert.match(joinedUp, /CHK_order_items_price_quantity/);
    assert.match(joinedUp, /CHK_completed_orders_amounts_non_negative/);
    assert.match(joinedUp, /CHK_cash_transactions_amount_non_negative/);
    assert.match(joinedUp, /CHK_ledger_entries_amount_non_negative/);
    assert.match(joinedUp, /CHK_open_accounts_amounts_non_negative/);
    assert.match(joinedUp, /CHK_stock_materials_non_negative/);
    assert.match(joinedUp, /CHK_restaurants_billing_bounds/);
    assert.match(joinedUp, /CHK_platform_billing_configs_days/);
    assert.match(joinedUp, /IDX_order_items_order_status/);
    assert.match(joinedUp, /IDX_cash_transactions_restaurant_created/);
    assert.match(joinedUp, /IDX_cash_transactions_shift_created/);
    assert.match(joinedUp, /IDX_audit_logs_restaurant_category_created/);
    assert.match(joinedUp, /IDX_products_category_order/);
    assert.match(joinedUp, /IDX_categories_restaurant_order/);
    assert.ok(downSql.length >= 25);
  });
});

describe('CS-05: StockMaterialEntity.applyDelta clamping & TableService.remove guard (FIX-16, FIX-39)', () => {
  it('clamps StockMaterialEntity.applyDelta at 0 when deduction exceeds currentStock', () => {
    const mat = new StockMaterialEntity();
    mat.currentStock = 2.5;
    const res = mat.applyDelta(-5);
    assert.equal(res.previousStock, 2.5);
    assert.equal(res.newStock, 0);
    assert.equal(mat.currentStock, 0);
  });

  it('rejects TableService.remove when active orders exist on the table', async () => {
    const mockEm = {
      findOne: async () => ({ id: 'tbl-1', restaurantId: 'rest-1', status: 'occupied' }),
      find: async () => [
        { id: 'ord-1', restaurantId: 'rest-1', tableId: 'tbl-1', status: 'active', items: [{ status: 'paid' }] },
      ],
      remove: async () => {
        throw new Error('remove should not be called');
      },
    };
    const service = new TableService(
      {
        manager: {
          transaction: async (cb: any) => cb(mockEm),
        },
      } as any,
      {} as any,
    );

    await assert.rejects(
      () => service.remove('tbl-1', 'rest-1'),
      (err: unknown) => err instanceof BadRequestException,
    );
  });
});

describe('CS-05: FraudRulesPolicy per-Istanbul-day void grouping & decoupled GET scans (FIX-13)', () => {
  it('groups EXCESSIVE_VOID_PATTERN by Europe/Istanbul cancellation day instead of summing 14 days into today', () => {
    const tables = [{ id: 't1', name: 'Masa 1' }] as any[];
    const orders = [
      { id: 'o1', tableId: 't1', userId: null, userDisplayName: 'Ahmet', createdAt: new Date('2026-11-10T10:00:00Z') },
    ] as any[];

    // 4 single voids on 4 distinct Istanbul days (each 100 TL < 750 TL, count 1 < 3) -> 0 excessive void alerts
    const spreadItems = [
      { id: 'i1', orderId: 'o1', status: 'cancelled', productName: 'P1', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-10T12:00:00Z') },
      { id: 'i2', orderId: 'o1', status: 'cancelled', productName: 'P2', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-11T12:00:00Z') },
      { id: 'i3', orderId: 'o1', status: 'cancelled', productName: 'P3', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-12T12:00:00Z') },
      { id: 'i4', orderId: 'o1', status: 'cancelled', productName: 'P4', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-13T12:00:00Z') },
    ] as any[];

    const spreadAlerts = FraudRulesPolicy.evaluateAnomalies({
      restaurantId: 'rest-1',
      tables,
      orders,
      orderItems: spreadItems,
      completedOrders: [],
      shifts: [],
      cashTxs: [],
      printJobs: [],
      audits: [],
    });
    assert.equal(
      spreadAlerts.filter((a) => a.ruleCode === 'EXCESSIVE_VOID_PATTERN').length,
      0,
    );

    // 3 voids on the same Europe/Istanbul calendar day (2026-11-15 in UTC+3: 2026-11-14T22:30Z is 01:30 Istanbul on Nov 15)
    const sameIstanbulDayItems = [
      { id: 'i5', orderId: 'o1', status: 'cancelled', productName: 'P5', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-14T22:30:00Z') },
      { id: 'i6', orderId: 'o1', status: 'cancelled', productName: 'P6', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-15T08:00:00Z') },
      { id: 'i7', orderId: 'o1', status: 'cancelled', productName: 'P7', price: 100, quantity: 1, cancelledBy: 'Ahmet', cancelledAt: new Date('2026-11-15T19:00:00Z') },
    ] as any[];

    assert.equal(toIstanbulDayKey(new Date('2026-11-14T22:30:00Z')), '2026-11-15');

    const dayAlerts = FraudRulesPolicy.evaluateAnomalies({
      restaurantId: 'rest-1',
      tables,
      orders,
      orderItems: sameIstanbulDayItems,
      completedOrders: [],
      shifts: [],
      cashTxs: [],
      printJobs: [],
      audits: [],
    });
    const voidAlerts = dayAlerts.filter((a) => a.ruleCode === 'EXCESSIVE_VOID_PATTERN');
    assert.equal(voidAlerts.length, 1);
    assert.equal(voidAlerts[0].sourceKey, 'excessive-void:ahmet:2026-11-15');
  });

  it('does not trigger analyzeRestaurantAnomalies on read-only listForRestaurant / listForBranches / controller list', async () => {
    let scanCalls = 0;
    const mockRepo = {
      find: async () => [],
      create: (x: any) => x,
      save: async () => {
        const err: any = new Error('duplicate key');
        err.code = '23505';
        throw err;
      },
    };
    const service = new FraudDetectionService(
      mockRepo as any,
      {} as any,
      { emitFraudAlert: () => undefined } as any,
    );
    service.analyzeRestaurantAnomalies = async () => {
      scanCalls += 1;
      return 0;
    };

    await service.listForRestaurant('rest-1');
    await service.listForBranches(['rest-1', 'rest-2'], new Map());
    const controller = new FraudAlertsController(service);
    await controller.list('rest-1');
    assert.equal(scanCalls, 0);

    // Explicit POST /scan triggers analyzeRestaurantAnomalies
    await controller.scan('rest-1');
    assert.equal(scanCalls, 1);

    // PG 23505 unique constraint violation on concurrent insert returns null cleanly
    const dupRes = await service.recordAlertIfNew(
      {
        restaurantId: 'rest-1',
        ruleCode: 'UNUSUAL_CASH_OUT',
        severity: 'high',
        riskScore: 80,
        title: 'Test',
        description: 'Test',
        sourceKey: 'unusual-cash-out:tx-1',
      },
      new Set(),
    );
    assert.equal(dupRes, null);
  });
});

describe('CS-05: numericColumnTransformer & TypeORM Entity Metadata Alignment (FIX-14, FIX-15)', () => {
  it('converts numeric strings to JS numbers and attaches transformer across all 14 numeric entities', async () => {
    assert.equal(numericColumnTransformer.from('149.95'), 149.95);
    assert.equal(numericColumnTransformer.from('0.0000'), 0);
    assert.equal(numericColumnTransformer.from(null), null);
    assert.equal(numericColumnTransformer.from(undefined), undefined);
    assert.equal(numericColumnTransformer.to(42.5), 42.5);

    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

    const expectedNumericEntities = [
      'products',
      'campaigns',
      'stock_materials',
      'stock_movements',
      'purchase_orders',
      'order_items',
      'cash_shifts',
      'cash_transactions',
      'completed_orders',
      'open_accounts',
      'open_account_items',
      'open_account_payments',
      'ledger_entries',
      'fraud_alerts',
    ];

    for (const tableName of expectedNumericEntities) {
      const meta = dataSource.entityMetadatas.find((m) => m.tableName === tableName);
      assert.ok(meta, `Missing metadata for ${tableName}`);
      const numericCols = meta.columns.filter(
        (c) => c.type === 'numeric' || c.type === 'decimal',
      );
      assert.ok(numericCols.length > 0, `Expected numeric columns on ${tableName}`);
      for (const col of numericCols) {
        assert.equal(
          col.transformer,
          numericColumnTransformer,
          `Column ${tableName}.${col.databaseName} is missing numericColumnTransformer`,
        );
      }
    }
  });

  it('aligns PrintJobEntity PK generation, timestamptz date columns, and SET NULL FKs across all 33 entities', async () => {
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();

    const printJobMeta = dataSource.entityMetadatas.find((m) => m.tableName === 'print_jobs')!;
    const pkCol = printJobMeta.primaryColumns[0];
    assert.equal(pkCol.isGenerated, true);
    assert.equal(pkCol.generationStrategy, 'uuid');

    for (const meta of dataSource.entityMetadatas) {
      for (const col of meta.columns) {
        if (col.isCreateDate || col.isUpdateDate) {
          assert.equal(
            col.type,
            'timestamptz',
            `Expected timestamptz on ${meta.tableName}.${col.databaseName}`,
          );
        }
      }
    }

    for (const [tableName, propName] of [
      ['purchase_orders', 'supplier'],
      ['stock_movements', 'material'],
      ['orders', 'table'],
    ] as const) {
      const meta = dataSource.entityMetadatas.find((m) => m.tableName === tableName)!;
      const rel = meta.relations.find((r) => r.propertyName === propName)!;
      assert.equal(rel.onDelete, 'SET NULL', `Expected SET NULL on ${tableName}.${propName}`);
    }
  });
});

describe('CS-05: Tenant-scoped ActorNameSyncService, BossOverviewDetailsPolicy & UUID Guards (FIX-31, FIX-42)', () => {
  it('scopes ActorNameSyncService ID updates by restaurant_id and syncs open_accounts, payments, counts, and POs', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const mockDs = {
      transaction: async (cb: any) =>
        cb({
          query: async (sql: string, params: unknown[]) => {
            queries.push({ sql, params });
            return [];
          },
        }),
    };
    const service = new ActorNameSyncService(mockDs as any);
    await service.syncActorNameChange({
      restaurantIds: ['11111111-1111-4111-8111-111111111111'],
      actorId: '22222222-2222-4222-8222-222222222222',
      oldName: 'Eski İsim',
      newName: 'Yeni İsim',
    });

    const allSql = queries.map((q) => q.sql).join('\n');
    assert.match(allSql, /UPDATE orders SET user_display_name = \$1 WHERE user_id = \$2::uuid AND restaurant_id = ANY\(\$3::uuid\[\]\)/);
    assert.match(allSql, /UPDATE open_accounts SET created_by = \$1/);
    assert.match(allSql, /UPDATE open_account_payments oap SET received_by = \$1/);
    assert.match(allSql, /UPDATE inventory_counts SET counted_by = \$1/);
    assert.match(allSql, /UPDATE purchase_orders SET created_by = \$1/);
    assert.match(allSql, /AND EXISTS \(\s*SELECT 1\s*FROM jsonb_array_elements\(co\.orders_snapshot\)/);
  });

  it('keys BossOverviewDetailsPolicy topProducts by productId and resolves current ProductEntity.name', () => {
    const products = [
      { id: 'prod-1', name: 'Güncel Burger', categoryId: 'cat-1' },
    ] as any[];
    const categories = [{ id: 'cat-1', name: 'Burgerler' }] as any[];
    const completedOrders = [
      {
        ordersSnapshot: [
          {
            items: [
              { productId: 'prod-1', productName: 'Eski Burger', price: 200, quantity: 2, status: 'served' },
              { productId: 'prod-1', productName: 'Güncel Burger', price: 200, quantity: 3, status: 'served' },
            ],
          },
        ],
      },
    ] as any[];

    const { topProducts, categoryBreakdown } =
      BossOverviewDetailsPolicy.buildCategoryAndProductBreakdown(
        completedOrders,
        products,
        categories,
      );

    assert.equal(topProducts.length, 1);
    assert.equal(topProducts[0].productName, 'Güncel Burger');
    assert.equal(topProducts[0].quantity, 5);
    assert.equal(topProducts[0].revenue, 1000);
    assert.equal(categoryBreakdown[0].categoryName, 'Burgerler');
  });

  it('filters out non-UUID productIds in OrderQueryService and StockMovementsService before querying PostgreSQL', async () => {
    let queriedIds: string[] = [];
    const validUuid = '11111111-2222-4333-8444-555555555555';
    const orderQuery = new OrderQueryService(
      {} as any,
      {} as any,
      {} as any,
      {
        find: async (opts: any) => {
          queriedIds = opts.where.id._value;
          return [
            {
              id: validUuid,
              categoryId: 'cat-99',
              category: { restaurantId: 'rest-1' },
            },
          ];
        },
      } as any,
      {} as any,
    );

    const items: Array<{ productId?: string; categoryId?: string }> = [
      { productId: 'custom-open-account-item' },
      { productId: validUuid },
    ];
    await orderQuery.attachCategoryIdsToItems(items, 'rest-1');
    assert.deepEqual(queriedIds, [validUuid]);
    assert.equal(items[0].categoryId, undefined);
    assert.equal(items[1].categoryId, 'cat-99');

    const stockMovements = new StockMovementsService({} as any);
    let productQueryCalled = false;
    const res = await stockMovements.deductRecipeIngredients(
      {
        find: async () => {
          productQueryCalled = true;
          return [];
        },
      } as any,
      'rest-1',
      [{ productId: 'non-uuid-adhoc', productName: 'Adhoc', quantity: 1 }],
      'Cashier',
    );
    assert.deepEqual(res, []);
    assert.equal(productQueryCalled, false);
  });
});

