import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { CampaignEntity } from '../../restaurant/domain/campaign.entity';
import { isRestaurantPaymentSuspended } from '../../restaurant/domain/services/billing-suspension.policy';

export interface MenuProductRow {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
}

export interface MenuCategoryTreeDto {
  id: string;
  name: string;
  slug: string;
  products: MenuProductRow[];
  children: MenuCategoryTreeDto[];
}

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

/**
 * Checks whether a campaign's `validUntil` timestamp has not yet expired.
 * If `validUntil` was stored as a date-only midnight UTC timestamp (`00:00:00.000Z`),
 * it is treated as valid through the end of that calendar day in Europe/Istanbul (`23:59:59.999+03:00`).
 */
function isCampaignValidNow(validUntil: Date | null | undefined, now: Date): boolean {
  if (!validUntil) return true;
  const ts = validUntil.getTime();
  if (Number.isNaN(ts)) return false;
  if (
    validUntil.getUTCHours() === 0 &&
    validUntil.getUTCMinutes() === 0 &&
    validUntil.getUTCSeconds() === 0 &&
    validUntil.getUTCMilliseconds() === 0
  ) {
    // 00:00:00.000Z for YYYY-MM-DD -> end of day in Europe/Istanbul (UTC+3) is +20h 59m 59.999s
    const endOfDayIstanbulMs = ts + (21 * 3600 * 1000 - 1);
    return endOfDayIstanbulMs >= now.getTime();
  }
  return ts >= now.getTime();
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
    const allCats = await this.categoryRepo.find({
      where: { restaurantId: restaurant.id },
      order: { order: 'ASC', name: 'ASC' },
    });

    const catById = new Map(allCats.map((c) => [c.id, c]));
    const isFlagEnabled = (c: CategoryEntity) =>
      forTerminal ? Boolean(c.showInTerminal) : Boolean(c.showInMenu);

    /**
     * A category is visible if and only if its own flag (`showInMenu` / `showInTerminal`)
     * is enabled AND all of its existing ancestor categories also have the flag enabled.
     */
    const isCategoryVisible = (c: CategoryEntity): boolean => {
      let cur: CategoryEntity | undefined = c;
      const visited = new Set<string>();
      while (cur) {
        if (visited.has(cur.id)) return false;
        visited.add(cur.id);
        if (!isFlagEnabled(cur)) return false;
        cur = cur.parentId ? catById.get(cur.parentId) : undefined;
      }
      return true;
    };

    const visible = new Set(
      allCats.filter(isCategoryVisible).map((c) => c.id),
    );

    const roots = allCats
      .filter((c) => {
        if (!visible.has(c.id)) return false;
        if (!c.parentId || !catById.has(c.parentId)) return true;
        return false;
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    const idsForProducts = new Set<string>();
    const walkCollect = (c: CategoryEntity) => {
      if (!visible.has(c.id)) return;
      idsForProducts.add(c.id);
      const children = allCats.filter(
        (x) => x.parentId === c.id && visible.has(x.id),
      );
      children.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      for (const ch of children) walkCollect(ch);
    };
    roots.forEach(walkCollect);

    const products = idsForProducts.size
      ? await this.productRepo.find({
          where: { categoryId: In([...idsForProducts]) },
          order: { order: 'ASC', name: 'ASC' },
        })
      : [];

    const mapProduct = (p: ProductEntity): MenuProductRow => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      price: Number(p.price),
      imageUrl: p.imageUrl ?? undefined,
      inStock: p.inStock,
    });

    const buildNode = (c: CategoryEntity): MenuCategoryTreeDto => {
      const children = allCats
        .filter((ch) => ch.parentId === c.id && visible.has(ch.id))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(buildNode);
      const catProducts = products
        .filter((p) => p.categoryId === c.id)
        .map(mapProduct);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        products: catProducts,
        children,
      };
    };

    const categories = roots.map(buildNode);

    const rawCampaigns = await this.campaignRepo.find({
      where: { restaurantId: restaurant.id, isActive: true },
      order: { order: 'ASC' },
    });
    const now = new Date();
    const activeCampaigns = rawCampaigns.filter((c) =>
      isCampaignValidNow(c.validUntil, now),
    );

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.address ?? undefined,
      phone: restaurant.phone ?? undefined,
      email: restaurant.email ?? undefined,
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
        originalPrice:
          c.originalPrice != null ? Number(c.originalPrice) : undefined,
        discountedPrice:
          c.discountedPrice != null ? Number(c.discountedPrice) : undefined,
        validUntil: c.validUntil?.toISOString(),
        isActive: c.isActive,
      })),
    };
  }
}
