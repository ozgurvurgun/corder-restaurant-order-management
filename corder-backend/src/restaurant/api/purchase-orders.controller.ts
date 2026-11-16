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
import { PurchaseOrdersService } from '../application/purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

@Controller('restaurant/purchase-orders')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.purchaseOrders.list(restaurantId);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Body() body: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrders.create(restaurantId, {
      ...body,
      createdBy: user.name,
    });
  }

  @Post(':id/receive')
  receive(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchaseOrders.markReceived(restaurantId, id, user.name);
  }
}
