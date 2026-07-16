import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantSettingsService, RestaurantSettingsDto } from '../application/restaurant-settings.service';

@Controller('restaurant/settings')
@UseGuards(RestaurantJwtGuard)
export class RestaurantSettingsController {
  constructor(private readonly service: RestaurantSettingsService) {}

  @Get()
  get(@RestaurantId() restaurantId: string): Promise<RestaurantSettingsDto> {
    return this.service.get(restaurantId);
  }

  @Put()
  update(
    @RestaurantId() restaurantId: string,
    @Body() body: Partial<RestaurantSettingsDto>,
  ): Promise<RestaurantSettingsDto> {
    return this.service.update(restaurantId, body);
  }
}

