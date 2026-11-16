import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { StockMovementsService } from '../application/stock-movements.service';

@Controller('restaurant/stock/movements')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  @Get()
  list(
    @RestaurantId() restaurantId: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 200;
    return this.movements.list(restaurantId, take);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Body()
    body: {
      materialId: string;
      materialName?: string;
      type: 'in' | 'out' | 'waste' | 'count-adjustment';
      quantity: number;
      unitCost?: number;
      totalCost?: number;
      supplierId?: string;
      reason?: string;
      createdBy?: string;
    },
  ) {
    return this.movements.create(restaurantId, {
      ...body,
      createdBy: body.createdBy ?? user.name,
    });
  }
}
