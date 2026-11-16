import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffService } from '../application/staff.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import {
  extractClientIp,
  LoginRateLimiterService,
} from '../../common/security/login-rate-limiter.service';

@Controller('restaurant/staff')
@UseGuards(RestaurantJwtGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  @Post('verify-pin')
  verifyPin(
    @Req() req: Request,
    @RestaurantId() restaurantId: string,
    @Body() dto: VerifyPinDto,
  ) {
    this.rateLimiter.consumePinAttempt(extractClientIp(req), restaurantId);
    return this.staffService.verifyPin(restaurantId, dto.pin);
  }

  @Get()
  @UseGuards(PanelRootGuard)
  list(@RestaurantId() restaurantId: string) {
    return this.staffService.list(restaurantId);
  }

  @Post()
  @UseGuards(PanelRootGuard)
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.create(restaurantId, dto);
  }

  @Put(':id')
  @UseGuards(PanelRootGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(restaurantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PanelRootGuard)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.staffService.delete(restaurantId, id);
  }
}
