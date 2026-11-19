import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RestaurantService } from '../application/restaurant.service';
import { PlatformBillingService } from '../application/platform-billing.service';
import { PlatformSupportService } from '../application/platform-support.service';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { ExecuteSupportActionDto } from './dto/execute-support-action.dto';
import {
  RecordRestaurantPaymentDto,
  SuspendRestaurantBillingDto,
  UpdatePlatformBillingConfigDto,
  UpdateRestaurantPaymentDto,
} from './dto/platform-billing.dto';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';

function sanitizeRestaurant<
  T extends { terminalPasswordHash?: unknown; printAgentPasswordHash?: unknown },
>(r: T) {
  const { terminalPasswordHash, printAgentPasswordHash, ...rest } = r;
  return rest;
}

function resolveActorName(req?: { user?: Partial<PlatformAdminEntity> }): string {
  return req?.user?.name?.trim() || req?.user?.email?.trim() || 'Platform Admin';
}

@Controller('platform/restaurants')
@UseGuards(PlatformJwtGuard)
export class RestaurantsController {
  constructor(
    private readonly service: RestaurantService,
    private readonly billingService: PlatformBillingService,
    private readonly supportService: PlatformSupportService,
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
  async create(
    @Body() dto: CreateRestaurantDto,
    @Req() req: { user?: Partial<PlatformAdminEntity> },
  ) {
    const created = await this.service.create(dto, resolveActorName(req));
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

  @Post(':id/billing/payments')
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordRestaurantPaymentDto,
    @Req() req: { user?: Partial<PlatformAdminEntity> },
  ) {
    const updated = await this.billingService.recordPaymentReceived(
      id,
      dto,
      resolveActorName(req),
    );
    return sanitizeRestaurant(updated);
  }

  @Post(':id/billing/mark-paid')
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordRestaurantPaymentDto,
    @Req() req: { user?: Partial<PlatformAdminEntity> },
  ) {
    const updated = await this.billingService.recordPaymentReceived(
      id,
      dto,
      resolveActorName(req),
    );
    return sanitizeRestaurant(updated);
  }

  @Put(':id/billing/payments/:paymentId')
  async updatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdateRestaurantPaymentDto,
    @Req() req: { user?: Partial<PlatformAdminEntity> },
  ) {
    const updated = await this.billingService.updatePaymentRecord(
      id,
      paymentId,
      dto,
      resolveActorName(req),
    );
    return sanitizeRestaurant(updated);
  }

  @Delete(':id/billing/payments/:paymentId')
  async deletePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    const updated = await this.billingService.deletePaymentRecord(id, paymentId);
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

  @Post(':id/billing/unsuspend')
  async unsuspendAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendRestaurantBillingDto,
  ) {
    const updated = await this.billingService.unsuspendAccess(id, dto?.note);
    return sanitizeRestaurant(updated);
  }

  @Get(':id/diagnostics')
  getDiagnostics(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.getDiagnostics(id);
  }

  @Post(':id/support-action')
  executeSupportAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ExecuteSupportActionDto,
    @Req() req: { user?: Partial<PlatformAdminEntity> },
  ) {
    return this.supportService.executeSupportAction(
      id,
      body,
      resolveActorName(req),
    );
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

  @Post('suspend-all-unpaid')
  suspendAllUnpaid() {
    return this.billingService.suspendAllUnpaidRestaurants();
  }
}
