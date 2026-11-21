import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CashTransactionsService,
  serializeCashTransaction,
} from '../application/cash-transactions.service';
import { serializeCashShift } from '../application/cash-shift.service';
import { PermissionKey } from '../domain/permissions.catalog';
import { CreateCashTransactionDto } from './dto/create-cash-transaction.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/cash-transactions')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class CashTransactionsController {
  constructor(private readonly service: CashTransactionsService) {}

  @Post()
  @RequirePermissions('cash.transaction_in', 'cash.transaction_out')
  async create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser()
    user: { id: string; name: string; isBoss?: boolean; permissions?: PermissionKey[] },
    @Body() dto: CreateCashTransactionDto,
  ) {
    if (!user.isBoss) {
      const perms = user.permissions ?? [];
      if (dto.type === 'cash-in' && !perms.includes('cash.transaction_in')) {
        throw new ForbiddenException('You do not have permission to record cash inflows (cash.transaction_in)');
      }
      if (
        (dto.type === 'cash-out' || dto.type === 'expense' || dto.type === 'refund') &&
        !perms.includes('cash.transaction_out')
      ) {
        throw new ForbiddenException('You do not have permission to record cash outflows or expenses (cash.transaction_out)');
      }
    }
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
  @RequirePermissions('cash.view', 'cash.view_history')
  async list(
    @RestaurantId() restaurantId: string,
    @Query('shiftId', new ParseUUIDPipe({ optional: true })) shiftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    if (shiftId) {
      return this.service.listForShift(restaurantId, shiftId);
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 500;
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(1000, Math.max(1, parsedLimit))
      : 500;
    return this.service.listForRestaurant(restaurantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      type: type?.trim() || undefined,
      limit: safeLimit,
    });
  }
}
