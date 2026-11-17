import {
  Controller,
  ForbiddenException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { MenuQueryService } from '../../menu/application/menu-query.service';
import { PermissionKey } from '../domain/permissions.catalog';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/menu')
@UseGuards(RestaurantJwtGuard)
export class RestaurantMenuController {
  constructor(private readonly menuQuery: MenuQueryService) {}

  @Get()
  getTerminalMenu(
    @RestaurantId() restaurantId: string,
    @RestaurantUser()
    user?: {
      role?: string;
      isBoss?: boolean;
      permissions?: PermissionKey[];
    },
  ) {
    if (user?.role === 'print_agent') {
      throw new ForbiddenException(
        'Print agent cannot access the terminal menu',
      );
    }
    if (user?.role === 'staff' && !user.isBoss) {
      const perms = user.permissions ?? [];
      if (
        !perms.includes('order.view') &&
        !perms.includes('order.create') &&
        !perms.includes('catalog.view')
      ) {
        throw new ForbiddenException(
          'Insufficient permissions to view restaurant menu',
        );
      }
    }
    return this.menuQuery.getTerminalMenuByRestaurantId(restaurantId);
  }
}
