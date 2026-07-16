import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OpenAccountsService } from '../application/open-accounts.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/open-accounts')
@UseGuards(RestaurantJwtGuard)
export class OpenAccountsController {
  constructor(private readonly service: OpenAccountsService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.service.list(restaurantId);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body()
    body: {
      customerName: string;
      customerPhone?: string;
      amount?: number;
      description?: string;
      createdBy?: string;
      items?: Array<{
        productName: string;
        quantity: number;
        price: number;
        productId?: string;
        note?: string;
      }>;
    },
  ) {
    return this.service.create(restaurantId, {
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      amount: body.amount,
      description: body.description,
      createdBy: body.createdBy ?? user.name,
      items: body.items,
    });
  }

  @Post(':id/pay')
  pay(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() body: { amount: number },
  ) {
    return this.service.pay(restaurantId, id, body.amount, user.name, user.id);
  }
}
