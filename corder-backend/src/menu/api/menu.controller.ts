import { Controller, Get, Param, Query } from '@nestjs/common';
import { MenuQueryService } from '../application/menu-query.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuQuery: MenuQueryService) {}

  /** Public menu by query string: GET /menu?restaurant=slug [&terminal=1] */
  @Get()
  getByQuery(
    @Query('restaurant') restaurant: string,
    @Query('terminal') terminal?: string,
  ) {
    if (!restaurant?.trim()) {
      return this.menuQuery.getBusinessBySlug(null);
    }
    const forTerminal = terminal === '1' || terminal === 'true';
    return this.menuQuery.getBusinessBySlug(restaurant.trim(), forTerminal);
  }

  @Get('business/:slug')
  getBySlug(@Param('slug') slug: string, @Query('terminal') terminal?: string) {
    const forTerminal = terminal === '1' || terminal === 'true';
    return this.menuQuery.getBusinessBySlug(slug, forTerminal);
  }
}
