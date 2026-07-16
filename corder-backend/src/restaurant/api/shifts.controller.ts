import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CashShiftService } from '../application/cash-shift.service';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/shifts')
@UseGuards(RestaurantJwtGuard)
export class ShiftsController {
  constructor(private readonly service: CashShiftService) {}

  @Get('current')
  async getCurrent(@RestaurantId() restaurantId: string) {
    const shift = await this.service.getCurrent(restaurantId);
    if (!shift) return null;
    return this.toDto(shift);
  }

  @Get()
  async list(@RestaurantId() restaurantId: string, @Query('limit') limit?: string) {
    const shifts = await this.service.list(restaurantId, limit ? parseInt(limit, 10) : 50);
    return shifts.map((s) => this.toDto(s));
  }

  @Post()
  async open(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() dto: OpenShiftDto,
  ) {
    const shift = await this.service.open(
      restaurantId,
      user.name,
      dto.openingBalance ?? 0,
    );
    return this.toDto(shift);
  }

  @Put(':id/close')
  async close(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() dto: CloseShiftDto,
  ) {
    const shift = await this.service.close(
      id,
      restaurantId,
      user.name,
      dto.closingBalance,
      dto.notes,
    );
    return this.toDto(shift);
  }

  private toDto(shift: CashShiftEntity) {
    return {
      id: shift.id,
      openedBy: shift.openedBy,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      closedBy: shift.closedBy,
      status: shift.status,
      openingBalance: Number(shift.openingBalance),
      closingBalance: shift.closingBalance != null ? Number(shift.closingBalance) : null,
      notes: shift.notes,
      cashIn: Number(shift.cashIn ?? 0),
      cashOut: Number(shift.cashOut ?? 0),
      totalRevenue: Number(shift.totalRevenue ?? 0),
      totalNakit: Number(shift.totalNakit ?? 0),
      totalKart: Number(shift.totalKart ?? 0),
      totalYemekKarti: Number(shift.totalYemekKarti ?? 0),
      totalMultinet: Number(shift.totalMultinet ?? 0),
      transactionCount: shift.transactionCount ?? 0,
    };
  }
}
