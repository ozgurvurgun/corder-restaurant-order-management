import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { AuditLogsService } from '../application/audit-logs.service';
import { StaffSessionService } from '../application/staff-session.service';
import { AuditCategory } from '../domain/audit-log.entity';
import { CreateAuditLogBodyDto } from './dto/create-audit-log.dto';

@Controller('restaurant/audit-logs')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class AuditLogsController {
  constructor(
    private readonly audits: AuditLogsService,
    private readonly staffSession: StaffSessionService,
  ) {}

  @Get()
  @RequirePermissions('reports.view_audit_logs')
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
  @RequirePermissions(
    'order.view',
    'reports.view_audit_logs',
    'cash.view',
    'billing.close_check',
    'staff.manage',
    'roles.manage',
    'catalog.manage_products',
    'inventory.view',
    'system.manage_settings',
  )
  async create(
    @Req() req: Request,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; sub: string; name: string },
    @Body() body: CreateAuditLogBodyDto,
  ) {
    const staffActor = await this.staffSession
      .resolveOptionalFromRequest(req, restaurantId)
      .catch(() => null);
    return this.audits.create(restaurantId, {
      userId: staffActor?.staffId ?? user.id ?? user.sub,
      userName: staffActor?.name ?? user.name,
      action: body.action,
      category: body.category,
      details: body.details,
      metadata: body.metadata,
    });
  }
}
