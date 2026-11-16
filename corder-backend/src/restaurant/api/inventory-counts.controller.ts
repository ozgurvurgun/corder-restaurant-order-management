import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { InventoryCountsService } from '../application/inventory-counts.service';
import { UpdateInventoryCountItemDto } from './dto/update-inventory-count-item.dto';

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
  complete(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryCounts.complete(restaurantId, id, user.name);
  }
}
