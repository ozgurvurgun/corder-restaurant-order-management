import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RestaurantAuthService } from '../application/restaurant-auth.service';
import { RestaurantLoginDto } from './dto/restaurant-login.dto';
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
  login(@Req() req: Request, @Body() dto: RestaurantLoginDto) {
    this.rateLimiter.consumeLoginAttempt('restaurant', extractClientIp(req), dto.email);
    return this.auth.login(dto);
  }
}
