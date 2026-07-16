import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CashTransactionsService } from '../application/cash-transactions.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/cash-transactions')
@UseGuards(RestaurantJwtGuard)
export class CashTransactionsController {
  constructor(private readonly service: CashTransactionsService) {}

  @Post()
  async create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body()
    body: {
      type: 'sale' | 'expense' | 'cash-in' | 'cash-out' | 'refund';
      amount: number;
      description: string;
      reference?: string;
      createdBy?: string;
    },
  ) {
    const { transaction, shift } = await this.service.create(restaurantId, {
      type: body.type,
      amount: body.amount,
      description: body.description,
      reference: body.reference,
      createdBy: body.createdBy ?? user.name,
    });
    return {
      transaction,
      shift: {
        id: shift.id,
        openedBy: shift.openedBy,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        closedBy: shift.closedBy,
        status: shift.status,
        openingBalance: Number(shift.openingBalance),
        closingBalance: shift.closingBalance != null ? Number(shift.closingBalance) : null,
        notes: shift.notes,
        cashIn: Number(shift.cashIn),
        cashOut: Number(shift.cashOut),
        totalRevenue: Number(shift.totalRevenue ?? 0),
        totalNakit: Number(shift.totalNakit ?? 0),
        totalKart: Number(shift.totalKart ?? 0),
        totalYemekKarti: Number(shift.totalYemekKarti ?? 0),
        totalMultinet: Number(shift.totalMultinet ?? 0),
        transactionCount: shift.transactionCount ?? 0,
      },
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

