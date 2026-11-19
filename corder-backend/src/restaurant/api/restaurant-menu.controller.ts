import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MenuQueryService } from '../../menu/application/menu-query.service';
import { StaffSessionService } from '../application/staff-session.service';
import { PermissionKey } from '../domain/permissions.catalog';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/menu')
@UseGuards(RestaurantJwtGuard)
export class RestaurantMenuController {
  constructor(
    private readonly menuQuery: MenuQueryService,
    private readonly staffSession?: StaffSessionService,
  ) {}

  @Get()
  async getTerminalMenu(
    @RestaurantId() restaurantId: string,
    @RestaurantUser()
    user?: {
      role?: string;
      isBoss?: boolean;
      permissions?: PermissionKey[];
    },
    @Req() req?: Request,
  ) {
    if (user?.role === 'print_agent') {
      throw new ForbiddenException(
        'Print agent cannot access the terminal menu',
      );
    }
    if (user?.role === 'terminal') {
      if (!this.staffSession || !req) {
        throw new UnauthorizedException('Staff PIN verification is required');
      }
      const staff = await this.staffSession.requireFromRequest(req, restaurantId);
      if (
        !staff.permissions.includes('order.view') &&
        !staff.permissions.includes('order.create') &&
        !staff.permissions.includes('catalog.view')
      ) {
        throw new ForbiddenException(
          'Insufficient permissions to view restaurant menu',
        );
      }
    } else if (user?.role === 'staff' && !user.isBoss) {
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
