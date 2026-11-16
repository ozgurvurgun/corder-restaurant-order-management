import { Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { OrderService } from '../application/order.service';
import { CategoryService } from '../application/category.service';
import { PrintersService } from '../application/printers.service';
import { RestaurantSettingsService } from '../application/restaurant-settings.service';
import { PrintAgentGuard, type PrintAgentRequest } from '../infrastructure/print-agent.guard';

/**
 * Print-agent HTTP channel for branch discovery, category routing, kitchen tickets, receipts, and cancellation tickets.
 * Auth: `Authorization: Bearer` = restaurant `print_agent_token` (scoped to restaurantId).
 */
@Controller('restaurant/print-agent')
@UseGuards(PrintAgentGuard)
export class PrintAgentController {
  constructor(
    private readonly orders: OrderService,
    private readonly categoryService: CategoryService,
    private readonly printersService: PrintersService,
    private readonly settingsService: RestaurantSettingsService,
  ) {}

  @Get('context')
  async getAgentContext(@Req() req: PrintAgentRequest) {
    const restaurantId = req.printAgentRestaurantId;
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

  @Get('pending-kitchen-orders')
  pendingKitchen(@Req() req: PrintAgentRequest) {
    return this.orders.findPendingKitchenPrints(req.printAgentRestaurantId);
  }

  @Patch('orders/:orderId/kitchen-printed')
  kitchenPrinted(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: PrintAgentRequest,
  ) {
    return this.orders.markKitchenTicketPrinted(req.printAgentRestaurantId, orderId);
  }

  @Get('pending-print-jobs')
  pendingPrintJobs(@Req() req: PrintAgentRequest) {
    return this.orders.findPendingPrintJobs(req.printAgentRestaurantId);
  }

  @Patch('print-jobs/:jobId/printed')
  printJobPrinted(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Req() req: PrintAgentRequest,
  ) {
    return this.orders.markPrintJobPrinted(req.printAgentRestaurantId, jobId);
  }
}
