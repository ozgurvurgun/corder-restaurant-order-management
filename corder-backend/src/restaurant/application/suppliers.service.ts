import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SupplierEntity } from '../domain/supplier.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';

export interface CreateSupplierDto {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  active?: boolean;
}

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierEntity)
    private readonly repo: Repository<SupplierEntity>,
    private readonly dataSource: DataSource,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });
  }

  create(restaurantId: string, dto: CreateSupplierDto) {
    const entity = this.repo.create({
      restaurantId,
      name: dto.name.trim(),
      contactPerson: dto.contactPerson?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      address: dto.address?.trim() || null,
      notes: dto.notes?.trim() || null,
      active: true,
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdateSupplierDto) {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Supplier not found.');
    if (dto.name != null) entity.name = dto.name.trim();
    if (dto.contactPerson !== undefined) {
      entity.contactPerson = dto.contactPerson?.trim() || null;
    }
    if (dto.phone !== undefined) entity.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) entity.email = dto.email?.trim() || null;
    if (dto.address !== undefined) entity.address = dto.address?.trim() || null;
    if (dto.notes !== undefined) entity.notes = dto.notes?.trim() || null;
    if (dto.active !== undefined) entity.active = dto.active;
    return this.repo.save(entity);
  }

  async remove(restaurantId: string, id: string) {
    await this.dataSource.transaction(async (em) => {
      const entity = await em.findOne(SupplierEntity, {
        where: { id, restaurantId },
      });
      if (!entity) throw new NotFoundException('Supplier not found.');
      await em.update(
        StockMaterialEntity,
        { restaurantId, supplierId: id },
        { supplierId: null },
      );
      await em.remove(SupplierEntity, entity);
    });
  }
}
