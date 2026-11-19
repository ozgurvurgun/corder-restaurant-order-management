import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { StockMovementEntity } from '../domain/stock-movement.entity';
import { SupplierEntity } from '../domain/supplier.entity';
import { ProductEntity } from '../domain/product.entity';
import { CreateStockMaterialDto } from '../api/dto/create-stock-material.dto';
import { UpdateStockMaterialDto } from '../api/dto/update-stock-material.dto';
import { normalizeStorageText } from '../../common/text/text-normalizer';

export { CreateStockMaterialDto, UpdateStockMaterialDto };

@Injectable()
export class StockMaterialsService {
  constructor(
    @InjectRepository(StockMaterialEntity)
    private readonly repo: Repository<StockMaterialEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    private readonly dataSource: DataSource,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });
  }

  private async assertSupplierBelongsToTenant(
    restaurantId: string,
    supplierId?: string | null,
    em?: EntityManager,
  ): Promise<string | null> {
    const trimmed = supplierId?.trim();
    if (!trimmed) return null;
    const supplier = em
      ? await em.findOne(SupplierEntity, {
          where: { id: trimmed, restaurantId },
        })
      : await this.supplierRepo.findOne({
          where: { id: trimmed, restaurantId },
        });
    if (!supplier) {
      throw new BadRequestException(
        'Supplier not found or does not belong to this restaurant.',
      );
    }
    return supplier.id;
  }

  async create(restaurantId: string, dto: CreateStockMaterialDto) {
    const supplierId = await this.assertSupplierBelongsToTenant(
      restaurantId,
      dto.supplierId,
    );
    const entity = this.repo.create({
      restaurantId,
      name: normalizeStorageText(dto.name),
      unit: dto.unit.trim(),
      currentStock: Number((dto.currentStock ?? 0).toFixed(3)),
      minStock: Number((dto.minStock ?? 0).toFixed(3)),
      costPerUnit: Number(dto.costPerUnit.toFixed(4)),
      supplierId,
      category: dto.category?.trim() || 'Other',
    });
    return this.repo.save(entity);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateStockMaterialDto,
    actorName = 'System',
  ) {
    return this.dataSource.transaction(async (em) => {
      const entity = await em.findOne(StockMaterialEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Stock material not found.');
      if (dto.name != null) entity.name = normalizeStorageText(dto.name);
      if (dto.unit != null) entity.unit = dto.unit.trim();
      if (dto.minStock != null) {
        entity.minStock = Number(dto.minStock.toFixed(3));
      }
      if (dto.costPerUnit != null) {
        entity.costPerUnit = Number(dto.costPerUnit.toFixed(4));
      }
      if (dto.category != null) {
        entity.category = dto.category.trim() || 'Other';
      }
      if (dto.supplierId !== undefined) {
        entity.supplierId = await this.assertSupplierBelongsToTenant(
          restaurantId,
          dto.supplierId,
          em,
        );
      }

      const previousStock = Number(Number(entity.currentStock ?? 0).toFixed(3));
      let stockDelta = 0;
      if (dto.currentStock != null) {
        const nextStock = Number(dto.currentStock.toFixed(3));
        stockDelta = Number((nextStock - previousStock).toFixed(3));
        entity.currentStock = nextStock;
      }

      const savedEntity = await em.save(StockMaterialEntity, entity);

      if (stockDelta !== 0) {
        const effectiveUnitCost =
          Number(savedEntity.costPerUnit ?? 0) > 0
            ? Number(Number(savedEntity.costPerUnit).toFixed(4))
            : null;
        const effectiveTotalCost =
          effectiveUnitCost != null
            ? Number((Math.abs(stockDelta) * effectiveUnitCost).toFixed(4))
            : null;
        const movement = em.create(StockMovementEntity, {
          restaurantId,
          materialId: savedEntity.id,
          materialName: savedEntity.name,
          type: 'count-adjustment',
          quantity: stockDelta,
          previousStock,
          newStock: Number(savedEntity.currentStock),
          unitCost: effectiveUnitCost,
          totalCost: effectiveTotalCost,
          supplierId: savedEntity.supplierId ?? null,
          reason: `Manual stock adjustment: ${stockDelta > 0 ? '+' : ''}${stockDelta}`,
          createdBy: (actorName || '').trim() || 'System',
        });
        await em.save(StockMovementEntity, movement);
      }

      return savedEntity;
    });
  }

  async remove(restaurantId: string, id: string) {
    await this.dataSource.transaction(async (em) => {
      const entity = await em.findOne(StockMaterialEntity, {
        where: { id, restaurantId },
      });
      if (!entity) throw new NotFoundException('Stock material not found.');

      // Clean up dangling references in products.ingredients JSONB for this tenant
      const products = await em
        .getRepository(ProductEntity)
        .createQueryBuilder('p')
        .innerJoin('p.category', 'c')
        .where('c.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('p.ingredients IS NOT NULL')
        .getMany();

      for (const product of products) {
        if (!Array.isArray(product.ingredients)) continue;
        const filtered = product.ingredients.filter(
          (ing) => ing.materialId !== id,
        );
        if (filtered.length !== product.ingredients.length) {
          product.ingredients = filtered.length > 0 ? filtered : null;
          await em.save(ProductEntity, product);
        }
      }

      await em.remove(StockMaterialEntity, entity);
    });
  }
}
