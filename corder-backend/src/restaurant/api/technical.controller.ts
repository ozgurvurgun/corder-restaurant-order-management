import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { PrintersService, CreatePrinterDto, UpdatePrinterDto } from '../application/printers.service';
import { AuditLogsService } from '../application/audit-logs.service';
import { AuditCategory } from '../domain/audit-log.entity';
import { CreateAuditLogBodyDto } from './dto/create-audit-log.dto';

@Controller('restaurant')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class TechnicalController {
  constructor(
    private readonly printers: PrintersService,
    private readonly audits: AuditLogsService,
  ) {}

  // ----- Printers -----

  @Get('printers')
  listPrinters(@RestaurantId() restaurantId: string) {
    return this.printers.list(restaurantId);
  }

  @Post('printers')
  createPrinter(@RestaurantId() restaurantId: string, @Body() body: CreatePrinterDto) {
    return this.printers.create(restaurantId, body);
  }

  @Put('printers/:id')
  updatePrinter(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body() body: UpdatePrinterDto,
  ) {
    return this.printers.update(restaurantId, id, body);
  }

  @Delete('printers/:id')
  deletePrinter(@RestaurantId() restaurantId: string, @Param('id') id: string) {
    return this.printers.remove(restaurantId, id);
  }

  // ----- Audit logs -----

  @Get('audit-logs')
  listAuditLogs(
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

  @Post('audit-logs')
  createAuditLog(
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
