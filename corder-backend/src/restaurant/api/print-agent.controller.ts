import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrderService } from '../application/order.service';
import { CategoryService } from '../application/category.service';
import { PrintersService } from '../application/printers.service';
import { RestaurantSettingsService } from '../application/restaurant-settings.service';
import { RestaurantAuthService } from '../application/restaurant-auth.service';
import { OrdersGateway } from './orders.gateway';
import { PrintAgentGuard, type PrintAgentRequest } from '../infrastructure/print-agent.guard';
import { PrintAgentLoginDto, PrintAgentRefreshDto } from './dto/print-agent-login.dto';
import { SyncPrintersDto } from './dto/sync-printers.dto';
import {
  extractClientIp,
  LoginRateLimiterService,
} from '../../common/security/login-rate-limiter.service';

@Controller('restaurant/print-agent')
export class PrintAgentController {
  constructor(
    private readonly authService: RestaurantAuthService,
    private readonly rateLimiter: LoginRateLimiterService,
    private readonly orders: OrderService,
    private readonly categoryService: CategoryService,
    private readonly printersService: PrintersService,
    private readonly settingsService: RestaurantSettingsService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Body() dto: PrintAgentLoginDto) {
    const clientIp = extractClientIp(req);
    this.rateLimiter.consumeLoginAttempt('print-agent', clientIp, dto.username);
    const { accessToken, refreshToken, restaurant } = await this.authService.loginPrintAgent(
      dto.username,
      dto.password,
    );
    this.rateLimiter.resetLoginAttempts('print-agent', clientIp, dto.username);
    const context = await this.buildContext(restaurant.id);
    return {
      accessToken,
      refreshToken,
      ...context,
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Body() dto: PrintAgentRefreshDto) {
    const clientIp = extractClientIp(req);
    this.rateLimiter.consumeLoginAttempt('print-agent', clientIp, 'refresh-token');
    const refreshed = await this.authService.refreshPrintAgentSession(dto.refreshToken);
    this.rateLimiter.resetLoginAttempts('print-agent', clientIp, 'refresh-token');
    return refreshed;
  }

  @Get('context')
  @UseGuards(PrintAgentGuard)
  async getAgentContext(@Req() req: PrintAgentRequest) {
    await this.touchHeartbeat(req.printAgentRestaurantId);
    return this.buildContext(req.printAgentRestaurantId);
  }

  async getContext(reqOrRestaurantId: PrintAgentRequest | string) {
    const restaurantId =
      typeof reqOrRestaurantId === 'string'
        ? reqOrRestaurantId
        : reqOrRestaurantId.printAgentRestaurantId;
    return this.buildContext(restaurantId);
  }

  @Post('logout')
  @UseGuards(PrintAgentGuard)
  async logout(@Req() req: PrintAgentRequest) {
    await this.printersService.markAgentLoggedOut(req.printAgentRestaurantId);
    this.ordersGateway.emitPrintersUpdated(req.printAgentRestaurantId);
    return { ok: true };
  }

  @Get('pending-kitchen-orders')
  @UseGuards(PrintAgentGuard)
  async pendingKitchen(@Req() req: PrintAgentRequest) {
    await this.touchHeartbeat(req.printAgentRestaurantId);
    return this.orders.findPendingKitchenPrints(req.printAgentRestaurantId);
  }

  @Patch('orders/:orderId/kitchen-printed')
  @UseGuards(PrintAgentGuard)
  async kitchenPrinted(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: PrintAgentRequest,
  ) {
    await this.touchHeartbeat(req.printAgentRestaurantId);
    const res = await this.orders.markKitchenTicketPrinted(req.printAgentRestaurantId, orderId);
    this.ordersGateway.emitOrdersUpdated(req.printAgentRestaurantId);
    return res;
  }

  @Get('pending-print-jobs')
  @UseGuards(PrintAgentGuard)
  async pendingPrintJobs(@Req() req: PrintAgentRequest) {
    await this.touchHeartbeat(req.printAgentRestaurantId);
    return this.orders.findPendingPrintJobs(req.printAgentRestaurantId);
  }

  @Patch('print-jobs/:jobId/printed')
  @UseGuards(PrintAgentGuard)
  async printJobPrinted(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Req() req: PrintAgentRequest,
  ) {
    await this.touchHeartbeat(req.printAgentRestaurantId);
    return this.orders.markPrintJobPrinted(req.printAgentRestaurantId, jobId);
  }

  @Post('printers/sync')
  @UseGuards(PrintAgentGuard)
  async syncPrinters(
    @Req() req: PrintAgentRequest,
    @Body() body: SyncPrintersDto,
  ) {
    const printers = await this.printersService.syncFromPrintAgent(
      req.printAgentRestaurantId,
      body ?? {},
    );
    return { ok: true, printers };
  }

  private async touchHeartbeat(restaurantId: string): Promise<void> {
    const becameOnline =
      await this.printersService.recordAgentHttpHeartbeat(restaurantId);
    if (becameOnline) {
      this.ordersGateway.emitPrintersUpdated(restaurantId);
    }
  }

  private async buildContext(restaurantId: string) {
    const [settings, categories, printers] = await Promise.all([
      this.settingsService.get(restaurantId),
      this.categoryService.findByRestaurant(restaurantId),
      this.printersService.list(restaurantId),
    ]);
    return {
      restaurant: {
        id: restaurantId,
        name: settings.name,
        address: settings.address ?? null,
        phone: settings.phone ?? null,
      },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId ?? null,
        order: c.order,
      })),
      printers: printers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        connection: p.connection,
        ipAddress: p.ipAddress ?? null,
        systemPrinterName: p.connection === 'usb' ? (p.ipAddress ?? null) : null,
        port: p.port ?? null,
        department: p.department ?? null,
        paperWidth: p.paperWidth,
        autoCut: p.autoCut,
      })),
    };
  }
}

