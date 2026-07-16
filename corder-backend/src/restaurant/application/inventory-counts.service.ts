import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryCountEntity } from '../domain/inventory-count.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { StockMovementsService } from './stock-movements.service';

@Injectable()
export class InventoryCountsService {
  constructor(
    @InjectRepository(InventoryCountEntity)
    private readonly repo: Repository<InventoryCountEntity>,
    @InjectRepository(StockMaterialEntity)
    private readonly materials: Repository<StockMaterialEntity>,
    private readonly stockMovements: StockMovementsService,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  async start(restaurantId: string, countedBy: string) {
    const materials = await this.materials.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });
    const items = materials.map((m) => ({
      materialId: m.id,
      materialName: m.name,
      expectedStock: Number(m.currentStock ?? 0),
      actualStock: Number(m.currentStock ?? 0),
      difference: 0,
    }));
    const entity = this.repo.create({
      restaurantId,
      date: new Date(),
      countedBy,
      items,
      status: 'in-progress',
      notes: null,
    });
    return this.repo.save(entity);
  }

  async updateItem(
    restaurantId: string,
    countId: string,
    materialId: string,
    actual: number,
  ) {
    const count = await this.repo.findOne({ where: { id: countId, restaurantId } });
    if (!count) throw new NotFoundException('Sayım kaydı bulunamadı.');
    const items = count.items.map((it) =>
      it.materialId === materialId
        ? {
            ...it,
            actualStock: actual,
            difference: actual - it.expectedStock,
          }
        : it,
    );
    count.items = items;
    return this.repo.save(count);
  }

  async complete(restaurantId: string, countId: string, userName: string) {
    const count = await this.repo.findOne({ where: { id: countId, restaurantId } });
    if (!count) throw new NotFoundException('Sayım kaydı bulunamadı.');
    if (count.status === 'completed') return count;

    for (const item of count.items) {
      if (item.difference === 0) continue;
      const diff = item.difference;
      await this.stockMovements.create(restaurantId, {
        materialId: item.materialId,
        materialName: item.materialName,
        type: 'count-adjustment',
        quantity: Math.abs(diff),
        createdBy: userName,
        reason: `Sayım farkı: ${diff > 0 ? '+' : ''}${diff}`,
      });
    }

    count.status = 'completed';
    return this.repo.save(count);
  }
}

