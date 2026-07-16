import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export interface RestaurantSettingsDto {
  name: string;
  address?: string | null;
  phone?: string | null;
  taxId?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  workingHours?: string | null;
}

@Injectable()
export class RestaurantSettingsService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
  ) {}

  async get(restaurantId: string): Promise<RestaurantSettingsDto> {
    const r = await this.repo.findOne({ where: { id: restaurantId } });
    if (!r) {
      throw new Error('Restaurant not found');
    }
    return {
      name: r.name,
      address: r.address,
      phone: r.phone,
      taxId: r.taxId,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      website: r.website,
      workingHours: r.workingHours,
    };
  }

  async update(restaurantId: string, dto: Partial<RestaurantSettingsDto>): Promise<RestaurantSettingsDto> {
    const r = await this.repo.findOne({ where: { id: restaurantId } });
    if (!r) {
      throw new Error('Restaurant not found');
    }
    if (dto.name !== undefined) r.name = dto.name;
    if (dto.address !== undefined) r.address = dto.address ?? null as any;
    if (dto.phone !== undefined) r.phone = dto.phone ?? null as any;
    if (dto.taxId !== undefined) r.taxId = dto.taxId ?? null;
    if (dto.whatsapp !== undefined) r.whatsapp = dto.whatsapp ?? null;
    if (dto.instagram !== undefined) r.instagram = dto.instagram ?? null;
    if (dto.facebook !== undefined) r.facebook = dto.facebook ?? null;
    if (dto.website !== undefined) r.website = dto.website ?? null;
    if (dto.workingHours !== undefined) r.workingHours = dto.workingHours ?? null;
    await this.repo.save(r);
    return this.get(restaurantId);
  }
}

