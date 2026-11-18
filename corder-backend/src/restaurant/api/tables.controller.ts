import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TableService } from '../application/table.service';
import { StaffSessionService } from '../application/staff-session.service';
import { EffectivePolicyLimits, PermissionKey } from '../domain/permissions.catalog';
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

  private assertCanReadTables(user?: {
    role?: string;
    isBoss?: boolean;
    permissions?: PermissionKey[];
  }): void {
    if (!user) {
      throw new ForbiddenException('Session authentication is required');
    }
    if (user.role === 'print_agent') {
      throw new ForbiddenException('Print agent cannot access table endpoints');
    }
    if (user.role === 'root' || user.isBoss || user.role === 'terminal') {
      return;
    }
    const perms = user.permissions ?? [];
    if (
      !perms.includes('order.view') &&
      !perms.includes('order.create') &&
      !perms.includes('billing.close_check') &&
      !perms.includes('system.manage_tables')
    ) {
      throw new ForbiddenException('You do not have permission to view tables (order.view)');
    }
  }

  /** Declared first so it is not shadowed by `GET :id`. */
  @Get('presence')
  @RequirePermissions('order.view', 'order.create', 'billing.close_check', 'system.manage_tables')
  tablePresence(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string; isBoss?: boolean; permissions?: PermissionKey[] },
  ) {
    this.assertCanReadTables(user);
    return this.service.buildSessionPresenceMap(restaurantId);
  }

  @Get()
  @RequirePermissions('order.view', 'order.create', 'billing.close_check', 'system.manage_tables')
  findAll(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string; isBoss?: boolean; permissions?: PermissionKey[] },
  ) {
    this.assertCanReadTables(user);
    return this.service.findByRestaurant(restaurantId);
  }

  @Post(':id/session-lock')
  async sessionLock(
    @Param('id', ParseUUIDPipe) id: string,
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
    @Param('id', ParseUUIDPipe) id: string,
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
  @RequirePermissions('order.view', 'order.create', 'billing.close_check', 'system.manage_tables')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string; isBoss?: boolean; permissions?: PermissionKey[] },
  ) {
    this.assertCanReadTables(user);
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  @UseGuards(PanelRootGuard)
  @RequirePermissions('system.manage_tables')
  async create(@RestaurantId() restaurantId: string, @Body() dto: CreateTableDto) {
    const created = await this.service.create(restaurantId, dto);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return created;
  }

  @Patch(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions(
    'system.manage_tables',
    'billing.close_check',
    'billing.split_bill',
    'discount.apply_percent',
    'discount.apply_amount',
    'discount.complimentary',
    'discount.remove',
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser()
    user: {
      name?: string;
      isBoss?: boolean;
      permissions?: PermissionKey[];
      limits?: EffectivePolicyLimits;
    },
    @Body() dto: UpdateTableDto,
  ) {
    const perms = user.permissions ?? [];
    const isStructuralEdit = dto.name !== undefined || dto.section !== undefined;
    if (isStructuralEdit && !user.isBoss && !perms.includes('system.manage_tables')) {
      throw new ForbiddenException(
        'You do not have permission to edit tables (system.manage_tables)',
      );
    }

    if (
      dto.status !== undefined &&
      !user.isBoss &&
      !perms.includes('system.manage_tables') &&
      !perms.includes('billing.close_check') &&
      !perms.includes('billing.split_bill') &&
      !perms.includes('order.create')
    ) {
      throw new ForbiddenException(
        'You do not have permission to update table status',
      );
    }

    if (
      dto.splitInfo !== undefined &&
      !user.isBoss &&
      !perms.includes('billing.split_bill') &&
      !perms.includes('billing.close_check')
    ) {
      throw new ForbiddenException(
        'You do not have permission to split bills (billing.split_bill)',
      );
    }

    if (dto.discount !== undefined && !user.isBoss) {
      if (dto.discount === null) {
        if (
          !perms.includes('discount.remove') &&
          !perms.includes('billing.close_check') &&
          !perms.includes('discount.apply_percent') &&
          !perms.includes('discount.apply_amount') &&
          !perms.includes('discount.complimentary')
        ) {
          throw new ForbiddenException(
            'You do not have permission to remove discounts (discount.remove)',
          );
        }
      } else {
        const isComp =
          dto.discount.type === 'complimentary' ||
          (dto.discount.type === 'percent' && dto.discount.value >= 100);
        if (isComp) {
          if (!perms.includes('discount.complimentary')) {
            throw new ForbiddenException(
              'You do not have permission to apply a 100% complimentary discount (discount.complimentary)',
            );
          }
        } else if (dto.discount.type === 'percent') {
          if (!perms.includes('discount.apply_percent')) {
            throw new ForbiddenException(
              'You do not have permission to apply a percentage discount (discount.apply_percent)',
            );
          }
          if (user.limits && dto.discount.value > user.limits.maxDiscountPercent) {
            throw new ForbiddenException(
              `Maximum percentage discount limit is ${user.limits.maxDiscountPercent}% (entered: ${dto.discount.value}%)`,
            );
          }
        } else if (dto.discount.type === 'amount') {
          if (!perms.includes('discount.apply_amount')) {
            throw new ForbiddenException(
              'You do not have permission to apply an amount discount (discount.apply_amount)',
            );
          }
          if (
            user.limits?.maxDiscountAmount != null &&
            dto.discount.value > user.limits.maxDiscountAmount
          ) {
            throw new ForbiddenException(
              `Maximum amount discount limit is ${user.limits.maxDiscountAmount} TL (entered: ${dto.discount.value} TL)`,
            );
          }
        }
      }
    }

    if (dto.discount) {
      dto.discount.appliedBy = dto.discount.appliedBy?.trim() || user.name?.trim() || 'Sistem';
    }
    const updated = await this.service.update(id, restaurantId, dto);
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return updated;
  }

  @Delete(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('system.manage_tables')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
  ) {
    await this.service.remove(id, restaurantId);
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true };
  }
}
