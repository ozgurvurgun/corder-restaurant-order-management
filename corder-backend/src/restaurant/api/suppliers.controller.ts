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
import { SuppliersService } from '../application/suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('restaurant/suppliers')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.suppliers.list(restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() body: CreateSupplierDto) {
    return this.suppliers.create(restaurantId, body);
  }

  @Patch(':id')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSupplierDto,
  ) {
    return this.suppliers.update(restaurantId, id, body);
  }

  @Delete(':id')
  remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.suppliers.remove(restaurantId, id);
  }
}
