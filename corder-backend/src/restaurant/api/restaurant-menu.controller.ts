import { Controller, Get, UseGuards } from '@nestjs/common';
import { MenuQueryService } from '../../menu/application/menu-query.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/menu')
@UseGuards(RestaurantJwtGuard)
export class RestaurantMenuController {
  constructor(private readonly menuQuery: MenuQueryService) {}

  @Get()
  getTerminalMenu(@RestaurantId() restaurantId: string) {
    return this.menuQuery.getTerminalMenuByRestaurantId(restaurantId);
  }
}
