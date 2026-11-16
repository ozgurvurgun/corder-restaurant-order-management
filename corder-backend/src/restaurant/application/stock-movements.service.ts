import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { StockMovementEntity } from '../domain/stock-movement.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
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
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
      take: limit,
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
        throw new BadRequestException('Inventory count adjustment cannot be zero.');
      }
    } else if (rawQty <= 0) {
      throw new BadRequestException('Quantity must be positive.');
    }

    const material = await em.findOne(StockMaterialEntity, {
      where: { id: dto.materialId, restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!material) throw new NotFoundException('Stock material not found.');

    const qty = Number(rawQty.toFixed(3));
    const delta = dto.type === 'count-adjustment' || dto.type === 'in' ? qty : -qty;
    const { previousStock, newStock } = material.applyDelta(delta);
    await em.save(StockMaterialEntity, material);

    const movement = em.create(StockMovementEntity, {
      restaurantId,
      materialId: material.id,
      materialName: dto.materialName ?? material.name,
      type: dto.type,
      quantity: qty,
      previousStock,
      newStock,
      unitCost: dto.unitCost ?? null,
      totalCost: dto.totalCost ?? null,
      supplierId: dto.supplierId ?? null,
      reason: dto.reason ?? null,
      createdBy: dto.createdBy,
    });
    return em.save(StockMovementEntity, movement);
  }

  async deductRecipeIngredients(
    em: EntityManager,
    restaurantId: string,
    billLinesForStock: BilledOrderLineForStock[],
    actorName: string,
  ): Promise<StockMovementEntity[]> {
    if (!billLinesForStock.length) return [];
    const soldProductIds = [...new Set(billLinesForStock.map((l) => l.productId))];
    const recipeProducts = await em.find(ProductEntity, {
      where: { id: In(soldProductIds) },
      relations: ['category'],
    });
    const validProductById = new Map(
      recipeProducts
        .filter((p) => p.category?.restaurantId === restaurantId)
        .map((p) => [p.id, p]),
    );
    const deductions = RecipeStockPolicy.aggregateDeductions(
      billLinesForStock,
      validProductById,
    );
    if (!deductions.length) return [];

    const materials = await em.find(StockMaterialEntity, {
      where: { id: In(deductions.map((d) => d.materialId)), restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));
    const savedMovements: StockMovementEntity[] = [];

    for (const deduction of deductions) {
      const material = materialById.get(deduction.materialId);
      if (!material || material.restaurantId !== restaurantId) continue;
      const { previousStock, newStock } = material.applyDelta(-deduction.quantity);
      await em.save(StockMaterialEntity, material);
      const movement = em.create(StockMovementEntity, {
        restaurantId,
        materialId: material.id,
        materialName: material.name,
        type: 'out',
        quantity: deduction.quantity,
        previousStock,
        newStock,
        unitCost: null,
        totalCost: null,
        supplierId: null,
        reason: deduction.reason,
        createdBy: actorName,
      });
      savedMovements.push(await em.save(StockMovementEntity, movement));
    }
    return savedMovements;
  }

  async create(restaurantId: string, dto: CreateStockMovementDto) {
    return this.repo.manager.transaction((em) =>
      this.applyMovement(em, restaurantId, dto),
    );
  }
}
