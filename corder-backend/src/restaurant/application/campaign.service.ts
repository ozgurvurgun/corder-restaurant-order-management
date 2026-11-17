import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../domain/campaign.entity';

export interface CreateCampaignDto {
  title: string;
  description?: string | null;
  imageUrl: string;
  discountPercent?: number | null;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  validUntil?: Date | null;
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

  private assertValidPricing(
    originalPrice?: number | null,
    discountedPrice?: number | null,
  ): void {
    if (originalPrice != null && discountedPrice != null) {
      if (Number(discountedPrice) > Number(originalPrice)) {
        throw new BadRequestException(
          'Discounted price cannot exceed original price.',
        );
      }
    }
  }

  private parseValidUntil(date?: Date | null): Date | null {
    if (!date) return null;
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid campaign validity date.');
    }
    return date;
  }

  async create(
    restaurantId: string,
    dto: CreateCampaignDto,
  ): Promise<CampaignEntity> {
    const title = dto.title.trim();
    const imageUrl = dto.imageUrl.trim();
    if (!title || !imageUrl) {
      throw new BadRequestException('Campaign title and imageUrl are required.');
    }
    this.assertValidPricing(dto.originalPrice, dto.discountedPrice);
    const validUntil = this.parseValidUntil(dto.validUntil);

    const maxRow = await this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .select('MAX(c.order)', 'max')
      .getRawOne<{ max: string | number | null }>();
    const nextOrder = Number(maxRow?.max ?? 0) + 1;

    const entity = this.repo.create({
      restaurantId,
      title,
      description: dto.description?.trim() || null,
      imageUrl,
      discountPercent: dto.discountPercent ?? null,
      originalPrice:
        dto.originalPrice != null
          ? Number(Number(dto.originalPrice).toFixed(2))
          : null,
      discountedPrice:
        dto.discountedPrice != null
          ? Number(Number(dto.discountedPrice).toFixed(2))
          : null,
      validUntil,
      isActive: dto.isActive ?? true,
      order: nextOrder,
    } as Partial<CampaignEntity>);
    return this.repo.save(entity);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateCampaignDto,
  ): Promise<CampaignEntity> {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Campaign not found.');

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Campaign title cannot be empty.');
      entity.title = title;
    }
    if (dto.description !== undefined) {
      entity.description = (dto.description?.trim() || null) as string;
    }
    if (dto.imageUrl !== undefined) {
      const imageUrl = dto.imageUrl.trim();
      if (!imageUrl) {
        throw new BadRequestException('Campaign imageUrl cannot be empty.');
      }
      entity.imageUrl = imageUrl;
    }
    if (dto.discountPercent !== undefined) {
      entity.discountPercent = (dto.discountPercent ?? null) as number;
    }
    if (dto.originalPrice !== undefined) {
      entity.originalPrice = (
        dto.originalPrice != null
          ? Number(Number(dto.originalPrice).toFixed(2))
          : null
      ) as number;
    }
    if (dto.discountedPrice !== undefined) {
      entity.discountedPrice = (
        dto.discountedPrice != null
          ? Number(Number(dto.discountedPrice).toFixed(2))
          : null
      ) as number;
    }
    this.assertValidPricing(entity.originalPrice, entity.discountedPrice);

    if (dto.validUntil !== undefined) {
      entity.validUntil = this.parseValidUntil(dto.validUntil) as Date;
    }
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    return this.repo.save(entity);
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, restaurantId } });
    if (!entity) throw new NotFoundException('Campaign not found.');
    await this.repo.delete({ id: entity.id, restaurantId });
  }

  async reorder(restaurantId: string, ids: string[]): Promise<CampaignEntity[]> {
    const list = await this.repo.find({
      where: { restaurantId },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
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
    Array.from(map.values()).forEach((c) => {
      c.order = ordered.length + 1;
      ordered.push(c);
    });
    await this.repo.save(ordered);
    return ordered;
  }
}
