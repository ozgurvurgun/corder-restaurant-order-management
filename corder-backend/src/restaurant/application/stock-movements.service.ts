import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovementEntity } from '../domain/stock-movement.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';

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
    @InjectRepository(StockMaterialEntity)
    private readonly materials: Repository<StockMaterialEntity>,
  ) {}

  list(restaurantId: string, limit = 200) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async create(restaurantId: string, dto: CreateStockMovementDto) {
    if (dto.quantity <= 0) throw new BadRequestException('Miktar pozitif olmalıdır.');

    return await this.repo.manager.transaction(async (em) => {
      const material = await em.findOne(StockMaterialEntity, {
        where: { id: dto.materialId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!material) throw new NotFoundException('Malzeme bulunamadı.');

      const prev = Number(material.currentStock ?? 0);
      let next = prev;
      if (dto.type === 'in') {
        next = prev + dto.quantity;
      } else {
        next = Math.max(0, prev - dto.quantity);
      }

      material.currentStock = next;
      await em.save(StockMaterialEntity, material);

      const movement = em.create(StockMovementEntity, {
        restaurantId,
        materialId: material.id,
        materialName: dto.materialName ?? material.name,
        type: dto.type,
        quantity: dto.quantity,
        previousStock: prev,
        newStock: next,
        unitCost: dto.unitCost ?? null,
        totalCost: dto.totalCost ?? null,
        supplierId: dto.supplierId ?? null,
        reason: dto.reason ?? null,
        createdBy: dto.createdBy,
      });
      return em.save(StockMovementEntity, movement);
    });
  }
}

