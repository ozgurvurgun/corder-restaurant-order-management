import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { SupplierEntity } from '../domain/supplier.entity';
import { ProductEntity } from '../domain/product.entity';
import { CreateStockMaterialDto } from '../api/dto/create-stock-material.dto';
import { UpdateStockMaterialDto } from '../api/dto/update-stock-material.dto';

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
  ): Promise<string | null> {
    const trimmed = supplierId?.trim();
    if (!trimmed) return null;
    const supplier = await this.supplierRepo.findOne({
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
      name: dto.name.trim(),
      unit: dto.unit.trim(),
      currentStock: Number((dto.currentStock ?? 0).toFixed(3)),
      minStock: Number((dto.minStock ?? 0).toFixed(3)),
      costPerUnit: Number(dto.costPerUnit.toFixed(4)),
      supplierId,
      category: dto.category?.trim() || 'Other',
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdateStockMaterialDto) {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Stock material not found.');
    if (dto.name != null) entity.name = dto.name.trim();
    if (dto.unit != null) entity.unit = dto.unit.trim();
    if (dto.currentStock != null) {
      entity.currentStock = Number(dto.currentStock.toFixed(3));
    }
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
      );
    }
    return this.repo.save(entity);
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
