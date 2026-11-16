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
import { PrintAgentGuard, type PrintAgentRequest } from '../infrastructure/print-agent.guard';
import { PrintAgentLoginDto } from './dto/print-agent-login.dto';
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
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Body() dto: PrintAgentLoginDto) {
    this.rateLimiter.consumeLoginAttempt('print-agent', extractClientIp(req), dto.username);
    const { accessToken, restaurant } = await this.authService.loginPrintAgent(
      dto.username,
      dto.password,
    );
    const context = await this.buildContext(restaurant.id);
    return {
      accessToken,
      ...context,
    };
  }

  @Get('context')
  @UseGuards(PrintAgentGuard)
  async getAgentContext(@Req() req: PrintAgentRequest) {
    return this.buildContext(req.printAgentRestaurantId);
  }

  @Get('pending-kitchen-orders')
  @UseGuards(PrintAgentGuard)
  pendingKitchen(@Req() req: PrintAgentRequest) {
    return this.orders.findPendingKitchenPrints(req.printAgentRestaurantId);
  }

  @Patch('orders/:orderId/kitchen-printed')
  @UseGuards(PrintAgentGuard)
  kitchenPrinted(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: PrintAgentRequest,
  ) {
    return this.orders.markKitchenTicketPrinted(req.printAgentRestaurantId, orderId);
  }

  @Get('pending-print-jobs')
  @UseGuards(PrintAgentGuard)
  pendingPrintJobs(@Req() req: PrintAgentRequest) {
    return this.orders.findPendingPrintJobs(req.printAgentRestaurantId);
  }

  @Patch('print-jobs/:jobId/printed')
  @UseGuards(PrintAgentGuard)
  printJobPrinted(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Req() req: PrintAgentRequest,
  ) {
    return this.orders.markPrintJobPrinted(req.printAgentRestaurantId, jobId);
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
        port: p.port ?? null,
        department: p.department ?? null,
        paperWidth: p.paperWidth,
        autoCut: p.autoCut,
      })),
    };
  }
}
