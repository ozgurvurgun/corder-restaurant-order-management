import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrderService } from '../application/order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { MoveOrdersDto } from './dto/move-orders.dto';
import { CloseOrdersDto } from './dto/close-orders.dto';
import { PrintReceiptDto } from './dto/print-receipt.dto';
import { MoveOrderItemsDto } from './dto/move-order-items.dto';
import { CancelOrderItemDto } from './dto/cancel-order-item.dto';
import { AssignItemsToLedgerDto } from './dto/assign-items-to-ledger.dto';
import { RevertLedgerItemDto } from './dto/revert-ledger-item.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/orders')
@UseGuards(RestaurantJwtGuard)
export class OrdersController {
  constructor(private readonly service: OrderService) {}

  @Get()
  findAll(
    @RestaurantId() restaurantId: string,
    @Query('tableId') tableId?: string,
  ) {
    return this.service.findByRestaurant(restaurantId, tableId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateOrderDto) {
    return this.service.create(restaurantId, dto);
  }

  @Post('move-items')
  moveOrderItems(@RestaurantId() restaurantId: string, @Body() dto: MoveOrderItemsDto) {
    return this.service.moveItemsToTable(restaurantId, {
      fromTableId: dto.fromTableId,
      toTableId: dto.toTableId,
      itemIds: dto.itemIds,
      userId: dto.userId ?? null,
      actorDisplayName: dto.actorDisplayName ?? null,
    });
  }

  @Post('cancel-item')
  cancelItem(
    @RestaurantId() restaurantId: string,
    @Body() dto: CancelOrderItemDto,
    @RestaurantUser() user: { name: string },
  ) {
    return this.service.cancelOrderItem(restaurantId, dto.itemId, dto.reason, user.name);
  }

  @Post('assign-to-ledger')
  assignToLedger(
    @RestaurantId() restaurantId: string,
    @Body() dto: AssignItemsToLedgerDto,
    @RestaurantUser() user: { name: string },
  ) {
    return this.service.assignItemsToLedger(restaurantId, dto.lines, dto.ledgerCustomerId, user.name);
  }

  @Post('revert-ledger-item')
  revertLedgerItem(
    @RestaurantId() restaurantId: string,
    @Body() dto: RevertLedgerItemDto,
    @RestaurantUser() user: { name: string },
  ) {
    return this.service.revertLedgerOrderItem(restaurantId, dto.itemId, user.name);
  }

  @Patch('move')
  moveTable(
    @RestaurantId() restaurantId: string,
    @Body() dto: MoveOrdersDto,
  ) {
    return this.service.moveTable(restaurantId, dto.fromTableId, dto.toTableId);
  }

  @Patch('close')
  closeTable(
    @RestaurantId() restaurantId: string,
    @Body() dto: CloseOrdersDto,
  ) {
    return this.service.closeTable(restaurantId, dto.tableId);
  }

  @Post('print-receipt')
  printReceipt(@RestaurantId() restaurantId: string, @Body() dto: PrintReceiptDto) {
    return this.service.printReceipt(restaurantId, dto);
  }
}
