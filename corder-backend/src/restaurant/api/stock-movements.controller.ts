import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { StockMovementsService } from '../application/stock-movements.service';
import { CreateStockMovementBodyDto } from './dto/create-stock-movement.dto';

@Controller('restaurant/stock/movements')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  @Get()
  @RequirePermissions('inventory.view')
  list(
    @RestaurantId() restaurantId: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 200;
    return this.movements.list(restaurantId, take);
  }

  @Post()
  @RequirePermissions('inventory.stock_movement')
  create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Body() body: CreateStockMovementBodyDto,
  ) {
    return this.movements.create(restaurantId, {
      ...body,
      createdBy: user.name,
    });
  }
}
