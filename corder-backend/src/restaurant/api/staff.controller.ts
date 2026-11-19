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
import { StaffMutationActor, StaffService } from '../application/staff.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
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

  @Get('terminal-users')
  listTerminalUsers(@RestaurantId() restaurantId: string) {
    return this.staffService.listTerminalUsers(restaurantId);
  }

  @Post('verify-pin')
  async verifyPin(
    @Req() req: Request,
    @RestaurantId() restaurantId: string,
    @Body() dto: VerifyPinDto,
  ) {
    const ip = extractClientIp(req);
    this.rateLimiter.consumePinAttempt(ip, restaurantId, dto.staffId);
    const rawHeaderLat = req.headers['x-terminal-lat'];
    const rawHeaderLng = req.headers['x-terminal-lng'];
    const headerLat = rawHeaderLat != null ? Number(Array.isArray(rawHeaderLat) ? rawHeaderLat[0] : rawHeaderLat) : NaN;
    const headerLng = rawHeaderLng != null ? Number(Array.isArray(rawHeaderLng) ? rawHeaderLng[0] : rawHeaderLng) : NaN;
    const latitude = dto.latitude ?? (Number.isFinite(headerLat) ? headerLat : null);
    const longitude = dto.longitude ?? (Number.isFinite(headerLng) ? headerLng : null);

    const result = await this.staffService.verifyPin(
      restaurantId,
      dto.pin,
      dto.staffId,
      { latitude, longitude },
    );
    this.rateLimiter.resetPinAttempts(ip, restaurantId, dto.staffId);
    return result;
  }

  @Get()
  @UseGuards(PanelRootGuard)
  @RequirePermissions('staff.view', 'staff.manage', 'roles.manage')
  list(@RestaurantId() restaurantId: string) {
    return this.staffService.list(restaurantId);
  }

  @Post()
  @UseGuards(PanelRootGuard)
  @RequirePermissions('staff.manage', 'roles.manage')
  create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() actor: StaffMutationActor,
    @Body() dto: CreateStaffDto,
  ) {
    return this.staffService.create(restaurantId, dto, actor);
  }

  @Put(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('staff.manage', 'roles.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() actor: StaffMutationActor,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(restaurantId, id, dto, actor);
  }

  @Delete(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('staff.manage', 'roles.manage')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() actor: StaffMutationActor,
  ) {
    return this.staffService.delete(restaurantId, id, actor);
  }
}
