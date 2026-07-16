import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierEntity } from '../domain/supplier.entity';

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
      name: dto.name,
      contactPerson: dto.contactPerson ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      notes: dto.notes ?? null,
      active: true,
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdateSupplierDto) {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Tedarikçi bulunamadı.');
    if (dto.name != null) entity.name = dto.name;
    if (dto.contactPerson !== undefined) entity.contactPerson = dto.contactPerson ?? null;
    if (dto.phone !== undefined) entity.phone = dto.phone ?? null;
    if (dto.email !== undefined) entity.email = dto.email ?? null;
    if (dto.address !== undefined) entity.address = dto.address ?? null;
    if (dto.notes !== undefined) entity.notes = dto.notes ?? null;
    if (dto.active !== undefined) entity.active = dto.active;
    return this.repo.save(entity);
  }

  async remove(restaurantId: string, id: string) {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) return;
    await this.repo.remove(entity);
  }
}

