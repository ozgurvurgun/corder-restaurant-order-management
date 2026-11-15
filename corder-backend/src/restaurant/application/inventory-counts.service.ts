import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const actualNum = Number(actual);
    if (!Number.isFinite(actualNum)) {
      throw new BadRequestException('Sayim miktari gecersiz.');
    }
    const count = await this.repo.findOne({ where: { id: countId, restaurantId } });
    if (!count) throw new NotFoundException('Sayım kaydı bulunamadı.');
    if (count.status === 'completed') {
      throw new BadRequestException('Tamamlanmis sayim guncellenemez.');
    }
    const items = count.items.map((it) =>
      it.materialId === materialId
        ? {
            ...it,
            actualStock: actualNum,
            difference: Number((actualNum - Number(it.expectedStock)).toFixed(3)),
          }
        : it,
    );
    count.items = items;
    return this.repo.save(count);
  }

  async complete(restaurantId: string, countId: string, userName: string) {
    return this.repo.manager.transaction(async (em) => {
      const count = await em.findOne(InventoryCountEntity, {
        where: { id: countId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!count) throw new NotFoundException('Sayım kaydı bulunamadı.');
      if (count.status === 'completed') return count;

      const updatedItems = [];
      for (const item of count.items) {
        const diff = Number(
          (Number(item.actualStock) - Number(item.expectedStock)).toFixed(3),
        );
        updatedItems.push({ ...item, difference: diff });
        if (diff === 0) continue;

        await this.stockMovements.applyMovement(em, restaurantId, {
          materialId: item.materialId,
          materialName: item.materialName,
          type: 'count-adjustment',
          quantity: diff,
          createdBy: userName,
          reason: `Sayım farkı: ${diff > 0 ? '+' : ''}${diff}`,
        });
      }

      count.items = updatedItems;
      count.status = 'completed';
      return em.save(InventoryCountEntity, count);
    });
  }
}
