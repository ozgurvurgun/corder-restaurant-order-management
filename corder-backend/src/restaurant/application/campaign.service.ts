import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../domain/campaign.entity';

export interface CreateCampaignDto {
  title: string;
  description?: string;
  imageUrl: string;
  discountPercent?: number;
  originalPrice?: number;
  discountedPrice?: number;
  validUntil?: Date;
  isActive?: boolean;
}

export interface UpdateCampaignDto extends Partial<CreateCampaignDto> {}

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly repo: Repository<CampaignEntity>,
  ) {}

  list(restaurantId: string): Promise<CampaignEntity[]> {
    return this.repo.find({
      where: { restaurantId },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(restaurantId: string, dto: CreateCampaignDto): Promise<CampaignEntity> {
    const count = await this.repo.count({ where: { restaurantId } });
    const entity = this.repo.create({
      restaurantId,
      title: dto.title,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl,
      discountPercent: dto.discountPercent ?? null,
      originalPrice: dto.originalPrice ?? null,
      discountedPrice: dto.discountedPrice ?? null,
      validUntil: dto.validUntil ?? null,
      isActive: dto.isActive ?? true,
      order: count + 1,
    } as Partial<CampaignEntity>);
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdateCampaignDto): Promise<CampaignEntity> {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Kampanya bulunamadı.');
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.imageUrl !== undefined) entity.imageUrl = dto.imageUrl;
    if (dto.discountPercent !== undefined) entity.discountPercent = dto.discountPercent;
    if (dto.originalPrice !== undefined) entity.originalPrice = dto.originalPrice;
    if (dto.discountedPrice !== undefined) entity.discountedPrice = dto.discountedPrice;
    if (dto.validUntil !== undefined) entity.validUntil = dto.validUntil;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    return this.repo.save(entity);
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Kampanya bulunamadı.');
    await this.repo.delete(entity.id);
  }

  async reorder(restaurantId: string, ids: string[]): Promise<CampaignEntity[]> {
    const list = await this.repo.find({ where: { restaurantId } });
    const map = new Map(list.map((c) => [c.id, c]));
    const ordered: CampaignEntity[] = [];
    ids.forEach((id, index) => {
      const c = map.get(id);
      if (c) {
        c.order = index + 1;
        ordered.push(c);
        map.delete(id);
      }
    });
    // append any missing campaigns at the end
    Array.from(map.values()).forEach((c) => {
      c.order = ordered.length + 1;
      ordered.push(c);
    });
    await this.repo.save(ordered);
    return ordered;
  }
}

