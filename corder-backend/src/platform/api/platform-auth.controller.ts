import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PlatformAuthService } from '../application/platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import {
  extractClientIp,
  LoginRateLimiterService,
} from '../../common/security/login-rate-limiter.service';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Body() dto: PlatformLoginDto) {
    this.rateLimiter.consumeLoginAttempt('platform', extractClientIp(req), dto.email);
    return this.auth.login(dto);
  }
}
