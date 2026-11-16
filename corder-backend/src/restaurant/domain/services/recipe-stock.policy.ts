import { ProductEntity } from '../product.entity';

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

export class RecipeStockPolicy {
  static aggregateDeductions(
    billedLines: BilledOrderLineForStock[],
    productById: Map<string, ProductEntity>,
  ): MaterialDeductionAggregation[] {
    const byMaterial = new Map<string, { quantity: number; labels: string[] }>();

    for (const line of billedLines) {
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
        const perUnit = Number(ingredient.quantity);
        if (!Number.isFinite(perUnit) || perUnit <= 0) continue;
        const deduct = perUnit * line.quantity;
        if (deduct <= 0) continue;
        const label = `${product.name} x${line.quantity}`;
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
          ? `Order: ${uniqLabels[0]}`
          : `Order: ${uniqLabels.join(', ')}`;
      out.push({
        materialId,
        quantity: deductQty,
        reason,
      });
    }
    return out;
  }
}
