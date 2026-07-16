import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TableService } from '../application/table.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { SessionLockDto, SessionUnlockDto } from './dto/session-lock.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { OrdersGateway } from './orders.gateway';

@Controller('restaurant/tables')
@UseGuards(RestaurantJwtGuard)
export class TablesController {
  constructor(
    private readonly service: TableService,
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
    @Body() dto: SessionLockDto,
  ) {
    const name = (dto.staffName ?? '').trim() || 'Garson';
    const result = await this.service.acquireSessionLock(restaurantId, id, dto.staffId.trim(), name);
    if (!result.ok) {
      throw new HttpException({ holderName: result.holderName, code: 'TABLE_SESSION_LOCKED' }, HttpStatus.CONFLICT);
    }
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true };
  }

  @Post(':id/session-unlock')
  async sessionUnlock(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: SessionUnlockDto,
  ) {
    await this.service.releaseSessionLock(restaurantId, id, dto.staffId.trim());
    await this.ordersGateway.emitTableSessionPresence(restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateTableDto) {
    return this.service.create(restaurantId, dto);
  }

  @Patch(':id')
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
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }
}
