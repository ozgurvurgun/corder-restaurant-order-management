import { Body, Controller, Post } from '@nestjs/common';
import { RestaurantAuthService } from '../application/restaurant-auth.service';
import { RestaurantLoginDto } from './dto/restaurant-login.dto';

@Controller('restaurant/auth')
export class RestaurantAuthController {
  constructor(private readonly auth: RestaurantAuthService) {}

  @Post('login')
  login(@Body() dto: RestaurantLoginDto) {
    return this.auth.login(dto);
  }
}
