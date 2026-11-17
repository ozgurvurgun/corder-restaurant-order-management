import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { StockMovementEntity } from '../domain/stock-movement.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { SupplierEntity } from '../domain/supplier.entity';
import { ProductEntity } from '../domain/product.entity';
import {
  BilledOrderLineForStock,
  RecipeStockPolicy,
} from '../domain/services/recipe-stock.policy';

export interface CreateStockMovementDto {
  materialId: string;
  materialName?: string;
  type: 'in' | 'out' | 'waste' | 'count-adjustment';
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  supplierId?: string;
  reason?: string;
  createdBy: string;
}

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectRepository(StockMovementEntity)
    private readonly repo: Repository<StockMovementEntity>,
  ) {}

  list(restaurantId: string, limit = 200) {
    const safeLimit = Math.min(
      500,
      Math.max(1, Math.floor(Number(limit) || 200)),
    );
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
  }

  async applyMovement(
    em: EntityManager,
    restaurantId: string,
    dto: CreateStockMovementDto,
  ): Promise<StockMovementEntity> {
    const rawQty = Number(dto.quantity);
    if (!Number.isFinite(rawQty)) {
      throw new BadRequestException('Invalid quantity.');
    }

    if (dto.type === 'count-adjustment') {
      if (rawQty === 0) {
        throw new BadRequestException(
          'Inventory count adjustment cannot be zero.',
        );
      }
    } else if (rawQty <= 0) {
      throw new BadRequestException('Quantity must be positive.');
    }

    const material = await em.findOne(StockMaterialEntity, {
      where: { id: dto.materialId, restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!material) throw new NotFoundException('Stock material not found.');

    let validSupplierId: string | null = null;
    if (dto.supplierId?.trim()) {
      const supplier = await em.findOne(SupplierEntity, {
        where: { id: dto.supplierId.trim(), restaurantId },
      });
      if (!supplier) {
        throw new BadRequestException(
          'Supplier not found or does not belong to this restaurant.',
        );
      }
      validSupplierId = supplier.id;
    }

    const qty = Number(rawQty.toFixed(3));
    if (qty === 0) {
      throw new BadRequestException('Quantity is too small.');
    }

    const stockBefore = Number(material.currentStock ?? 0);
    if (dto.type === 'in' && dto.unitCost != null && Number(dto.unitCost) > 0) {
      material.applyCostUpdate(qty, Number(dto.unitCost), stockBefore);
    }

    const delta =
      dto.type === 'count-adjustment' || dto.type === 'in' ? qty : -qty;
    const { previousStock, newStock } = material.applyDelta(delta);
    await em.save(StockMaterialEntity, material);

    const effectiveUnitCost =
      dto.unitCost != null &&
      Number.isFinite(Number(dto.unitCost)) &&
      Number(dto.unitCost) > 0
        ? Number(Number(dto.unitCost).toFixed(4))
        : Number(material.costPerUnit ?? 0) > 0
          ? Number(Number(material.costPerUnit).toFixed(4))
          : null;

    const effectiveTotalCost =
      dto.totalCost != null &&
      Number.isFinite(Number(dto.totalCost)) &&
      Number(dto.totalCost) > 0
        ? Number(Number(dto.totalCost).toFixed(4))
        : effectiveUnitCost != null
          ? Number((Math.abs(qty) * effectiveUnitCost).toFixed(4))
          : null;

    const movement = em.create(StockMovementEntity, {
      restaurantId,
      materialId: material.id,
      materialName: material.name,
      type: dto.type,
      quantity: qty,
      previousStock,
      newStock,
      unitCost: effectiveUnitCost,
      totalCost: effectiveTotalCost,
      supplierId: validSupplierId,
      reason: dto.reason?.trim() || null,
      createdBy: (dto.createdBy || '').trim() || 'System',
    });
    return em.save(StockMovementEntity, movement);
  }

  private async applyRecipeLines(
    em: EntityManager,
    restaurantId: string,
    billLinesForStock: BilledOrderLineForStock[],
    actorName: string,
    direction: 'out' | 'in',
    reasonPrefix: string,
  ): Promise<StockMovementEntity[]> {
    if (!billLinesForStock.length) return [];
    const soldProductIds = [
      ...new Set(billLinesForStock.map((l) => l.productId).filter(Boolean)),
    ];
    if (!soldProductIds.length) return [];

    const recipeProducts = await em.find(ProductEntity, {
      where: { id: In(soldProductIds), category: { restaurantId } },
      relations: ['category'],
    });
    const validProducts = recipeProducts.filter(
      (p) => p.category?.restaurantId === restaurantId,
    );
    const validProductById = new Map(validProducts.map((p) => [p.id, p]));

    const candidateMaterialIds = new Set<string>();
    for (const product of validProducts) {
      if (!Array.isArray(product.ingredients)) continue;
      for (const ing of product.ingredients) {
        if (typeof ing?.materialId === 'string' && ing.materialId.trim()) {
          candidateMaterialIds.add(ing.materialId.trim());
        }
      }
    }
    const sortedCandidateIds = [...candidateMaterialIds].sort();
    if (!sortedCandidateIds.length) return [];

    const materials = await em.find(StockMaterialEntity, {
      where: { id: In(sortedCandidateIds), restaurantId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));

    const deductions = RecipeStockPolicy.aggregateDeductions(
      billLinesForStock,
      validProductById,
      materialById,
      reasonPrefix,
    );
    if (!deductions.length) return [];

    const savedMovements: StockMovementEntity[] = [];
    const safeActor = (actorName || '').trim() || 'System';

    for (const deduction of deductions) {
      const material = materialById.get(deduction.materialId);
      if (!material || material.restaurantId !== restaurantId) continue;
      const delta =
        direction === 'out' ? -deduction.quantity : deduction.quantity;
      const { previousStock, newStock } = material.applyDelta(delta);
      await em.save(StockMaterialEntity, material);

      const matUnitCost = Number(material.costPerUnit ?? 0);
      const unitCost =
        matUnitCost > 0 ? Number(matUnitCost.toFixed(4)) : null;
      const totalCost =
        unitCost != null
          ? Number((deduction.quantity * unitCost).toFixed(4))
          : null;

      const movement = em.create(StockMovementEntity, {
        restaurantId,
        materialId: material.id,
        materialName: material.name,
        type: direction,
        quantity: deduction.quantity,
        previousStock,
        newStock,
        unitCost,
        totalCost,
        supplierId: null,
        reason: deduction.reason,
        createdBy: safeActor,
      });
      savedMovements.push(await em.save(StockMovementEntity, movement));
    }
    return savedMovements;
  }

  async deductRecipeIngredients(
    em: EntityManager,
    restaurantId: string,
    billLinesForStock: BilledOrderLineForStock[],
    actorName: string,
    reasonPrefix = 'Order',
  ): Promise<StockMovementEntity[]> {
    return this.applyRecipeLines(
      em,
      restaurantId,
      billLinesForStock,
      actorName,
      'out',
      reasonPrefix,
    );
  }

  async reverseRecipeIngredients(
    em: EntityManager,
    restaurantId: string,
    billLinesForStock: BilledOrderLineForStock[],
    actorName: string,
    reasonPrefix = 'Order reversal',
  ): Promise<StockMovementEntity[]> {
    return this.applyRecipeLines(
      em,
      restaurantId,
      billLinesForStock,
      actorName,
      'in',
      reasonPrefix,
    );
  }

  async reconcileRecipeIngredientsDelta(
    em: EntityManager,
    restaurantId: string,
    previousLines: BilledOrderLineForStock[],
    nextLines: BilledOrderLineForStock[],
    actorName: string,
  ): Promise<StockMovementEntity[]> {
    const { linesToDeduct, linesToReverse } =
      RecipeStockPolicy.computeLineDeltas(previousLines, nextLines);
    const outMovements = linesToDeduct.length
      ? await this.deductRecipeIngredients(
          em,
          restaurantId,
          linesToDeduct,
          actorName,
          'Order edit',
        )
      : [];
    const inMovements = linesToReverse.length
      ? await this.reverseRecipeIngredients(
          em,
          restaurantId,
          linesToReverse,
          actorName,
          'Order edit reversal',
        )
      : [];
    return [...outMovements, ...inMovements];
  }

  async create(restaurantId: string, dto: CreateStockMovementDto) {
    return this.repo.manager.transaction((em) =>
      this.applyMovement(em, restaurantId, dto),
    );
  }
}
