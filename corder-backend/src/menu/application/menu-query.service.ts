import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { CampaignEntity } from '../../restaurant/domain/campaign.entity';
import { isRestaurantPaymentSuspended } from '../../restaurant/domain/services/billing-suspension.policy';
import {
  buildMenuCategoryTree,
  isCampaignValidNow,
  MenuCategoryTreeDto,
  MenuProductRow,
  resolveVisibleCategoryIds,
} from '../domain/menu-tree.policy';

export type { MenuCategoryTreeDto, MenuProductRow };

export interface MenuBusinessDto {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  logo?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  categories: MenuCategoryTreeDto[];
  campaigns: {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    discountPercent?: number;
    originalPrice?: number;
    discountedPrice?: number;
    validUntil?: string;
    isActive: boolean;
  }[];
}

@Injectable()
export class MenuQueryService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepo: Repository<CampaignEntity>,
  ) {}

  async getBusinessBySlug(slug: string | null): Promise<MenuBusinessDto> {
    const normalizedSlug = slug?.trim();
    if (!normalizedSlug) {
      throw new NotFoundException('restaurant query is required');
    }
    const restaurant =
      (await this.restaurantRepo.findOne({
        where: { slug: normalizedSlug, status: 'active' },
      })) ??
      (await this.restaurantRepo.findOne({
        where: { slug: normalizedSlug.toLowerCase(), status: 'active' },
      }));
    if (!restaurant || isRestaurantPaymentSuspended(restaurant)) {
      throw new NotFoundException('Business not found');
    }
    return this.buildMenuDto(restaurant, false);
  }

  async getTerminalMenuByRestaurantId(restaurantId: string): Promise<MenuBusinessDto> {
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId, status: 'active' },
    });
    if (!restaurant || isRestaurantPaymentSuspended(restaurant)) {
      throw new NotFoundException('Business not found');
    }
    return this.buildMenuDto(restaurant, true);
  }

  private async buildMenuDto(
    restaurant: RestaurantEntity,
    forTerminal: boolean,
  ): Promise<MenuBusinessDto> {
    const [allCats, rawCampaigns] = await Promise.all([
      this.categoryRepo.find({
        where: { restaurantId: restaurant.id },
        order: { order: 'ASC', name: 'ASC' },
      }),
      this.campaignRepo.find({
        where: { restaurantId: restaurant.id, isActive: true },
        order: { order: 'ASC' },
      }),
    ]);

    const { visibleIds, roots, productCategoryIds } = resolveVisibleCategoryIds(
      allCats,
      forTerminal,
    );
    const products = productCategoryIds.length
      ? await this.productRepo.find({
          where: { categoryId: In(productCategoryIds) },
          order: { order: 'ASC', name: 'ASC' },
        })
      : [];

    const categories = buildMenuCategoryTree(allCats, visibleIds, roots, products);
    const now = new Date();
    const activeCampaigns = rawCampaigns.filter((c) =>
      isCampaignValidNow(c.validUntil, now),
    );

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.menuAddress ?? undefined,
      phone: restaurant.menuPhone ?? undefined,
      workingHours: restaurant.workingHours ?? undefined,
      whatsapp: restaurant.whatsapp ?? undefined,
      instagram: restaurant.instagram ?? undefined,
      facebook: restaurant.facebook ?? undefined,
      website: restaurant.website ?? undefined,
      categories,
      campaigns: activeCampaigns.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description ?? undefined,
        imageUrl: c.imageUrl,
        discountPercent: c.discountPercent ?? undefined,
        originalPrice: c.originalPrice != null ? Number(c.originalPrice) : undefined,
        discountedPrice:
          c.discountedPrice != null ? Number(c.discountedPrice) : undefined,
        validUntil: c.validUntil?.toISOString(),
        isActive: c.isActive,
      })),
    };
  }
}
