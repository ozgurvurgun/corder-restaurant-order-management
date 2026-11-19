import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { InventoryCountsService } from '../application/inventory-counts.service';
import { UpdateInventoryCountItemDto } from './dto/update-inventory-count-item.dto';

@Controller('restaurant/inventory-counts')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class InventoryCountsController {
  constructor(private readonly inventoryCounts: InventoryCountsService) {}

  @Get()
  @RequirePermissions('inventory.view', 'inventory.count_adjust')
  list(@RestaurantId() restaurantId: string) {
    return this.inventoryCounts.list(restaurantId);
  }

  @Post()
  @RequirePermissions('inventory.count_adjust')
  start(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
  ) {
    return this.inventoryCounts.start(restaurantId, user.name);
  }

  @Post(':id/items')
  @RequirePermissions('inventory.count_adjust')
  updateItem(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInventoryCountItemDto,
  ) {
    return this.inventoryCounts.updateItem(
      restaurantId,
      id,
      body.materialId,
      body.actual,
    );
  }

  @Post(':id/complete')
  @RequirePermissions('inventory.count_adjust')
  complete(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryCounts.complete(restaurantId, id, user.name);
  }

  @Delete(':id')
  @RequirePermissions('inventory.count_adjust')
  cancel(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryCounts.cancel(restaurantId, id);
  }
}
