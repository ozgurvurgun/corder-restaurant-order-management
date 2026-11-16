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
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { StockMaterialsService } from '../application/stock-materials.service';
import { CreateStockMaterialDto } from './dto/create-stock-material.dto';
import { UpdateStockMaterialDto } from './dto/update-stock-material.dto';

@Controller('restaurant/stock/materials')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class StockMaterialsController {
  constructor(private readonly materials: StockMaterialsService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.materials.list(restaurantId);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @Body() body: CreateStockMaterialDto,
  ) {
    return this.materials.create(restaurantId, body);
  }

  @Patch(':id')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStockMaterialDto,
  ) {
    return this.materials.update(restaurantId, id, body);
  }

  @Delete(':id')
  remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materials.remove(restaurantId, id);
  }
}
