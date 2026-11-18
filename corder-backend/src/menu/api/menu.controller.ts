import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { MenuQueryService } from '../application/menu-query.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuQuery: MenuQueryService) {}

  /** Public menu by query string: GET /menu?restaurant=slug&t=tableToken (never exposes terminal-only categories). */
  @Get()
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  getByQuery(
    @Query('restaurant') restaurant: string,
    @Query('t') tableToken?: string,
  ) {
    if (!restaurant?.trim()) {
      return this.menuQuery.getBusinessBySlug(null, tableToken);
    }
    return this.menuQuery.getBusinessBySlug(restaurant.trim(), tableToken);
  }

  @Get('business/:slug')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  getByBusinessSlug(
    @Param('slug') slug: string,
    @Query('t') tableToken?: string,
  ) {
    return this.menuQuery.getBusinessBySlug(slug, tableToken);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30')
  getBySlug(@Param('slug') slug: string, @Query('t') tableToken?: string) {
    return this.menuQuery.getBusinessBySlug(slug, tableToken);
  }

  @Post('business/:slug/call-waiter')
  callWaiterByBusinessSlug(
    @Param('slug') slug: string,
    @Body()
    body: {
      tableToken: string;
      requestType?: 'waiter' | 'bill';
      note?: string;
    },
  ) {
    return this.menuQuery.callWaiter(slug, body);
  }

  @Post(':slug/call-waiter')
  callWaiter(
    @Param('slug') slug: string,
    @Body()
    body: {
      tableToken: string;
      requestType?: 'waiter' | 'bill';
      note?: string;
    },
  ) {
    return this.menuQuery.callWaiter(slug, body);
  }
}
