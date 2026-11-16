import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import {
  RestaurantSettingsService,
  RestaurantSettingsDto,
  MerchantBillingInfoDto,
} from '../application/restaurant-settings.service';
import { UpdateRestaurantSettingsDto } from './dto/update-restaurant-settings.dto';

@Controller('restaurant/settings')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class RestaurantSettingsController {
  constructor(private readonly service: RestaurantSettingsService) {}

  @Get()
  get(@RestaurantId() restaurantId: string): Promise<RestaurantSettingsDto> {
    return this.service.get(restaurantId);
  }

  @Get('billing')
  getBilling(@RestaurantId() restaurantId: string): Promise<MerchantBillingInfoDto> {
    return this.service.getBillingInfo(restaurantId);
  }

  @Put()
  update(
    @RestaurantId() restaurantId: string,
    @Body() body: UpdateRestaurantSettingsDto,
  ): Promise<RestaurantSettingsDto> {
    return this.service.update(restaurantId, body);
  }
}
