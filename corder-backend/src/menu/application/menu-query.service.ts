import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  RestaurantEntity,
  RestaurantMenuTemplate,
} from '../../platform/domain/restaurant.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { CampaignEntity } from '../../restaurant/domain/campaign.entity';
import { TableEntity } from '../../restaurant/domain/table.entity';
import {
  WaiterCallEntity,
  WaiterCallRequestType,
} from '../../restaurant/domain/waiter-call.entity';
import { isRestaurantPaymentSuspended } from '../../restaurant/domain/services/billing-suspension.policy';
import { TableQrTokenPolicy } from '../../restaurant/domain/services/table-qr-token.policy';
import { OrdersGateway } from '../../restaurant/api/orders.gateway';
import {
  buildMenuCategoryTree,
  isCampaignValidNow,
  MenuCategoryTreeDto,
  MenuProductRow,
  resolveVisibleCategoryIds,
} from '../domain/menu-tree.policy';

export type { MenuCategoryTreeDto, MenuProductRow };

export interface MenuTableContextDto {
  tableId: string;
  tableName: string;
  sectionName: string;
  tableToken: string;
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
  logoUrl?: string | null;
  menuTemplate?: RestaurantMenuTemplate;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  restaurant?: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    menuTemplate: RestaurantMenuTemplate;
    address: string | null;
    phone: string | null;
    workingHours: string | null;
  };
  tableContext?: MenuTableContextDto | null;
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
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(WaiterCallEntity)
    private readonly waiterCallRepo: Repository<WaiterCallEntity>,
    @Inject(forwardRef(() => OrdersGateway))
    private readonly ordersGateway: OrdersGateway,
  ) {}

  private async resolveActiveRestaurantBySlug(
    slug: string | null,
  ): Promise<RestaurantEntity> {
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
    return restaurant;
  }

  isCampaignCurrentlyValid(
    validUntil: Date | string | null | undefined,
    now: Date = new Date(),
  ): boolean {
    return isCampaignValidNow(validUntil, now);
  }

  async getBusinessBySlug(
    slug: string | null,
    tableToken?: string,
  ): Promise<MenuBusinessDto> {
    const restaurant = await this.resolveActiveRestaurantBySlug(slug);
    return this.buildMenuDto(restaurant, false, tableToken);
  }

  async callWaiter(
    slug: string | null,
    dto: {
      tableToken?: string;
      requestType?: WaiterCallRequestType;
      note?: string;
    },
  ) {
    const restaurant = await this.resolveActiveRestaurantBySlug(slug);
    const token = (dto?.tableToken ?? '').trim();
    if (!token) {
      throw new BadRequestException('Geçersiz masa QR kodu');
    }

    const tables = await this.tableRepo.find({
      where: { restaurantId: restaurant.id },
    });
    const matched = TableQrTokenPolicy.findMatchingTable(
      restaurant.id,
      token,
      tables,
    );
    if (!matched) {
      throw new BadRequestException('Geçersiz masa QR kodu');
    }

    const recentCall = await this.waiterCallRepo.findOne({
      where: {
        restaurantId: restaurant.id,
        tableId: matched.id,
        createdAt: MoreThanOrEqual(new Date(Date.now() - 20_000)),
      },
      order: { createdAt: 'DESC' },
    });
    if (recentCall) {
      throw new BadRequestException(
        'Talebiniz zaten iletildi. Lütfen 20 saniye bekleyin.',
      );
    }

    const requestType: WaiterCallRequestType =
      dto.requestType === 'bill' ? 'bill' : 'waiter';
    const note = dto.note?.trim().slice(0, 255) || null;

    const saved = await this.waiterCallRepo.save(
      this.waiterCallRepo.create({
        restaurantId: restaurant.id,
        tableId: matched.id,
        tableName: matched.name,
        sectionName: matched.section || null,
        requestType,
        note,
        acknowledged: false,
      }),
    );

    const payload = {
      id: saved.id,
      restaurantId: saved.restaurantId,
      tableId: saved.tableId,
      tableName: saved.tableName,
      sectionName: saved.sectionName,
      requestType: saved.requestType,
      note: saved.note,
      createdAt: saved.createdAt.toISOString(),
    };

    this.ordersGateway.emitWaiterCalled(restaurant.id, payload);
    this.ordersGateway.emitNotificationsUpdated(restaurant.id);

    return {
      ok: true,
      ...payload,
    };
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
    tableToken?: string,
  ): Promise<MenuBusinessDto> {
    const cleanToken = (tableToken ?? '').trim();
    const [allCats, rawCampaigns, tables] = await Promise.all([
      this.categoryRepo.find({
        where: { restaurantId: restaurant.id },
        order: { order: 'ASC', name: 'ASC' },
      }),
      this.campaignRepo.find({
        where: { restaurantId: restaurant.id, isActive: true },
        order: { order: 'ASC' },
      }),
      cleanToken
        ? this.tableRepo.find({ where: { restaurantId: restaurant.id } })
        : Promise.resolve([] as TableEntity[]),
    ]);

    const matchedTable = cleanToken
      ? TableQrTokenPolicy.findMatchingTable(restaurant.id, cleanToken, tables)
      : null;

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
      this.isCampaignCurrentlyValid(c.validUntil, now),
    );

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.menuAddress ?? undefined,
      phone: restaurant.menuPhone ?? undefined,
      workingHours: restaurant.workingHours ?? undefined,
      logo: restaurant.logoUrl ?? undefined,
      logoUrl: restaurant.logoUrl ?? null,
      menuTemplate: (restaurant.menuTemplate as RestaurantMenuTemplate) || 'classic',
      whatsapp: restaurant.whatsapp ?? undefined,
      instagram: restaurant.instagram ?? undefined,
      facebook: restaurant.facebook ?? undefined,
      website: restaurant.website ?? undefined,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logoUrl: restaurant.logoUrl ?? null,
        menuTemplate: (restaurant.menuTemplate as RestaurantMenuTemplate) || 'classic',
        address: restaurant.menuAddress ?? null,
        phone: restaurant.menuPhone ?? null,
        workingHours: restaurant.workingHours ?? null,
      },
      tableContext: matchedTable
        ? {
            tableId: matchedTable.id,
            tableName: matchedTable.name,
            sectionName: matchedTable.section,
            tableToken: cleanToken,
          }
        : null,
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
