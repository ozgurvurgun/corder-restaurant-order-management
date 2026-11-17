import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LedgerService } from '../application/ledger.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import {
  AddLedgerPaymentDto,
  CreateLedgerCustomerDto,
} from './dto/create-ledger-customer.dto';

@Controller('restaurant/ledger-customers')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @RequirePermissions('ledger.view', 'ledger.assign_order', 'billing.close_check')
  list(
    @RestaurantId() restaurantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledger.listCustomers(restaurantId, from, to);
  }

  @Post()
  @RequirePermissions('ledger.manage_customers')
  create(
    @RestaurantId() restaurantId: string,
    @Body() body: CreateLedgerCustomerDto,
  ) {
    return this.ledger.createCustomer(restaurantId, body);
  }

  @Get(':id/entries')
  @RequirePermissions('ledger.view', 'ledger.assign_order', 'billing.close_check')
  entries(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledger.listEntries(restaurantId, id, from, to);
  }

  @Post(':id/payments')
  @RequirePermissions('ledger.collect_payment')
  pay(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() body: AddLedgerPaymentDto,
  ) {
    return this.ledger.addPayment(
      restaurantId,
      id,
      body.amount,
      user.name,
      user.id,
      body.paymentMethod ?? 'cash',
    );
  }
}
