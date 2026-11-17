import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RestaurantAuthService, RestaurantJwtRole } from '../application/restaurant-auth.service';
import { RestaurantLoginDto } from './dto/restaurant-login.dto';
import { SwitchBranchDto } from './dto/switch-branch.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { BossOnly, PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import {
  extractClientIp,
  LoginRateLimiterService,
} from '../../common/security/login-rate-limiter.service';

@Controller('restaurant/auth')
export class RestaurantAuthController {
  constructor(
    private readonly auth: RestaurantAuthService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Body() dto: RestaurantLoginDto) {
    const ip = extractClientIp(req);
    this.rateLimiter.consumeLoginAttempt('restaurant', ip, dto.email);
    const result = await this.auth.login(dto);
    this.rateLimiter.resetLoginAttempts('restaurant', ip, dto.email);
    return result;
  }

  @Get('me')
  @UseGuards(RestaurantJwtGuard)
  me(
    @RestaurantUser()
    user: { sub: string; restaurantId: string; role: RestaurantJwtRole },
  ) {
    return this.auth.getSessionProfile(user);
  }

  @Post('switch-branch')
  @UseGuards(RestaurantJwtGuard, PanelRootGuard)
  @BossOnly()
  switchBranch(
    @RestaurantUser()
    user: { sub: string; role: RestaurantJwtRole },
    @Body() body: SwitchBranchDto,
  ) {
    if (user.role !== 'root') {
      throw new ForbiddenException('Only Boss accounts can switch branches');
    }
    return this.auth.switchBranch(user.sub, body.restaurantId);
  }
}
