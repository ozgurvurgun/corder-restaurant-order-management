import {
  Body,
  Controller,
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
import { PurchaseOrdersService } from '../application/purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';

@Controller('restaurant/purchase-orders')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('inventory.view', 'inventory.manage_suppliers')
  list(@RestaurantId() restaurantId: string) {
    return this.purchaseOrders.list(restaurantId);
  }

  @Post()
  @RequirePermissions('inventory.manage_suppliers')
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

  @Patch(':id')
  @RequirePermissions('inventory.manage_suppliers')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrders.update(restaurantId, id, body);
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.manage_suppliers')
  cancel(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchaseOrders.cancel(restaurantId, id);
  }

  @Post(':id/receive')
  @RequirePermissions('inventory.manage_suppliers')
  receive(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrders.markReceived(
      restaurantId,
      id,
      user.name,
      body,
    );
  }
}
