import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
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
      throw new BadRequestException('Invalid inventory count quantity.');
    }
    return this.dataSource.transaction(async (em) => {
      const count = await em.findOne(InventoryCountEntity, {
        where: { id: countId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!count) throw new NotFoundException('Inventory count record not found.');
      if (count.status === 'completed') {
        throw new BadRequestException('Completed inventory count cannot be updated.');
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
      return em.save(InventoryCountEntity, count);
    });
  }

  async complete(restaurantId: string, countId: string, userName: string) {
    return this.dataSource.transaction(async (em) => {
      const count = await em.findOne(InventoryCountEntity, {
        where: { id: countId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!count) throw new NotFoundException('Inventory count record not found.');
      if (count.status === 'completed') return count;

      const updatedItems = count.items.map((item) => {
        const diff = Number(
          (Number(item.actualStock) - Number(item.expectedStock)).toFixed(3),
        );
        return { ...item, difference: diff };
      });

      const affectedMaterialIds = [
        ...new Set(updatedItems.filter((i) => i.difference !== 0).map((i) => i.materialId)),
      ].sort();
      if (affectedMaterialIds.length > 0) {
        await em.find(StockMaterialEntity, {
          where: { id: In(affectedMaterialIds), restaurantId },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      }

      for (const item of updatedItems) {
        if (item.difference === 0) continue;
        await this.stockMovements.applyMovement(em, restaurantId, {
          materialId: item.materialId,
          materialName: item.materialName,
          type: 'count-adjustment',
          quantity: item.difference,
          createdBy: userName,
          reason: `Inventory count adjustment: ${item.difference > 0 ? '+' : ''}${item.difference}`,
        });
      }

      count.items = updatedItems;
      count.status = 'completed';
      return em.save(InventoryCountEntity, count);
    });
  }
}
