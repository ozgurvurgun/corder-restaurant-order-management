import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { CampaignEntity } from '../../restaurant/domain/campaign.entity';

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

  async getBusinessBySlug(slug: string | null, forTerminal = false): Promise<MenuBusinessDto> {
    if (!slug?.trim()) throw new NotFoundException('restaurant query is required');
    const restaurant = await this.restaurantRepo.findOne({ where: { slug: slug.trim(), status: 'active' } });
    if (!restaurant) throw new NotFoundException('Business not found');

    const allCats = await this.categoryRepo.find({
      where: { restaurantId: restaurant.id },
      order: { order: 'ASC', name: 'ASC' },
    });

    /** Categories explicitly enabled for menu/terminal */
    const baseVisible = new Set(
      allCats
        .filter((c) => (forTerminal ? c.showInTerminal : c.showInMenu))
        .map((c) => c.id),
    );
    /**
     * Also include all descendants of those categories so subcategories stay in sync
     * with the parent (a product under a subcategory was invisible if only the
     * parent had showInMenu and the child did not).
     */
    const visible = new Set(baseVisible);
    const addDescendants = (parentId: string) => {
      for (const c of allCats) {
        if (c.parentId === parentId && !visible.has(c.id)) {
          visible.add(c.id);
          addDescendants(c.id);
        }
      }
    };
    for (const id of baseVisible) addDescendants(id);

    const roots = allCats
      .filter((c) => {
        if (!visible.has(c.id)) return false;
        if (!c.parentId) return true;
        return !visible.has(c.parentId);
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    const idsForProducts = new Set<string>();
    const walkCollect = (c: CategoryEntity) => {
      if (!visible.has(c.id)) return;
      idsForProducts.add(c.id);
      const children = allCats.filter((x) => x.parentId === c.id && visible.has(x.id));
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
      const catProducts = products.filter((p) => p.categoryId === c.id).map(mapProduct);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        products: catProducts,
        children,
      };
    };

    const categories = roots.map(buildNode);

    const campaigns = await this.campaignRepo.find({
      where: { restaurantId: restaurant.id, isActive: true },
      order: { order: 'ASC' },
    });

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
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description ?? undefined,
        imageUrl: c.imageUrl,
        discountPercent: c.discountPercent ?? undefined,
        originalPrice: c.originalPrice != null ? Number(c.originalPrice) : undefined,
        discountedPrice: c.discountedPrice != null ? Number(c.discountedPrice) : undefined,
        validUntil: c.validUntil?.toISOString(),
        isActive: c.isActive,
      })),
    };
  }
}
