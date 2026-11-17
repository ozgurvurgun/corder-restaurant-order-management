import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RecipeStockPolicy } from './recipe-stock.policy';
import { ProductEntity } from '../product.entity';
import { StockMaterialEntity } from '../stock-material.entity';

describe('RecipeStockPolicy & StockMaterialEntity', () => {
  it('converts compatible mass and volume units accurately', () => {
    assert.equal(RecipeStockPolicy.convertQuantity(250, 'gr', 'kg'), 0.25);
    assert.equal(RecipeStockPolicy.convertQuantity(1.5, 'kg', 'g'), 1500);
    assert.equal(RecipeStockPolicy.convertQuantity(500, 'ml', 'lt'), 0.5);
    assert.equal(RecipeStockPolicy.convertQuantity(33, 'cl', 'l'), 0.33);
    assert.equal(RecipeStockPolicy.convertQuantity(2, 'adet', 'adet'), 2);
  });

  it('aggregates recipe deductions across lines with unit conversion', () => {
    const matCheeseId = '11111111-1111-4111-8111-111111111111';
    const matEggId = '22222222-2222-4222-8222-222222222222';

    const product = new ProductEntity();
    product.id = 'prod-1';
    product.name = 'Kahvaltı Tabağı';
    product.ingredients = [
      { materialId: matCheeseId, quantity: 50, unit: 'gr' },
      { materialId: matEggId, quantity: 2, unit: 'adet' },
    ];

    const productById = new Map([[product.id, product]]);
    const materialById = new Map([
      [matCheeseId, { unit: 'kg' }],
      [matEggId, { unit: 'adet' }],
    ]);

    const deductions = RecipeStockPolicy.aggregateDeductions(
      [{ productId: 'prod-1', productName: 'Kahvaltı Tabağı', quantity: 3 }],
      productById,
      materialById,
    );

    assert.equal(deductions.length, 2);
    assert.deepEqual(deductions[0], {
      materialId: matCheeseId,
      quantity: 0.15,
      reason: 'Order: Kahvaltı Tabağı x3',
    });
    assert.deepEqual(deductions[1], {
      materialId: matEggId,
      quantity: 6,
      reason: 'Order: Kahvaltı Tabağı x3',
    });
  });

  it('computes net line deltas for edited completed orders', () => {
    const prev = [
      { productId: 'p1', productName: 'Burger', quantity: 3 },
      { productId: 'p2', productName: 'Cola', quantity: 2 },
    ];
    const next = [
      { productId: 'p1', productName: 'Burger', quantity: 1 },
      { productId: 'p2', productName: 'Cola', quantity: 4 },
      { productId: 'p3', productName: 'Fries', quantity: 2 },
    ];

    const { linesToDeduct, linesToReverse } =
      RecipeStockPolicy.computeLineDeltas(prev, next);

    assert.deepEqual(linesToReverse, [
      { productId: 'p1', productName: 'Burger', quantity: 2 },
    ]);
    assert.deepEqual(linesToDeduct, [
      { productId: 'p2', productName: 'Cola', quantity: 2 },
      { productId: 'p3', productName: 'Fries', quantity: 2 },
    ]);
  });

  it('updates StockMaterialEntity costPerUnit via weighted moving average and last-cost fallback', () => {
    const mat = new StockMaterialEntity();
    mat.currentStock = 10;
    mat.costPerUnit = 40;

    // 10 units @ 40 + 10 units @ 50 => weighted average = 45
    mat.applyCostUpdate(10, 50, 10);
    assert.equal(mat.costPerUnit, 45);

    // When stock before addition is <= 0, falls back to Last Cost
    mat.currentStock = -2;
    mat.applyCostUpdate(5, 62.5, -2);
    assert.equal(mat.costPerUnit, 62.5);
  });
});
