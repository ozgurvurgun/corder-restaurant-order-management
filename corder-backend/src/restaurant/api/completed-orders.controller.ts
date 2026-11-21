import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CompletedOrdersService,
  serializeCompletedOrder,
} from '../application/completed-orders.service';
import { EffectivePolicyLimits, PermissionKey } from '../domain/permissions.catalog';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { UpdateCompletedOrderDto } from './dto/update-completed-order.dto';

@Controller('restaurant/completed-orders')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class CompletedOrdersController {
  constructor(private readonly service: CompletedOrdersService) {}

  @Get()
  @RequirePermissions(
    'reports.view_operational',
    'reports.view_financial',
    'billing.close_check',
    'cash.view',
  )
  async list(
    @RestaurantId() restaurantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('waiter') waiter?: string,
    @Query('tableName') tableName?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      waiter,
      tableName,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };
    const list = await this.service.list(restaurantId, filters);
    return list.map((c) => serializeCompletedOrder(c));
  }

  @Patch(':id')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('billing.edit_completed_order')
  async update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantUser()
    user: {
      id?: string;
      sub?: string;
      name: string;
      isBoss?: boolean;
      permissions?: PermissionKey[];
      limits?: EffectivePolicyLimits;
    },
    @Body() dto: UpdateCompletedOrderDto,
  ) {
    const updated = await this.service.update(
      restaurantId,
      id,
      dto,
      user.name,
      {
        id: user.id ?? user.sub,
        isBoss: user.isBoss,
        permissions: user.permissions,
        limits: user.limits,
      },
    );
    return serializeCompletedOrder(updated);
  }
}
