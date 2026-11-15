import {
  Body,
  Controller,
  Delete,
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
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
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
  ) {
    const staff = await this.staffSession.requireFromRequest(req, restaurantId);
    const result = await this.service.acquireSessionLock(
      restaurantId,
      id,
      staff.staffId,
      staff.name,
    );
    if (!result.ok) {
      throw new HttpException(
        { holderName: result.holderName, code: 'TABLE_SESSION_LOCKED' },
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
    await this.service.releaseSessionLock(restaurantId, id, staff.staffId);
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
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateTableDto) {
    return this.service.create(restaurantId, dto);
  }

  @Patch(':id')
  @UseGuards(PanelRootGuard)
  async update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateTableDto,
  ) {
    const updated = await this.service.update(id, restaurantId, dto);
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return updated;
  }

  @Delete(':id')
  @UseGuards(PanelRootGuard)
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }
}
