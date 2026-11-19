import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { StockMaterialsService } from '../application/stock-materials.service';
import { CreateStockMaterialDto } from './dto/create-stock-material.dto';
import { UpdateStockMaterialDto } from './dto/update-stock-material.dto';

@Controller('restaurant/stock/materials')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class StockMaterialsController {
  constructor(private readonly materials: StockMaterialsService) {}

  @Get()
  @RequirePermissions(
    'inventory.view',
    'catalog.view',
    'catalog.manage_products',
  )
  list(@RestaurantId() restaurantId: string) {
    return this.materials.list(restaurantId);
  }

  @Post()
  @RequirePermissions('inventory.manage_materials')
  create(
    @RestaurantId() restaurantId: string,
    @Body() body: CreateStockMaterialDto,
  ) {
    return this.materials.create(restaurantId, body);
  }

  @Patch(':id')
  @RequirePermissions('inventory.manage_materials')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStockMaterialDto,
    @RestaurantUser() user?: { name?: string },
  ) {
    return this.materials.update(restaurantId, id, body, user?.name);
  }

  @Delete(':id')
  @RequirePermissions('inventory.manage_materials')
  remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materials.remove(restaurantId, id);
  }
}
