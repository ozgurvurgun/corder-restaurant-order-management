import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrderService } from '../application/order.service';
import { StaffSessionService } from '../application/staff-session.service';
import { RestaurantJwtRole } from '../application/restaurant-auth.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { MoveOrdersDto } from './dto/move-orders.dto';
import { CloseCheckDto } from './dto/close-check.dto';
import { PrintReceiptDto } from './dto/print-receipt.dto';
import { MoveOrderItemsDto } from './dto/move-order-items.dto';
import { CancelOrderItemDto } from './dto/cancel-order-item.dto';
import { AssignItemsToLedgerDto } from './dto/assign-items-to-ledger.dto';
import { RevertLedgerItemDto } from './dto/revert-ledger-item.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/orders')
@UseGuards(RestaurantJwtGuard)
export class OrdersController {
  constructor(
    private readonly service: OrderService,
    private readonly staffSession: StaffSessionService,
  ) {}

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
  async create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string; role: RestaurantJwtRole },
    @Req() req: Request,
    @Body() dto: CreateOrderDto,
  ) {
    const staff = await this.staffSession.resolveOptionalFromRequest(req, restaurantId);
    return this.service.create(restaurantId, dto, {
      staffId: staff?.staffId ?? null,
      displayName: staff?.name ?? (user.role === 'root' ? user.name : null),
    });
  }

  @Post('move-items')
  async moveOrderItems(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string; role: RestaurantJwtRole },
    @Req() req: Request,
    @Body() dto: MoveOrderItemsDto,
  ) {
    const staff = await this.staffSession.resolveOptionalFromRequest(req, restaurantId);
    return this.service.moveItemsToTable(restaurantId, {
      fromTableId: dto.fromTableId,
      toTableId: dto.toTableId,
      itemIds: dto.itemIds,
      userId: staff?.staffId ?? null,
      actorDisplayName: staff?.name ?? (user.role === 'root' ? user.name : null),
    });
  }

  @Post('cancel-item')
  async cancelItem(
    @RestaurantId() restaurantId: string,
    @Body() dto: CancelOrderItemDto,
    @RestaurantUser() user: { name: string },
    @Req() req: Request,
  ) {
    const staff = await this.staffSession.resolveOptionalFromRequest(req, restaurantId);
    return this.service.cancelOrderItem(
      restaurantId,
      dto.itemId,
      dto.reason,
      staff?.name ?? user.name,
    );
  }

  @Post('assign-to-ledger')
  @UseGuards(PanelRootGuard)
  assignToLedger(
    @RestaurantId() restaurantId: string,
    @Body() dto: AssignItemsToLedgerDto,
    @RestaurantUser() user: { name: string },
  ) {
    return this.service.assignItemsToLedger(
      restaurantId,
      dto.lines,
      dto.ledgerCustomerId,
      user.name,
    );
  }

  @Post('revert-ledger-item')
  @UseGuards(PanelRootGuard)
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

  @Post('close-check')
  async closeCheck(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Req() req: Request,
    @Body() dto: CloseCheckDto,
  ) {
    const staff = await this.staffSession.resolveOptionalFromRequest(req, restaurantId);
    return this.service.closeCheck(restaurantId, dto, {
      id: staff?.staffId ?? user.id,
      name: staff?.name ?? user.name,
    });
  }

  @Post('print-receipt')
  printReceipt(@RestaurantId() restaurantId: string, @Body() dto: PrintReceiptDto) {
    return this.service.printReceipt(restaurantId, dto);
  }
}
