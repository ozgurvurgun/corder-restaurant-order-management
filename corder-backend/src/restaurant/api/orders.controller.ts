import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrderService } from '../application/order.service';
import { StaffSessionService } from '../application/staff-session.service';
import { RestaurantJwtRole } from '../application/restaurant-auth.service';
import { EffectivePolicyLimits, PermissionKey } from '../domain/permissions.catalog';
import { CreateOrderDto } from './dto/create-order.dto';
import { MoveOrdersDto } from './dto/move-orders.dto';
import { CloseCheckDto } from './dto/close-check.dto';
import { PrintReceiptDto } from './dto/print-receipt.dto';
import { MoveOrderItemsDto } from './dto/move-order-items.dto';
import { CancelOrderItemDto } from './dto/cancel-order-item.dto';
import { AssignItemsToLedgerDto } from './dto/assign-items-to-ledger.dto';
import { RevertLedgerItemDto } from './dto/revert-ledger-item.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

interface JwtActorUser {
  id: string;
  sub: string;
  name: string;
  role: RestaurantJwtRole;
  staffRole?: string;
  permissions?: PermissionKey[];
  limits?: EffectivePolicyLimits;
}

@Controller('restaurant/orders')
@UseGuards(RestaurantJwtGuard)
export class OrdersController {
  constructor(
    private readonly service: OrderService,
    private readonly staffSession: StaffSessionService,
  ) {}

  private assertCanReadOrders(user?: {
    role?: string;
    isBoss?: boolean;
    permissions?: PermissionKey[];
  }): void {
    if (!user) {
      throw new ForbiddenException('Session authentication is required');
    }
    if (user.role === 'print_agent') {
      throw new ForbiddenException('Print agent cannot access order endpoints');
    }
    if (user.role === 'root' || user.isBoss || user.role === 'terminal') {
      return;
    }
    const perms = user.permissions ?? [];
    if (
      !perms.includes('order.view') &&
      !perms.includes('order.create') &&
      !perms.includes('billing.close_check') &&
      !perms.includes('reports.view_operational')
    ) {
      throw new ForbiddenException('You do not have permission to view orders (order.view)');
    }
  }

  @Get()
  @RequirePermissions('order.view', 'order.create', 'billing.close_check', 'reports.view_operational')
  findAll(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
    @Query('tableId') tableId?: string,
  ) {
    this.assertCanReadOrders(user);
    return this.service.findByRestaurant(restaurantId, tableId);
  }

  @Get(':id')
  @RequirePermissions('order.view', 'order.create', 'billing.close_check', 'reports.view_operational')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
  ) {
    this.assertCanReadOrders(user);
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  @RequirePermissions('order.create')
  async create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
    @Req() req: Request,
    @Body() dto: CreateOrderDto,
  ) {
    const actor = await this.staffSession.assertActorPermission(
      req,
      restaurantId,
      'order.create',
      user,
    );
    const hasNotes = dto.items?.some((i) => Boolean(i.note && i.note.trim()));
    if (hasNotes && !actor.isBoss && !actor.permissions.includes('order.add_note')) {
      throw new ForbiddenException('You do not have permission to add notes to order items (order.add_note)');
    }
    return this.service.create(restaurantId, dto, {
      actorId: actor.actorId,
      staffId: !actor.isBoss ? actor.actorId : null,
      displayName: actor.actorName,
    });
  }

  @Post('move-items')
  @RequirePermissions('order.move_items')
  async moveOrderItems(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
    @Req() req: Request,
    @Body() dto: MoveOrderItemsDto,
  ) {
    const actor = await this.staffSession.assertActorPermission(
      req,
      restaurantId,
      'order.move_items',
      user,
    );
    return this.service.moveItemsToTable(restaurantId, {
      fromTableId: dto.fromTableId,
      toTableId: dto.toTableId,
      items: dto.items,
      userId: !actor.isBoss ? actor.actorId : null,
      actorDisplayName: actor.actorName,
    });
  }

  @Post('cancel-item')
  @RequirePermissions('order.cancel_item')
  async cancelItem(
    @RestaurantId() restaurantId: string,
    @Body() dto: CancelOrderItemDto,
    @RestaurantUser() user: JwtActorUser,
    @Req() req: Request,
  ) {
    const actor = await this.staffSession.assertActorPermission(
      req,
      restaurantId,
      'order.cancel_item',
      user,
    );
    return this.service.cancelOrderItem(
      restaurantId,
      dto.itemId,
      dto.reason,
      actor.actorName,
      !actor.isBoss ? actor.actorId : null,
      dto.quantity,
    );
  }

  @Post('assign-to-ledger')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('ledger.assign_order')
  assignToLedger(
    @RestaurantId() restaurantId: string,
    @Body() dto: AssignItemsToLedgerDto,
    @RestaurantUser() user: JwtActorUser,
  ) {
    return this.service.assignItemsToLedger(
      restaurantId,
      dto.lines,
      dto.ledgerCustomerId,
      user.name,
    );
  }

  @Post('revert-ledger-item')
  @UseGuards(PanelRootGuard)
  @RequirePermissions('ledger.revert_item')
  revertLedgerItem(
    @RestaurantId() restaurantId: string,
    @Body() dto: RevertLedgerItemDto,
    @RestaurantUser() user: JwtActorUser,
  ) {
    return this.service.revertLedgerOrderItem(restaurantId, dto.itemId, user.name);
  }

  @Patch('move')
  @RequirePermissions('table.move')
  async moveTable(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
    @Req() req: Request,
    @Body() dto: MoveOrdersDto,
  ) {
    const actor = await this.staffSession.assertActorPermission(
      req,
      restaurantId,
      'table.move',
      user,
    );
    return this.service.moveTable(
      restaurantId,
      dto.fromTableId,
      dto.toTableId,
      !actor.isBoss ? actor.actorId : null,
    );
  }

  @Post('close-check')
  @RequirePermissions('billing.close_check', 'billing.split_bill', 'order.quick_sale')
  async closeCheck(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
    @Req() req: Request,
    @Body() dto: CloseCheckDto,
  ) {
    const isWalkIn = Boolean(dto.items && dto.items.length > 0 && !dto.tableId);
    const hasPartialLines = Boolean(dto.lines && dto.lines.length > 0);
    const actor = await this.staffSession.resolveActorContext(req, restaurantId, user);

    if (isWalkIn) {
      if (!actor.isBoss && !actor.permissions.includes('order.quick_sale')) {
        throw new ForbiddenException('You do not have permission for this action (order.quick_sale)');
      }
    } else if (hasPartialLines) {
      if (
        !actor.isBoss &&
        !actor.permissions.includes('billing.split_bill') &&
        !actor.permissions.includes('billing.close_check')
      ) {
        throw new ForbiddenException('You do not have permission to split bills (billing.split_bill)');
      }
    } else if (!actor.isBoss && !actor.permissions.includes('billing.close_check')) {
      throw new ForbiddenException('You do not have permission for this action (billing.close_check)');
    }

    if (
      dto.method === 'split' &&
      !actor.isBoss &&
      !actor.permissions.includes('billing.split_bill')
    ) {
      throw new ForbiddenException('You do not have permission to split bills (billing.split_bill)');
    }

    if (
      (dto.method === 'ledger' || dto.ledgerCustomerId) &&
      !actor.isBoss &&
      !actor.permissions.includes('ledger.assign_order')
    ) {
      throw new ForbiddenException('You do not have permission to assign checks to a customer ledger (ledger.assign_order)');
    }

    if (dto.discount && (dto.discount.type === 'complimentary' || dto.discount.value > 0)) {
      const isComplimentary =
        dto.discount.type === 'complimentary' ||
        (dto.discount.type === 'percent' && dto.discount.value >= 100);
      if (isComplimentary) {
        if (!actor.isBoss && !actor.permissions.includes('discount.complimentary')) {
          throw new ForbiddenException('You do not have permission to apply a 100% complimentary discount (discount.complimentary)');
        }
      } else if (dto.discount.type === 'percent') {
        if (!actor.isBoss && !actor.permissions.includes('discount.apply_percent')) {
          throw new ForbiddenException('You do not have permission to apply a percentage discount (discount.apply_percent)');
        }
        if (!actor.isBoss && dto.discount.value > actor.limits.maxDiscountPercent) {
          throw new ForbiddenException(
            `Maximum percentage discount limit is ${actor.limits.maxDiscountPercent}% (entered: ${dto.discount.value}%)`,
          );
        }
      } else if (dto.discount.type === 'amount') {
        if (!actor.isBoss && !actor.permissions.includes('discount.apply_amount')) {
          throw new ForbiddenException('You do not have permission to apply an amount discount (discount.apply_amount)');
        }
        if (
          !actor.isBoss &&
          actor.limits.maxDiscountAmount != null &&
          dto.discount.value > actor.limits.maxDiscountAmount
        ) {
          throw new ForbiddenException(
            `Maximum amount discount limit is ${actor.limits.maxDiscountAmount} TL (entered: ${dto.discount.value} TL)`,
          );
        }
      }
    }

    return this.service.closeCheck(restaurantId, dto, {
      id: actor.actorId,
      name: actor.actorName,
      isBoss: actor.isBoss,
      permissions: actor.permissions,
      limits: actor.limits,
    });
  }

  @Post('print-receipt')
  @RequirePermissions('order.print_receipt')
  async printReceipt(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: JwtActorUser,
    @Req() req: Request,
    @Body() dto: PrintReceiptDto,
  ) {
    await this.staffSession.assertActorPermission(
      req,
      restaurantId,
      'order.print_receipt',
      user,
    );
    return this.service.printReceipt(restaurantId, dto);
  }
}
