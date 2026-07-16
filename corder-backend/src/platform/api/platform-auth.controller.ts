import { Body, Controller, Post } from '@nestjs/common';
import { PlatformAuthService } from '../application/platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  async login(@Body() dto: PlatformLoginDto) {
    return this.auth.login(dto);
  }
}
