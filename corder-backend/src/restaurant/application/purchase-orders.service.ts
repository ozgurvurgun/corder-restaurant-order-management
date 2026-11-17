import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PurchaseOrderEntity } from '../domain/purchase-order.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { SupplierEntity } from '../domain/supplier.entity';
import { StockMovementsService } from './stock-movements.service';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderItemInputDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from '../api/dto/create-purchase-order.dto';

export type PurchaseOrderItemInput = PurchaseOrderItemInputDto;
export {
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly repo: Repository<PurchaseOrderEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(StockMaterialEntity)
    private readonly materialRepo: Repository<StockMaterialEntity>,
    private readonly stockMovements: StockMovementsService,
    private readonly dataSource: DataSource,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  private async validateAndNormalizeItems(
    restaurantId: string,
    rawItems: PurchaseOrderItemInputDto[],
  ): Promise<{
    items: {
      materialId: string;
      materialName: string;
      quantity: number;
      unitCost: number;
    }[];
    totalAmount: number;
  }> {
    if (!rawItems?.length) {
      throw new BadRequestException(
        'Purchase order must contain at least one item.',
      );
    }
    const uniqueMaterialIds = [
      ...new Set(rawItems.map((i) => i.materialId)),
    ];
    const materials = await this.materialRepo.find({
      where: { id: In(uniqueMaterialIds), restaurantId },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));
    if (materialById.size !== uniqueMaterialIds.length) {
      throw new BadRequestException(
        'One or more stock materials do not exist or do not belong to this restaurant.',
      );
    }

    const byMaterial = new Map<
      string,
      { materialId: string; materialName: string; quantity: number; totalCost: number }
    >();

    for (const row of rawItems) {
      const mat = materialById.get(row.materialId)!;
      const qty = Number(Number(row.quantity).toFixed(3));
      const unitCost = Number(Number(row.unitCost).toFixed(4));
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException('Purchase order item quantity must be positive.');
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new BadRequestException('Purchase order item unit cost cannot be negative.');
      }
      const existing = byMaterial.get(mat.id);
      if (existing) {
        existing.quantity = Number((existing.quantity + qty).toFixed(3));
        existing.totalCost += qty * unitCost;
      } else {
        byMaterial.set(mat.id, {
          materialId: mat.id,
          materialName: mat.name,
          quantity: qty,
          totalCost: qty * unitCost,
        });
      }
    }

    const normalizedItems = [...byMaterial.values()].map((entry) => ({
      materialId: entry.materialId,
      materialName: entry.materialName,
      quantity: entry.quantity,
      unitCost: Number((entry.totalCost / entry.quantity).toFixed(4)),
    }));

    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    return {
      items: normalizedItems,
      totalAmount: Number(totalAmount.toFixed(4)),
    };
  }

  async create(
    restaurantId: string,
    dto: CreatePurchaseOrderDto & { createdBy: string },
  ) {
    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId, restaurantId },
    });
    if (!supplier) {
      throw new NotFoundException(
        'Supplier not found or does not belong to this restaurant.',
      );
    }

    const { items, totalAmount } = await this.validateAndNormalizeItems(
      restaurantId,
      dto.items,
    );

    const entity = this.repo.create({
      restaurantId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items,
      totalAmount,
      status: dto.status ?? 'ordered',
      notes: dto.notes?.trim() || null,
      createdBy: (dto.createdBy || '').trim() || 'System',
    });
    return this.repo.save(entity);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    const po = await this.repo.findOne({ where: { id, restaurantId } });
    if (!po) throw new NotFoundException('Purchase order not found.');
    if (po.status === 'received') {
      throw new BadRequestException(
        'Received purchase order cannot be modified.',
      );
    }
    if (po.status === 'cancelled' && dto.status !== 'cancelled') {
      throw new BadRequestException(
        'Cancelled purchase order cannot be reopened.',
      );
    }

    if (dto.items !== undefined) {
      if (po.status !== 'draft') {
        throw new BadRequestException(
          'Items can only be edited while purchase order is in draft status.',
        );
      }
      const { items, totalAmount } = await this.validateAndNormalizeItems(
        restaurantId,
        dto.items,
      );
      po.items = items;
      po.totalAmount = totalAmount;
    }

    if (dto.notes !== undefined) {
      po.notes = dto.notes?.trim() || null;
    }
    if (dto.status !== undefined) {
      po.status = dto.status;
    }
    return this.repo.save(po);
  }

  async cancel(restaurantId: string, id: string) {
    return this.update(restaurantId, id, { status: 'cancelled' });
  }

  async markReceived(
    restaurantId: string,
    id: string,
    userName: string,
    receiveDto?: ReceivePurchaseOrderDto,
  ) {
    return this.dataSource.transaction(async (em) => {
      const po = await em.findOne(PurchaseOrderEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!po) throw new NotFoundException('Purchase order not found.');
      if (po.status === 'cancelled') {
        throw new BadRequestException(
          'Cancelled purchase order cannot be received.',
        );
      }
      if (po.status === 'received') return po;

      const overrideByMaterialId = new Map(
        (receiveDto?.items ?? []).map((i) => [i.materialId, i]),
      );

      const effectiveItems = po.items.map((item) => {
        const override = overrideByMaterialId.get(item.materialId);
        const qty =
          override?.quantity != null
            ? Number(Number(override.quantity).toFixed(3))
            : Number(item.quantity);
        const unitCost =
          override?.unitCost != null
            ? Number(Number(override.unitCost).toFixed(4))
            : Number(item.unitCost);
        return {
          materialId: item.materialId,
          materialName: item.materialName,
          quantity: Math.max(0, qty),
          unitCost: Math.max(0, unitCost),
        };
      });

      const itemsToReceive = effectiveItems.filter((i) => i.quantity > 0);
      if (!itemsToReceive.length) {
        throw new BadRequestException(
          'At least one item with positive quantity is required to receive a purchase order.',
        );
      }

      const sortedMaterialIds = [
        ...new Set(itemsToReceive.map((item) => item.materialId)),
      ].sort();
      if (sortedMaterialIds.length > 0) {
        await em.find(StockMaterialEntity, {
          where: { id: In(sortedMaterialIds), restaurantId },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const sortedItems = [...itemsToReceive].sort((a, b) =>
        a.materialId.localeCompare(b.materialId),
      );
      for (const item of sortedItems) {
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

      if (receiveDto?.items?.length) {
        po.items = effectiveItems;
        const newTotal = effectiveItems.reduce(
          (sum, it) => sum + it.quantity * it.unitCost,
          0,
        );
        po.totalAmount = Number(newTotal.toFixed(4));
      }
      if (receiveDto?.notes !== undefined) {
        po.notes = receiveDto.notes?.trim() || po.notes;
      }

      po.status = 'received';
      po.receivedAt = new Date();
      return em.save(PurchaseOrderEntity, po);
    });
  }
}
