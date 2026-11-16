import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrderEntity } from '../domain/purchase-order.entity';
import { StockMovementsService } from './stock-movements.service';

export interface PurchaseOrderItemInput {
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderDto {
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItemInput[];
  notes?: string;
  status?: 'draft' | 'ordered';
  createdBy: string;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly repo: Repository<PurchaseOrderEntity>,
    private readonly stockMovements: StockMovementsService,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  create(restaurantId: string, dto: CreatePurchaseOrderDto) {
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );
    const entity = this.repo.create({
      restaurantId,
      supplierId: dto.supplierId,
      supplierName: dto.supplierName,
      items: dto.items,
      totalAmount,
      status: dto.status ?? 'ordered',
      notes: dto.notes ?? null,
      createdBy: dto.createdBy,
    });
    return this.repo.save(entity);
  }

  async markReceived(restaurantId: string, id: string, userName: string) {
    return this.repo.manager.transaction(async (em) => {
      const po = await em.findOne(PurchaseOrderEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!po) throw new NotFoundException('Purchase order not found.');
      if (po.status === 'received') return po;

      for (const item of po.items) {
        const qty = Number(item.quantity);
        const unitCost = Number(item.unitCost);
        await this.stockMovements.applyMovement(em, restaurantId, {
          materialId: item.materialId,
          materialName: item.materialName,
          type: 'in',
          quantity: qty,
          unitCost,
          totalCost: qty * unitCost,
          supplierId: po.supplierId,
          createdBy: userName,
          reason: `Purchase order: ${po.supplierName}`,
        });
      }

      po.status = 'received';
      po.receivedAt = new Date();
      return em.save(PurchaseOrderEntity, po);
    });
  }
}
