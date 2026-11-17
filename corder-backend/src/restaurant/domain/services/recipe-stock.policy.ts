import { ProductEntity } from '../product.entity';
import { StockMaterialEntity } from '../stock-material.entity';

export interface BilledOrderLineForStock {
  productId: string;
  productName: string;
  quantity: number;
}

export interface MaterialDeductionAggregation {
  materialId: string;
  quantity: number;
  reason: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUnit(unit?: string | null): string {
  const raw = (unit ?? '').trim().toLowerCase();
  if (raw === 'g' || raw === 'gr' || raw === 'gram') return 'g';
  if (raw === 'kg' || raw === 'kilogram') return 'kg';
  if (raw === 'ml' || raw === 'mililitre') return 'ml';
  if (raw === 'cl' || raw === 'santilitre') return 'cl';
  if (raw === 'l' || raw === 'lt' || raw === 'litre') return 'l';
  return raw;
}

export class RecipeStockPolicy {
  /**
   * Converts an ingredient quantity from `fromUnit` into the stock material's base `toUnit`
   * when both belong to the same mass (g/kg) or volume (ml/cl/l) family.
   */
  static convertQuantity(
    quantity: number,
    fromUnit?: string | null,
    toUnit?: string | null,
  ): number {
    if (!Number.isFinite(quantity) || quantity <= 0) return 0;
    const uFrom = normalizeUnit(fromUnit);
    const uTo = normalizeUnit(toUnit);
    if (!uFrom || !uTo || uFrom === uTo) return quantity;

    if (uFrom === 'g' && uTo === 'kg') return quantity / 1000;
    if (uFrom === 'kg' && uTo === 'g') return quantity * 1000;

    if (uFrom === 'ml' && uTo === 'l') return quantity / 1000;
    if (uFrom === 'l' && uTo === 'ml') return quantity * 1000;
    if (uFrom === 'cl' && uTo === 'l') return quantity / 100;
    if (uFrom === 'l' && uTo === 'cl') return quantity * 100;
    if (uFrom === 'cl' && uTo === 'ml') return quantity * 10;
    if (uFrom === 'ml' && uTo === 'cl') return quantity / 10;

    return quantity;
  }

  static aggregateDeductions(
    billedLines: BilledOrderLineForStock[],
    productById: Map<string, ProductEntity>,
    materialById?: Map<string, Pick<StockMaterialEntity, 'unit'>>,
    reasonPrefix = 'Order',
  ): MaterialDeductionAggregation[] {
    const byMaterial = new Map<string, { quantity: number; labels: string[] }>();

    for (const line of billedLines) {
      const lineQty = Number(line.quantity);
      if (!Number.isFinite(lineQty) || lineQty <= 0) continue;
      const product = productById.get(line.productId);
      if (
        !product ||
        !Array.isArray(product.ingredients) ||
        product.ingredients.length === 0
      ) {
        continue;
      }
      for (const ingredient of product.ingredients) {
        const materialId =
          typeof ingredient?.materialId === 'string'
            ? ingredient.materialId.trim()
            : '';
        if (!UUID_REGEX.test(materialId)) continue;
        const rawPerUnit = Number(ingredient.quantity);
        if (!Number.isFinite(rawPerUnit) || rawPerUnit <= 0) continue;
        const targetUnit = materialById?.get(materialId)?.unit;
        const perUnit = this.convertQuantity(
          rawPerUnit,
          ingredient.unit,
          targetUnit,
        );
        const deduct = perUnit * lineQty;
        if (deduct <= 0) continue;
        const label = `${product.name} x${lineQty}`;
        const existing = byMaterial.get(materialId);
        if (existing) {
          existing.quantity += deduct;
          existing.labels.push(label);
        } else {
          byMaterial.set(materialId, { quantity: deduct, labels: [label] });
        }
      }
    }

    const sortedMaterialIds = [...byMaterial.keys()].sort();
    const out: MaterialDeductionAggregation[] = [];
    for (const materialId of sortedMaterialIds) {
      const entry = byMaterial.get(materialId)!;
      const deductQty = Number(entry.quantity.toFixed(3));
      if (deductQty <= 0) continue;
      const uniqLabels = [...new Set(entry.labels)];
      const reason =
        uniqLabels.length === 1
          ? `${reasonPrefix}: ${uniqLabels[0]}`
          : `${reasonPrefix}: ${uniqLabels.join(', ')}`;
      out.push({
        materialId,
        quantity: deductQty,
        reason,
      });
    }
    return out;
  }

  /**
   * Computes net quantity differences between two snapshots of billed lines
   * (e.g. when a completed order is edited), returning lines to deduct and lines to reverse.
   */
  static computeLineDeltas(
    previousLines: BilledOrderLineForStock[],
    nextLines: BilledOrderLineForStock[],
  ): {
    linesToDeduct: BilledOrderLineForStock[];
    linesToReverse: BilledOrderLineForStock[];
  } {
    const byProduct = new Map<
      string,
      { productName: string; prevQty: number; nextQty: number }
    >();

    for (const l of previousLines) {
      if (!l.productId || l.quantity <= 0) continue;
      const cur = byProduct.get(l.productId) ?? {
        productName: l.productName,
        prevQty: 0,
        nextQty: 0,
      };
      cur.prevQty += Number(l.quantity);
      byProduct.set(l.productId, cur);
    }

    for (const l of nextLines) {
      if (!l.productId || l.quantity <= 0) continue;
      const cur = byProduct.get(l.productId) ?? {
        productName: l.productName,
        prevQty: 0,
        nextQty: 0,
      };
      cur.productName = l.productName || cur.productName;
      cur.nextQty += Number(l.quantity);
      byProduct.set(l.productId, cur);
    }

    const linesToDeduct: BilledOrderLineForStock[] = [];
    const linesToReverse: BilledOrderLineForStock[] = [];

    for (const [productId, { productName, prevQty, nextQty }] of byProduct.entries()) {
      const diff = nextQty - prevQty;
      if (diff > 0) {
        linesToDeduct.push({ productId, productName, quantity: diff });
      } else if (diff < 0) {
        linesToReverse.push({ productId, productName, quantity: -diff });
      }
    }

    return { linesToDeduct, linesToReverse };
  }
}
