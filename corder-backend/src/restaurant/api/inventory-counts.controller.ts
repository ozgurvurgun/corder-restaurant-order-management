import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { InventoryCountsService } from '../application/inventory-counts.service';

@Controller('restaurant/inventory-counts')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class InventoryCountsController {
  constructor(private readonly inventoryCounts: InventoryCountsService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.inventoryCounts.list(restaurantId);
  }

  @Post()
  start(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
  ) {
    return this.inventoryCounts.start(restaurantId, user.name);
  }

  @Post(':id/items')
  updateItem(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body() body: { materialId: string; actual: number },
  ) {
    return this.inventoryCounts.updateItem(
      restaurantId,
      id,
      body.materialId,
      body.actual,
    );
  }

  @Post(':id/complete')
  complete(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id') id: string,
  ) {
    return this.inventoryCounts.complete(restaurantId, id, user.name);
  }
}
