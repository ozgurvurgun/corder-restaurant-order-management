import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RestaurantService } from '../application/restaurant.service';
import { PlatformBillingService } from '../application/platform-billing.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import {
  RecordRestaurantPaymentDto,
  StartCollectionCycleDto,
  SuspendRestaurantBillingDto,
  UpdatePlatformBillingConfigDto,
  UpdateRestaurantBillingStatusDto,
} from './dto/platform-billing.dto';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';

function sanitizeRestaurant<
  T extends { terminalPasswordHash?: unknown; printAgentPasswordHash?: unknown },
>(r: T) {
  const { terminalPasswordHash, printAgentPasswordHash, ...rest } = r;
  return rest;
}

@Controller('platform/restaurants')
@UseGuards(PlatformJwtGuard)
export class RestaurantsController {
  constructor(
    private readonly service: RestaurantService,
    private readonly billingService: PlatformBillingService,
  ) {}

  @Get()
  async findAll() {
    const list = await this.service.findAll();
    return list.map(sanitizeRestaurant);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.service.findOneEnriched(id);
    return sanitizeRestaurant(r);
  }

  @Post()
  async create(@Body() dto: CreateRestaurantDto) {
    const created = await this.service.create(dto);
    return sanitizeRestaurant(created);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    const updated = await this.service.update(id, dto);
    return sanitizeRestaurant(updated);
  }

  @Put(':id/billing')
  async updateBillingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRestaurantBillingStatusDto,
  ) {
    const updated = await this.billingService.updateBillingStatus(id, dto);
    return sanitizeRestaurant(updated);
  }

  @Post(':id/billing/mark-paid')
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordRestaurantPaymentDto,
  ) {
    const updated = await this.billingService.recordPaymentReceived(id, dto);
    return sanitizeRestaurant(updated);
  }

  @Post(':id/billing/suspend-unpaid')
  async suspendUnpaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendRestaurantBillingDto,
  ) {
    const updated = await this.billingService.suspendForNonPayment(id, dto?.note);
    return sanitizeRestaurant(updated);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

@Controller('platform/billing')
@UseGuards(PlatformJwtGuard)
export class PlatformBillingController {
  constructor(private readonly billingService: PlatformBillingService) {}

  @Get('config')
  getConfig() {
    return this.billingService.getBillingConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdatePlatformBillingConfigDto) {
    return this.billingService.updateBillingConfig(dto);
  }

  @Post('start-collection-cycle')
  startCollectionCycle(@Body() dto: StartCollectionCycleDto) {
    return this.billingService.startMonthlyCollectionCycle(dto?.period);
  }

  @Post('suspend-all-unpaid')
  suspendAllUnpaid() {
    return this.billingService.suspendAllUnpaidRestaurants();
  }
}
