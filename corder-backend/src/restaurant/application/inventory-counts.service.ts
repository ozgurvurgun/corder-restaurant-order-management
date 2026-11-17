import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    return this.dataSource.transaction(async (em) => {
      const existingInProgress = await em.findOne(InventoryCountEntity, {
        where: { restaurantId, status: 'in-progress' },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingInProgress) {
        throw new ConflictException(
          'An inventory count is already in progress. Please complete it before starting a new count.',
        );
      }

      const materials = await em.find(StockMaterialEntity, {
        where: { restaurantId },
        order: { name: 'ASC' },
      });
      const items = materials.map((m) => {
        const stock = Number(Number(m.currentStock ?? 0).toFixed(3));
        return {
          materialId: m.id,
          materialName: m.name,
          expectedStock: stock,
          actualStock: stock,
          difference: 0,
        };
      });
      const entity = em.create(InventoryCountEntity, {
        restaurantId,
        date: new Date(),
        countedBy: (countedBy || '').trim() || 'System',
        items,
        status: 'in-progress',
        notes: null,
      });
      return em.save(InventoryCountEntity, entity);
    });
  }

  async updateItem(
    restaurantId: string,
    countId: string,
    materialId: string,
    actual: number,
  ) {
    const actualNum = Number(actual);
    if (!Number.isFinite(actualNum) || actualNum < 0) {
      throw new BadRequestException(
        'Inventory count quantity must be a non-negative number.',
      );
    }
    const safeActual = Number(actualNum.toFixed(3));

    return this.dataSource.transaction(async (em) => {
      const count = await em.findOne(InventoryCountEntity, {
        where: { id: countId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!count) throw new NotFoundException('Inventory count record not found.');
      if (count.status === 'completed') {
        throw new BadRequestException(
          'Completed inventory count cannot be updated.',
        );
      }

      const material = await em.findOne(StockMaterialEntity, {
        where: { id: materialId, restaurantId },
      });
      if (!material) {
        throw new NotFoundException('Stock material not found.');
      }

      const liveExpected = Number(Number(material.currentStock ?? 0).toFixed(3));
      let found = false;
      const items = count.items.map((it) => {
        if (it.materialId === materialId) {
          found = true;
          return {
            ...it,
            materialName: material.name,
            expectedStock: liveExpected,
            actualStock: safeActual,
            difference: Number((safeActual - liveExpected).toFixed(3)),
          };
        }
        return it;
      });

      if (!found) {
        throw new NotFoundException(
          'Stock material not found in this inventory count.',
        );
      }

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

      const allMaterialIds = [
        ...new Set(count.items.map((i) => i.materialId).filter(Boolean)),
      ].sort();

      const lockedMaterials = allMaterialIds.length
        ? await em.find(StockMaterialEntity, {
            where: { id: In(allMaterialIds), restaurantId },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
          })
        : [];
      const materialById = new Map(lockedMaterials.map((m) => [m.id, m]));

      const updatedItems: InventoryCountEntity['items'] = [];

      for (const item of count.items) {
        const material = materialById.get(item.materialId);
        if (!material) continue;
        const liveExpected = Number(
          Number(material.currentStock ?? 0).toFixed(3),
        );
        const actualStock = Math.max(
          0,
          Number(Number(item.actualStock ?? 0).toFixed(3)),
        );
        const diff = Number((actualStock - liveExpected).toFixed(3));
        updatedItems.push({
          materialId: material.id,
          materialName: material.name,
          expectedStock: liveExpected,
          actualStock,
          difference: diff,
        });
      }

      const sortedAdjustments = [...updatedItems]
        .filter((i) => i.difference !== 0)
        .sort((a, b) => a.materialId.localeCompare(b.materialId));

      for (const item of sortedAdjustments) {
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
