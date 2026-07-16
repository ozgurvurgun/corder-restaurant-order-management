import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from '../application/ledger.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/ledger-customers')
@UseGuards(RestaurantJwtGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  list(
    @RestaurantId() restaurantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledger.listCustomers(restaurantId, from, to);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @Body() body: { name: string; phone?: string; notes?: string },
  ) {
    return this.ledger.createCustomer(restaurantId, body);
  }

  @Get(':id/entries')
  entries(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ledger.listEntries(restaurantId, id, from, to);
  }

  @Post(':id/payments')
  pay(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() body: { amount: number },
  ) {
    return this.ledger.addPayment(restaurantId, id, body.amount, user.name, user.id);
  }
}
