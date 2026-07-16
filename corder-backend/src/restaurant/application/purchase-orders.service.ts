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
    const po = await this.repo.findOne({ where: { id, restaurantId } });
    if (!po) throw new NotFoundException('Satın alma kaydı bulunamadı.');
    if (po.status === 'received') return po;

    for (const item of po.items) {
      await this.stockMovements.create(restaurantId, {
        materialId: item.materialId,
        materialName: item.materialName,
        type: 'in',
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.quantity * item.unitCost,
        supplierId: po.supplierId,
        createdBy: userName,
        reason: `Satın alma: ${po.supplierName}`,
      });
    }

    po.status = 'received';
    po.receivedAt = new Date();
    return this.repo.save(po);
  }
}

