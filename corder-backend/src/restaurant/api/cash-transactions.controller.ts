import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  CashTransactionsService,
  serializeCashTransaction,
} from '../application/cash-transactions.service';
import { serializeCashShift } from '../application/cash-shift.service';
import { CreateCashTransactionDto } from './dto/create-cash-transaction.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/cash-transactions')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class CashTransactionsController {
  constructor(private readonly service: CashTransactionsService) {}

  @Post()
  async create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() dto: CreateCashTransactionDto,
  ) {
    const { transaction, shift } = await this.service.create(
      restaurantId,
      dto,
      user.name,
    );
    return {
      transaction: serializeCashTransaction(transaction),
      shift: serializeCashShift(shift),
    };
  }

  @Get()
  async list(
    @RestaurantId() restaurantId: string,
    @Query('shiftId') shiftId?: string,
  ) {
    if (shiftId) {
      return this.service.listForShift(restaurantId, shiftId);
    }
    return this.service.listForCurrentShift(restaurantId);
  }
}
