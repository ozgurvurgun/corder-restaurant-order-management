import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PurchaseOrderEntity } from '../domain/purchase-order.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { StockMovementsService } from './stock-movements.service';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderItemInputDto,
} from '../api/dto/create-purchase-order.dto';

export type PurchaseOrderItemInput = PurchaseOrderItemInputDto;
export { CreatePurchaseOrderDto };

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly repo: Repository<PurchaseOrderEntity>,
    private readonly stockMovements: StockMovementsService,
    private readonly dataSource: DataSource,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  create(
    restaurantId: string,
    dto: CreatePurchaseOrderDto & { createdBy: string },
  ) {
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
      0,
    );
    const entity = this.repo.create({
      restaurantId,
      supplierId: dto.supplierId,
      supplierName: dto.supplierName,
      items: dto.items,
      totalAmount: Number(totalAmount.toFixed(4)),
      status: dto.status ?? 'ordered',
      notes: dto.notes ?? null,
      createdBy: dto.createdBy,
    });
    return this.repo.save(entity);
  }

  async markReceived(restaurantId: string, id: string, userName: string) {
    return this.dataSource.transaction(async (em) => {
      const po = await em.findOne(PurchaseOrderEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!po) throw new NotFoundException('Purchase order not found.');
      if (po.status === 'received') return po;

      const sortedMaterialIds = [
        ...new Set(po.items.map((item) => item.materialId)),
      ].sort();
      if (sortedMaterialIds.length > 0) {
        await em.find(StockMaterialEntity, {
          where: { id: In(sortedMaterialIds), restaurantId },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      }

      for (const item of po.items) {
        const qty = Number(item.quantity);
        const unitCost = Number(item.unitCost);
        await this.stockMovements.applyMovement(em, restaurantId, {
          materialId: item.materialId,
          materialName: item.materialName,
          type: 'in',
          quantity: qty,
          unitCost,
          totalCost: Number((qty * unitCost).toFixed(4)),
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
