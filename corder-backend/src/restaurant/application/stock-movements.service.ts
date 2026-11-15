import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
      throw new BadRequestException('Miktar gecersiz.');
    }

    if (dto.type === 'count-adjustment') {
      if (rawQty === 0) {
        throw new BadRequestException('Sayim farki sifir olamaz.');
      }
    } else if (rawQty <= 0) {
      throw new BadRequestException('Miktar pozitif olmalidir.');
    }

    const material = await em.findOne(StockMaterialEntity, {
      where: { id: dto.materialId, restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!material) throw new NotFoundException('Malzeme bulunamadı.');

    const prev = Number(material.currentStock ?? 0);
    const qty = Number(rawQty.toFixed(3));
    let next: number;
    let recordedQuantity: number;

    if (dto.type === 'count-adjustment') {
      // diff > 0 increases stock, diff < 0 decreases stock; movement quantity matches stock delta sign.
      next = Number((prev + qty).toFixed(3));
      recordedQuantity = qty;
    } else if (dto.type === 'in') {
      next = Number((prev + qty).toFixed(3));
      recordedQuantity = qty;
    } else {
      next = Number((prev - qty).toFixed(3));
      recordedQuantity = qty;
    }

    material.currentStock = next;
    await em.save(StockMaterialEntity, material);

    const movement = em.create(StockMovementEntity, {
      restaurantId,
      materialId: material.id,
      materialName: dto.materialName ?? material.name,
      type: dto.type,
      quantity: recordedQuantity,
      previousStock: prev,
      newStock: next,
      unitCost: dto.unitCost ?? null,
      totalCost: dto.totalCost ?? null,
      supplierId: dto.supplierId ?? null,
      reason: dto.reason ?? null,
      createdBy: dto.createdBy,
    });
    return em.save(StockMovementEntity, movement);
  }

  async create(restaurantId: string, dto: CreateStockMovementDto) {
    return this.repo.manager.transaction((em) =>
      this.applyMovement(em, restaurantId, dto),
    );
  }
}
