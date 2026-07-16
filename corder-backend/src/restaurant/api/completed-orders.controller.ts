import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompletedOrdersService } from '../application/completed-orders.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { CreateCompletedOrderDto } from './dto/create-completed-order.dto';
import { UpdateCompletedOrderDto } from './dto/update-completed-order.dto';

@Controller('restaurant/completed-orders')
@UseGuards(RestaurantJwtGuard)
export class CompletedOrdersController {
  constructor(private readonly service: CompletedOrdersService) {}

  @Post()
  async create(
    @RestaurantId() restaurantId: string,
    @Body() dto: CreateCompletedOrderDto,
  ) {
    const created = await this.service.create(restaurantId, dto);
    return this.toDto(created);
  }

  @Get()
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
    return list.map((c) => this.toDto(c));
  }

  @Patch(':id')
  @UseGuards(PanelRootGuard)
  async update(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompletedOrderDto,
  ) {
    const updated = await this.service.update(restaurantId, id, dto);
    return this.toDto(updated);
  }

  private toDto(entity: {
    id: string;
    restaurantId: string;
    tableName: string;
    section: string;
    waiter: string;
    totalAmount: number;
    discountAmount: number;
    netAmount: number;
    closedBy: string;
    openedAt: Date;
    closedAt: Date;
    paymentMethod: string;
    paymentSplit: unknown | null;
    paymentDiscount: unknown | null;
    paymentTip: number;
    ordersSnapshot: unknown;
    paymentSnapshot: unknown;
    createdAt: Date;
  }) {
    return {
      id: entity.id,
      tableName: entity.tableName,
      section: entity.section,
      waiter: entity.waiter,
      orders: entity.ordersSnapshot,
      payment: entity.paymentSnapshot,
      totalAmount: Number(entity.totalAmount),
      discountAmount: Number(entity.discountAmount),
      netAmount: Number(entity.netAmount),
      closedBy: entity.closedBy,
      openedAt: entity.openedAt,
      closedAt: entity.closedAt,
      paymentMethod: entity.paymentMethod,
      paymentSplit: entity.paymentSplit,
      paymentDiscount: entity.paymentDiscount,
      paymentTip: Number(entity.paymentTip),
      createdAt: entity.createdAt,
    };
  }
}

