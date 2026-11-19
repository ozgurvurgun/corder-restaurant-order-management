import {
  Body,
  Controller,
  Delete,
  Get,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from '../application/category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { OrdersGateway } from './orders.gateway';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/categories')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class CategoriesController {
  constructor(
    private readonly service: CategoryService,
    @Optional() private readonly ordersGateway?: OrdersGateway,
  ) {}

  @Get()
  @RequirePermissions('catalog.view', 'order.view', 'order.create')
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
  }

  @Get(':id')
  @RequirePermissions('catalog.view', 'order.view', 'order.create')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  @RequirePermissions('catalog.manage_categories')
  async create(@RestaurantId() restaurantId: string, @Body() dto: CreateCategoryDto) {
    const res = await this.service.create(restaurantId, dto);
    this.ordersGateway?.emitPrintersUpdated(restaurantId);
    return res;
  }

  @Put(':id')
  @RequirePermissions('catalog.manage_categories')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const res = await this.service.update(id, restaurantId, dto);
    this.ordersGateway?.emitPrintersUpdated(restaurantId);
    return res;
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage_categories')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
  ) {
    const res = await this.service.remove(id, restaurantId);
    this.ordersGateway?.emitPrintersUpdated(restaurantId);
    return res;
  }

  @Post('reorder')
  @RequirePermissions('catalog.manage_categories')
  reorder(
    @RestaurantId() restaurantId: string,
    @Body() body: ReorderCategoriesDto,
  ) {
    return this.service.reorder(restaurantId, body);
  }
}
