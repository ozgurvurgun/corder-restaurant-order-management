import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OpenAccountsService } from '../application/open-accounts.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { CreateOpenAccountDto } from './dto/create-open-account.dto';
import { PayOpenAccountDto } from './dto/pay-open-account.dto';

@Controller('restaurant/open-accounts')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
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
    @Body() body: CreateOpenAccountDto,
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
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() body: PayOpenAccountDto,
  ) {
    return this.service.pay(
      restaurantId,
      id,
      body.amount,
      user.name,
      user.id,
      body.paymentMethod ?? 'cash',
    );
  }
}
