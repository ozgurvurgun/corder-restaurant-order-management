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
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard, RequirePermissions } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { PrintersService } from '../application/printers.service';
import { OrdersGateway } from './orders.gateway';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@Controller('restaurant/printers')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class PrintersController {
  constructor(
    private readonly printers: PrintersService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  @Get()
  @RequirePermissions('system.manage_printers', 'order.print_receipt')
  list(@RestaurantId() restaurantId: string) {
    return this.printers.list(restaurantId);
  }

  @Post()
  @RequirePermissions('system.manage_printers')
  async create(@RestaurantId() restaurantId: string, @Body() body: CreatePrinterDto) {
    const created = await this.printers.create(restaurantId, body);
    this.ordersGateway.emitPrintersUpdated(restaurantId);
    return created;
  }

  @Put(':id')
  @RequirePermissions('system.manage_printers')
  async update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePrinterDto,
  ) {
    const updated = await this.printers.update(restaurantId, id, body);
    this.ordersGateway.emitPrintersUpdated(restaurantId);
    return updated;
  }

  @Delete(':id')
  @RequirePermissions('system.manage_printers')
  async remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const res = await this.printers.remove(restaurantId, id);
    this.ordersGateway.emitPrintersUpdated(restaurantId);
    return res;
  }
}

