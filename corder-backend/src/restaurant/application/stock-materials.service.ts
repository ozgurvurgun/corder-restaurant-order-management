import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMaterialEntity } from '../domain/stock-material.entity';

export interface CreateStockMaterialDto {
  name: string;
  unit: string;
  currentStock?: number;
  minStock?: number;
  costPerUnit: number;
  supplierId?: string;
  category?: string;
}

export interface UpdateStockMaterialDto {
  name?: string;
  unit?: string;
  currentStock?: number;
  minStock?: number;
  costPerUnit?: number;
  supplierId?: string | null;
  category?: string;
}

@Injectable()
export class StockMaterialsService {
  constructor(
    @InjectRepository(StockMaterialEntity)
    private readonly repo: Repository<StockMaterialEntity>,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });
  }

  async create(restaurantId: string, dto: CreateStockMaterialDto) {
    const entity = this.repo.create({
      restaurantId,
      name: dto.name,
      unit: dto.unit,
      currentStock: dto.currentStock ?? 0,
      minStock: dto.minStock ?? 0,
      costPerUnit: dto.costPerUnit,
      supplierId: dto.supplierId ?? null,
      category: dto.category ?? 'Diger',
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdateStockMaterialDto) {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Malzeme bulunamadı.');
    if (dto.name != null) entity.name = dto.name;
    if (dto.unit != null) entity.unit = dto.unit;
    if (dto.currentStock != null) entity.currentStock = dto.currentStock;
    if (dto.minStock != null) entity.minStock = dto.minStock;
    if (dto.costPerUnit != null) entity.costPerUnit = dto.costPerUnit;
    if (dto.category != null) entity.category = dto.category;
    if (dto.supplierId !== undefined) entity.supplierId = dto.supplierId;
    return this.repo.save(entity);
  }

  async remove(restaurantId: string, id: string) {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) return;
    await this.repo.remove(entity);
  }
}

