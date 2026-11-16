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
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { PrintersService } from '../application/printers.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@Controller('restaurant/printers')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class PrintersController {
  constructor(private readonly printers: PrintersService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.printers.list(restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() body: CreatePrinterDto) {
    return this.printers.create(restaurantId, body);
  }

  @Put(':id')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePrinterDto,
  ) {
    return this.printers.update(restaurantId, id, body);
  }

  @Delete(':id')
  remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.printers.remove(restaurantId, id);
  }
}
