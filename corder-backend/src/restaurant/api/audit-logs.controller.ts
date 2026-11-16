import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { AuditLogsService } from '../application/audit-logs.service';
import { AuditCategory } from '../domain/audit-log.entity';
import { CreateAuditLogBodyDto } from './dto/create-audit-log.dto';

@Controller('restaurant/audit-logs')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class AuditLogsController {
  constructor(private readonly audits: AuditLogsService) {}

  @Get()
  list(
    @RestaurantId() restaurantId: string,
    @Query('category') category?: AuditCategory,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const n = limit ? Number(limit) : 200;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.audits.list(restaurantId, {
      category,
      limit: n,
      from: fromDate && Number.isFinite(fromDate.getTime()) ? fromDate : undefined,
      to: toDate && Number.isFinite(toDate.getTime()) ? toDate : undefined,
    });
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() body: CreateAuditLogBodyDto,
  ) {
    return this.audits.create(restaurantId, {
      userId: user.id,
      userName: user.name,
      action: body.action,
      category: body.category,
      details: body.details,
      metadata: body.metadata,
    });
  }
}
