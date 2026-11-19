import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { RestaurantEntity } from '../src/platform/domain/restaurant.entity';
import { InventoryCountEntity } from '../src/restaurant/domain/inventory-count.entity';
import { PurchaseOrderEntity } from '../src/restaurant/domain/purchase-order.entity';
import { StockMaterialEntity } from '../src/restaurant/domain/stock-material.entity';
import { StockMovementEntity } from '../src/restaurant/domain/stock-movement.entity';
import { ProductEntity } from '../src/restaurant/domain/product.entity';
import { CategoryEntity } from '../src/restaurant/domain/category.entity';
import { RecipeStockPolicy } from '../src/restaurant/domain/services/recipe-stock.policy';
import { InventoryCountsService } from '../src/restaurant/application/inventory-counts.service';
import { InventoryCountsController } from '../src/restaurant/api/inventory-counts.controller';
import { PurchaseOrdersService } from '../src/restaurant/application/purchase-orders.service';
import { StockMaterialsService } from '../src/restaurant/application/stock-materials.service';
import { StockMovementsService } from '../src/restaurant/application/stock-movements.service';
import { ProductService } from '../src/restaurant/application/product.service';

describe('CS-02: FIX-02, FIX-10 & FIX-44 — InventoryCountsService locking, isCounted reconciliation & cancel', () => {
  it('acquires pessimistic_write on RestaurantEntity in start() and initializes items with isCounted: false', async () => {
    const lockOrder: string[] = [];
    const rest = Object.assign(new RestaurantEntity(), { id: 'rest-1', name: 'Test Rest' });
    const matA = Object.assign(new StockMaterialEntity(), {
      id: '11111111-1111-4111-8111-111111111111', restaurantId: 'rest-1', name: 'Beef', unit: 'kg', currentStock: 10,
    });
    const matB = Object.assign(new StockMaterialEntity(), {
      id: '22222222-2222-4222-8222-222222222222', restaurantId: 'rest-1', name: 'Cola', unit: 'adet', currentStock: 100,
    });

    const mockEm: any = {
      findOne: async (entity: any, opts: any) => {
        if (opts?.lock?.mode === 'pessimistic_write') lockOrder.push(entity.name);
        if (entity === RestaurantEntity) return rest;
        return null;
      },
      find: async (entity: any) => (entity === StockMaterialEntity ? [matA, matB] : []),
      create: (Cls: any, data: any) => Object.assign(new Cls(), data),
      save: async (_e: any, row: any) => ({ ...row, id: 'count-1' }),
    };

    const service = new InventoryCountsService(
      {} as any, {} as any, {} as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );

    const started = await service.start('rest-1', 'Chef');
    assert.deepEqual(lockOrder, ['RestaurantEntity', 'InventoryCountEntity']);
    assert.equal(started.status, 'in-progress');
    assert.equal(started.items.length, 2);
    assert.equal(started.items[0].isCounted, false);
    assert.equal(started.items[1].isCounted, false);
  });

  it('marks updated items with isCounted: true and complete() leaves uncounted materials untouched after concurrent sales', async () => {
    const matBeefId = '11111111-1111-4111-8111-111111111111';
    const matColaId = '22222222-2222-4222-8222-222222222222';
    const matBeef = Object.assign(new StockMaterialEntity(), {
      id: matBeefId, restaurantId: 'rest-1', name: 'Beef', unit: 'kg', currentStock: 10,
    });
    const matCola = Object.assign(new StockMaterialEntity(), {
      id: matColaId, restaurantId: 'rest-1', name: 'Cola', unit: 'adet', currentStock: 80,
    });

    const countEntity = Object.assign(new InventoryCountEntity(), {
      id: 'count-1', restaurantId: 'rest-1', status: 'in-progress' as 'in-progress' | 'completed',
      countedBy: 'Chef', date: new Date(),
      items: [
        { materialId: matBeefId, materialName: 'Beef', expectedStock: 10, actualStock: 10, difference: 0, isCounted: false },
        { materialId: matColaId, materialName: 'Cola', expectedStock: 100, actualStock: 100, difference: 0, isCounted: false },
      ],
    });

    const recordedMovements: any[] = [];
    const mockEm: any = {
      findOne: async (entity: any) => (entity === InventoryCountEntity ? countEntity : null),
      find: async (entity: any) => (entity === StockMaterialEntity ? [matBeef, matCola] : []),
      save: async (_e: any, row: any) => row,
    };

    const service = new InventoryCountsService(
      {} as any, {} as any,
      {
        applyMovement: async (_em: any, _restId: string, dto: any) => {
          recordedMovements.push(dto);
          if (dto.materialId === matBeefId) matBeef.applyDelta(dto.quantity);
          if (dto.materialId === matColaId) matCola.applyDelta(dto.quantity);
        },
      } as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );

    await service.updateItem('rest-1', 'count-1', matBeefId, 8.5);
    assert.equal(countEntity.items[0].isCounted, true);
    assert.equal(countEntity.items[0].actualStock, 8.5);
    assert.equal(countEntity.items[1].isCounted, false);

    const completed = await service.complete('rest-1', 'count-1', 'Chef');
    assert.equal(completed.status, 'completed');
    assert.equal(recordedMovements.length, 1);
    assert.equal(recordedMovements[0].materialId, matBeefId);
    assert.equal(recordedMovements[0].quantity, -1.5);
    assert.equal(matBeef.currentStock, 8.5);
    assert.equal(matCola.currentStock, 80);
    const colaItem = completed.items.find((i) => i.materialId === matColaId)!;
    assert.equal(colaItem.isCounted, false);
    assert.equal(colaItem.expectedStock, 80);
    assert.equal(colaItem.actualStock, 80);
    assert.equal(colaItem.difference, 0);
  });

  it('cancels an in-progress inventory count with pessimistic_write and rejects cancelling completed counts', async () => {
    let removedEntity: any = null;
    let lockedMode: string | undefined;
    const inProgressCount = Object.assign(new InventoryCountEntity(), {
      id: 'count-active', restaurantId: 'rest-1',
      status: 'in-progress' as 'in-progress' | 'completed', items: [],
    });

    const mockEm: any = {
      findOne: async (_entity: any, opts: any) => {
        lockedMode = opts?.lock?.mode;
        return inProgressCount;
      },
      remove: async (_entity: any, row: any) => { removedEntity = row; },
    };

    const service = new InventoryCountsService(
      {} as any, {} as any, {} as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );
    const controller = new InventoryCountsController(service);

    const res = await controller.cancel('rest-1', 'count-active');
    assert.deepEqual(res, { ok: true, id: 'count-active' });
    assert.equal(lockedMode, 'pessimistic_write');
    assert.equal(removedEntity, inProgressCount);

    inProgressCount.status = 'completed';
    await assert.rejects(
      () => controller.cancel('rest-1', 'count-active'),
      (err: unknown) => err instanceof BadRequestException,
    );
  });
});

describe('CS-02: FIX-22 — RecipeStockPolicy & ProductService unit family validation and 4-decimal precision', () => {
  it('throws BadRequestException on incompatible unit families and preserves 4-decimal sub-gram deductions', () => {
    assert.throws(() => RecipeStockPolicy.convertQuantity(100, 'g', 'lt'), (e: unknown) => e instanceof BadRequestException);
    assert.throws(() => RecipeStockPolicy.convertQuantity(50, 'gr', 'adet'), (e: unknown) => e instanceof BadRequestException);
    assert.throws(() => RecipeStockPolicy.convertQuantity(200, 'ml', 'kg'), (e: unknown) => e instanceof BadRequestException);

    assert.equal(RecipeStockPolicy.convertQuantity(0.4, 'g', 'kg'), 0.0004);
    assert.equal(RecipeStockPolicy.convertQuantity(0.5, 'ml', 'lt'), 0.0005);
    assert.equal(RecipeStockPolicy.convertQuantity(1, 'porsiyon', 'adet'), 1);

    const spiceId = '33333333-3333-4333-8333-333333333333';
    const dish = Object.assign(new ProductEntity(), {
      id: 'prod-spice', name: 'Adana Kebap',
      ingredients: [{ materialId: spiceId, quantity: 0.4, unit: 'gr' }],
    });

    const deductions = RecipeStockPolicy.aggregateDeductions(
      [{ productId: 'prod-spice', productName: 'Adana Kebap', quantity: 1 }],
      new Map([['prod-spice', dish]]),
      new Map([[spiceId, { unit: 'kg' }]]),
    );
    assert.equal(deductions.length, 1);
    assert.equal(deductions[0].quantity, 0.0004);
  });

  it('rejects product recipe creation when ingredient unit family mismatches stock material unit', async () => {
    const matMilkId = '44444444-4444-4444-8444-444444444444';
    const cat = Object.assign(new CategoryEntity(), { id: 'cat-1', restaurantId: 'rest-1', name: 'Drinks' });
    const matMilk = Object.assign(new StockMaterialEntity(), { id: matMilkId, restaurantId: 'rest-1', name: 'Milk', unit: 'lt' });

    const productService = new ProductService(
      {
        createQueryBuilder: () => ({
          where: function () { return this; }, andWhere: function () { return this; },
          innerJoinAndSelect: function () { return this; }, select: function () { return this; },
          getRawOne: async () => ({ max: 1 }),
          getOne: async () => Object.assign(new ProductEntity(), { id: 'p-1', category: cat }),
        }),
        save: async (e: any) => ({ ...e, id: 'p-1' }),
      } as any,
      { findOne: async () => cat } as any,
      { find: async () => [matMilk] } as any,
      {} as any,
    );

    await assert.rejects(
      () => productService.create('rest-1', {
        categoryId: 'cat-1', name: 'Latte', price: 120,
        ingredients: [{ materialId: matMilkId, quantity: 200, unit: 'gr' }],
      }),
      (err: unknown) => err instanceof BadRequestException,
    );
  });
});

describe('CS-02: FIX-45 — PurchaseOrdersService locking, state transition guard & receivedQuantity preservation', () => {
  it('locks PO with pessimistic_write on update() and forbids ordered -> draft rollback', async () => {
    let lockedPo = false;
    const orderedPo = Object.assign(new PurchaseOrderEntity(), {
      id: 'po-1', restaurantId: 'rest-1', status: 'ordered' as const, items: [],
    });

    const mockEm: any = {
      findOne: async (_e: any, opts: any) => {
        if (opts?.lock?.mode === 'pessimistic_write') lockedPo = true;
        return orderedPo;
      },
      save: async (_e: any, row: any) => row,
    };

    const service = new PurchaseOrdersService(
      {} as any, {} as any, {} as any, {} as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );

    await assert.rejects(
      () => service.update('rest-1', 'po-1', { status: 'draft' }),
      (err: unknown) => err instanceof BadRequestException,
    );
    assert.equal(lockedPo, true);
  });

  it('rejects duplicate or unknown materialIds in markReceived() and stores receivedQuantity without overwriting ordered quantity', async () => {
    const mat1 = '11111111-1111-4111-8111-111111111111';
    const mat2 = '22222222-2222-4222-8222-222222222222';
    const unknownMat = '99999999-9999-4999-8999-999999999999';

    const createPo = () => Object.assign(new PurchaseOrderEntity(), {
      id: 'po-2', restaurantId: 'rest-1', supplierId: 'sup-1', supplierName: 'Metro',
      status: 'ordered' as 'ordered' | 'received', totalAmount: 1000,
      items: [
        { materialId: mat1, materialName: 'Flour', quantity: 50, unitCost: 10 },
        { materialId: mat2, materialName: 'Oil', quantity: 25, unitCost: 20 },
      ],
    });

    let activePo = createPo();
    const movements: any[] = [];
    const mockEm: any = {
      findOne: async () => activePo, find: async () => [], save: async (_e: any, row: any) => row,
    };

    const service = new PurchaseOrdersService(
      {} as any, {} as any, {} as any,
      { applyMovement: async (_em: any, _r: string, dto: any) => { movements.push(dto); } } as any,
      { transaction: async (cb: any) => cb(mockEm) } as any,
    );

    await assert.rejects(
      () => service.markReceived('rest-1', 'po-2', 'Admin', { items: [{ materialId: unknownMat, quantity: 10 }] }),
      (err: unknown) => err instanceof BadRequestException,
    );
    await assert.rejects(
      () => service.markReceived('rest-1', 'po-2', 'Admin', {
        items: [{ materialId: mat1, quantity: 40 }, { materialId: mat1, quantity: 10 }],
      }),
      (err: unknown) => err instanceof BadRequestException,
    );

    activePo = createPo();
    const received = await service.markReceived('rest-1', 'po-2', 'Admin', {
      items: [{ materialId: mat1, quantity: 40, unitCost: 10 }, { materialId: mat2, quantity: 0, unitCost: 20 }],
    });

    assert.equal(received.status, 'received');
    assert.equal(received.items[0].quantity, 50);
    assert.equal(received.items[0].receivedQuantity, 40);
    assert.equal(received.items[1].quantity, 25);
    assert.equal(received.items[1].receivedQuantity, 0);
    assert.equal(received.totalAmount, 400);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].materialId, mat1);
    assert.equal(movements[0].quantity, 40);
  });
});

describe('CS-02: FIX-46 — StockMaterialsService movement audit & StockMovementsService single-pass net delta', () => {
  it('locks StockMaterialEntity with pessimistic_write and records a count-adjustment movement when currentStock changes', async () => {
    let lockedMaterial = false;
    const savedMovements: StockMovementEntity[] = [];
    const material = Object.assign(new StockMaterialEntity(), {
      id: 'mat-1', restaurantId: 'rest-1', name: 'Tomato', unit: 'kg',
      currentStock: 15, minStock: 5, costPerUnit: 30, supplierId: null, category: 'Produce',
    });

    const mockEm: any = {
      findOne: async (entity: any, opts: any) => {
        if (entity === StockMaterialEntity && opts?.lock?.mode === 'pessimistic_write') {
          lockedMaterial = true;
          return material;
        }
        return null;
      },
      create: (Cls: any, data: any) => Object.assign(new Cls(), data),
      save: async (entity: any, row: any) => {
        if (entity === StockMovementEntity) savedMovements.push(row);
        return row;
      },
    };

    const service = new StockMaterialsService(
      {} as any, {} as any, { transaction: async (cb: any) => cb(mockEm) } as any,
    );

    await service.update('rest-1', 'mat-1', { currentStock: 12.5 }, 'Manager');
    assert.equal(lockedMaterial, true);
    assert.equal(material.currentStock, 12.5);
    assert.equal(savedMovements.length, 1);
    assert.equal(savedMovements[0].type, 'count-adjustment');
    assert.equal(savedMovements[0].quantity, -2.5);
    assert.equal(savedMovements[0].previousStock, 15);
    assert.equal(savedMovements[0].newStock, 12.5);
    assert.equal(savedMovements[0].createdBy, 'Manager');
  });

  it('computes net delta per materialId and locks all affected materials in a single UUID-sorted pass in reconcileRecipeIngredientsDelta', async () => {
    const matBunId = '11111111-1111-4111-8111-111111111111';
    const matBeefId = '22222222-2222-4222-8222-222222222222';
    const matChickenId = '33333333-3333-4333-8333-333333333333';
    const prodBeefId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const prodChickenId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const cat = Object.assign(new CategoryEntity(), { id: 'cat-1', restaurantId: 'rest-1' });
    const beefBurger = Object.assign(new ProductEntity(), {
      id: prodBeefId, name: 'Beef Burger', category: cat,
      ingredients: [{ materialId: matBunId, quantity: 1, unit: 'adet' }, { materialId: matBeefId, quantity: 150, unit: 'gr' }],
    });
    const chickenBurger = Object.assign(new ProductEntity(), {
      id: prodChickenId, name: 'Chicken Burger', category: cat,
      ingredients: [{ materialId: matBunId, quantity: 1, unit: 'adet' }, { materialId: matChickenId, quantity: 180, unit: 'gr' }],
    });

    const matBun = Object.assign(new StockMaterialEntity(), { id: matBunId, restaurantId: 'rest-1', name: 'Burger Bun', unit: 'adet', currentStock: 50, costPerUnit: 5 });
    const matBeef = Object.assign(new StockMaterialEntity(), { id: matBeefId, restaurantId: 'rest-1', name: 'Beef Patty', unit: 'kg', currentStock: 10, costPerUnit: 400 });
    const matChicken = Object.assign(new StockMaterialEntity(), { id: matChickenId, restaurantId: 'rest-1', name: 'Chicken Breast', unit: 'kg', currentStock: 8, costPerUnit: 200 });

    let materialLockCalls = 0;
    let lockedIdsInQuery: string[] = [];
    const savedMovements: StockMovementEntity[] = [];

    const mockEm: any = {
      find: async (entity: any, opts: any) => {
        if (entity === ProductEntity) return [beefBurger, chickenBurger];
        if (entity === StockMaterialEntity) {
          if (opts?.lock?.mode === 'pessimistic_write') {
            materialLockCalls += 1;
            lockedIdsInQuery = opts.where.id.value ?? [];
          }
          return [matBun, matBeef, matChicken];
        }
        return [];
      },
      create: (Cls: any, data: any) => Object.assign(new Cls(), data),
      save: async (entity: any, row: any) => {
        if (entity === StockMovementEntity) savedMovements.push(row);
        return row;
      },
    };

    const service = new StockMovementsService({} as any);
    const movements = await service.reconcileRecipeIngredientsDelta(
      mockEm, 'rest-1',
      [{ productId: prodBeefId, productName: 'Beef Burger', quantity: 1 }],
      [{ productId: prodChickenId, productName: 'Chicken Burger', quantity: 1 }],
      'Editor',
    );

    assert.equal(materialLockCalls, 1);
    assert.deepEqual(lockedIdsInQuery, [matBunId, matBeefId, matChickenId]);
    assert.equal(movements.length, 2);
    assert.equal(matBun.currentStock, 50);
    assert.equal(matBeef.currentStock, 10.15);
    assert.equal(movements[0].materialId, matBeefId);
    assert.equal(movements[0].type, 'in');
    assert.equal(movements[0].quantity, 0.15);
    assert.equal(matChicken.currentStock, 7.82);
    assert.equal(movements[1].materialId, matChickenId);
    assert.equal(movements[1].type, 'out');
    assert.equal(movements[1].quantity, 0.18);
  });
});
