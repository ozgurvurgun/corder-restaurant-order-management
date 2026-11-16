import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TableService } from '../application/table.service';
import { StaffSessionService } from '../application/staff-session.service';
import { PermissionKey } from '../domain/permissions.catalog';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { SessionLockDto } from './dto/session-lock.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { OrdersGateway } from './orders.gateway';

@Controller('restaurant/tables')
@UseGuards(RestaurantJwtGuard)
export class TablesController {
  constructor(
    private readonly service: TableService,
    private readonly staffSession: StaffSessionService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  /** Declared first so it is not shadowed by `GET :id`. */
  @Get('presence')
  tablePresence(@RestaurantId() restaurantId: string) {
    return this.service.buildSessionPresenceMap(restaurantId);
  }

  @Get()
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
  }

  @Post(':id/session-lock')
  async sessionLock(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
    @Body() body?: SessionLockDto,
  ) {
    const staff = await this.staffSession.requireFromRequest(req, restaurantId);
    if (!staff.permissions.includes('order.view')) {
      throw new ForbiddenException('You do not have permission to view tables');
    }
    if (body?.force && staff.permissions.includes('table.force_unlock')) {
      await this.service.releaseSessionLock(restaurantId, id, staff.staffId, true);
    }
    const result = await this.service.acquireSessionLock(
      restaurantId,
      id,
      staff.staffId,
      staff.name,
    );
    if (!result.ok) {
      throw new HttpException(
        {
          holderName: result.holderName,
          code: 'TABLE_SESSION_LOCKED',
          canForceUnlock: staff.permissions.includes('table.force_unlock'),
        },
        HttpStatus.CONFLICT,
      );
    }
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true };
  }

  @Post(':id/session-unlock')
  async sessionUnlock(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
  ) {
    const staff = await this.staffSession.requireFromRequest(req, restaurantId);
    const canForce = staff.permissions.includes('table.force_unlock');
    await this.service.releaseSessionLock(restaurantId, id, staff.staffId, canForce);
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  @UseGuards(PanelRootGuard)
  @RequirePermissions('system.manage_tables')
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateTableDto) {
    return this.service.create(restaurantId, dto);
  }

  @Patch(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('system.manage_tables', 'billing.close_check')
  async update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { isBoss?: boolean; permissions?: PermissionKey[] },
    @Body() dto: UpdateTableDto,
  ) {
    const isStructuralEdit = dto.name !== undefined || dto.section !== undefined;
    if (
      isStructuralEdit &&
      !user.isBoss &&
      !(user.permissions ?? []).includes('system.manage_tables')
    ) {
      throw new ForbiddenException('You do not have permission to edit tables (system.manage_tables)');
    }
    const updated = await this.service.update(id, restaurantId, dto);
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return updated;
  }

  @Delete(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('system.manage_tables')
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }
}
