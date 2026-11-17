import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CashShiftService, serializeCashShift } from '../application/cash-shift.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/shifts')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class ShiftsController {
  constructor(private readonly service: CashShiftService) {}

  @Get('current')
  @RequirePermissions('cash.view', 'cash.view_history', 'billing.close_check')
  async getCurrent(@RestaurantId() restaurantId: string) {
    const shift = await this.service.getCurrent(restaurantId);
    if (!shift) return null;
    return serializeCashShift(shift);
  }

  @Get()
  @RequirePermissions('cash.view', 'cash.view_history', 'billing.close_check')
  async list(@RestaurantId() restaurantId: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(200, Math.max(1, parsedLimit))
      : 50;
    const shifts = await this.service.list(restaurantId, safeLimit);
    return shifts.map((s) => serializeCashShift(s));
  }

  @Post()
  @RequirePermissions('cash.shift_open')
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
    return serializeCashShift(shift);
  }

  @Put(':id/close')
  @RequirePermissions('cash.shift_close')
  async close(
    @Param('id', ParseUUIDPipe) id: string,
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
    return serializeCashShift(shift);
  }
}
