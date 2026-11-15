import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  CompletedOrdersService,
  serializeCompletedOrder,
} from '../application/completed-orders.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { UpdateCompletedOrderDto } from './dto/update-completed-order.dto';

@Controller('restaurant/completed-orders')
@UseGuards(RestaurantJwtGuard)
export class CompletedOrdersController {
  constructor(private readonly service: CompletedOrdersService) {}

  @Get()
  async list(
    @RestaurantId() restaurantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('waiter') waiter?: string,
    @Query('tableName') tableName?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      waiter,
      tableName,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };
    const list = await this.service.list(restaurantId, filters);
    return list.map((c) => serializeCompletedOrder(c));
  }

  @Patch(':id')
  @UseGuards(PanelRootGuard)
  async update(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() dto: UpdateCompletedOrderDto,
  ) {
    const updated = await this.service.update(restaurantId, id, dto, user.name);
    return serializeCompletedOrder(updated);
  }
}
