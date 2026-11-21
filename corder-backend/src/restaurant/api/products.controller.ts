import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from '../application/product.service';
import { ProductEntity } from '../domain/product.entity';
import { PermissionKey } from '../domain/permissions.catalog';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/products')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class ProductsController {
  constructor(private readonly service: ProductService) {}

  private sanitizeProductForCaller(
    product: ProductEntity,
    user?: { isBoss?: boolean; role?: string; permissions?: PermissionKey[] },
  ): ProductEntity {
    if (!user || user.isBoss || user.role === 'root') return product;
    const perms = user.permissions ?? [];
    const canSeeCostAndRecipe =
      perms.includes('catalog.view') ||
      perms.includes('catalog.manage_products') ||
      perms.includes('inventory.view') ||
      perms.includes('inventory.manage_materials');
    if (canSeeCostAndRecipe) return product;
    return Object.assign(new ProductEntity(), product, {
      costPrice: null,
      ingredients: null,
    });
  }

  @Get()
  @RequirePermissions('catalog.view', 'order.view', 'order.create')
  async findAll(
    @RestaurantId() restaurantId: string,
    @RestaurantUser()
    user: { isBoss?: boolean; role?: string; permissions?: PermissionKey[] },
  ) {
    const list = await this.service.findByRestaurant(restaurantId);
    return list.map((p) => this.sanitizeProductForCaller(p, user));
  }

  @Get(':id')
  @RequirePermissions('catalog.view', 'order.view', 'order.create')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser()
    user: { isBoss?: boolean; role?: string; permissions?: PermissionKey[] },
  ) {
    const product = await this.service.findOne(id, restaurantId);
    return this.sanitizeProductForCaller(product, user);
  }

  @Post()
  @RequirePermissions('catalog.manage_products')
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateProductDto) {
    return this.service.create(restaurantId, dto);
  }

  @Put(':id')
  @RequirePermissions(
    'catalog.manage_products',
    'catalog.change_price',
    'catalog.toggle_stock',
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { isBoss?: boolean; permissions?: PermissionKey[] },
    @Body() dto: UpdateProductDto,
  ) {
    if (!user.isBoss) {
      const perms = user.permissions ?? [];
      const canManage = perms.includes('catalog.manage_products');

      if (
        dto.price !== undefined &&
        !canManage &&
        !perms.includes('catalog.change_price')
      ) {
        throw new ForbiddenException(
          'You do not have permission to change product prices (catalog.change_price)',
        );
      }

      if (
        (dto.inStock !== undefined || dto.showInMenu !== undefined) &&
        !canManage &&
        !perms.includes('catalog.toggle_stock')
      ) {
        throw new ForbiddenException(
          'You do not have permission to toggle product stock or menu visibility (catalog.toggle_stock)',
        );
      }

      const touchesContent =
        dto.name !== undefined ||
        dto.description !== undefined ||
        dto.imageUrl !== undefined ||
        dto.ingredients !== undefined ||
        dto.categoryId !== undefined ||
        dto.costPrice !== undefined ||
        dto.order !== undefined;

      if (touchesContent && !canManage) {
        throw new ForbiddenException(
          'You do not have permission to edit product content (catalog.manage_products)',
        );
      }
    }
    return this.service.update(id, restaurantId, dto);
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage_products')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.service.remove(id, restaurantId);
  }

  @Post('reorder')
  @RequirePermissions('catalog.manage_products')
  reorder(
    @RestaurantId() restaurantId: string,
    @Body() body: ReorderItemsDto,
  ) {
    return this.service.reorder(restaurantId, body.ids ?? []);
  }
}
