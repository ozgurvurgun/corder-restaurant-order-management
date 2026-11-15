import { Controller, Get, Param, Query } from '@nestjs/common';
import { MenuQueryService } from '../application/menu-query.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuQuery: MenuQueryService) {}

  /** Public menu by query string: GET /menu?restaurant=slug (never exposes terminal-only categories). */
  @Get()
  getByQuery(@Query('restaurant') restaurant: string) {
    if (!restaurant?.trim()) {
      return this.menuQuery.getBusinessBySlug(null);
    }
    return this.menuQuery.getBusinessBySlug(restaurant.trim());
  }

  @Get('business/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.menuQuery.getBusinessBySlug(slug);
  }
}
