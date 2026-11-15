import { Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { OrderService } from '../application/order.service';
import { PrintAgentGuard, type PrintAgentRequest } from '../infrastructure/print-agent.guard';

/**
 * Print-agent HTTP fallback channel for kitchen tickets, receipts, and cancellation tickets.
 * Auth: `Authorization: Bearer` = restaurant `print_agent_token` (scoped to restaurantId).
 */
@Controller('restaurant/print-agent')
@UseGuards(PrintAgentGuard)
export class PrintAgentController {
  constructor(private readonly orders: OrderService) {}

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
