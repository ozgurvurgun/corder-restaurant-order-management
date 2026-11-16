import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from '../application/product.service';
import { PermissionKey } from '../domain/permissions.catalog';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/products')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class ProductsController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @RequirePermissions('catalog.view', 'order.view', 'order.create')
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
  }

  @Get(':id')
  @RequirePermissions('catalog.view', 'order.view', 'order.create')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
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
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { isBoss?: boolean; permissions?: PermissionKey[] },
    @Body() dto: UpdateProductDto,
  ) {
    if (!user.isBoss) {
      const perms = user.permissions ?? [];
      if (dto.price !== undefined && !perms.includes('catalog.change_price') && !perms.includes('catalog.manage_products')) {
        throw new ForbiddenException('You do not have permission to change product prices (catalog.change_price)');
      }
      const touchesContent =
        dto.name !== undefined ||
        dto.description !== undefined ||
        dto.imageUrl !== undefined ||
        dto.ingredients !== undefined;
      if (touchesContent && !perms.includes('catalog.manage_products')) {
        throw new ForbiddenException('You do not have permission to edit product content (catalog.manage_products)');
      }
    }
    return this.service.update(id, restaurantId, dto);
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage_products')
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
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
