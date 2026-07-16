import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { StaffService } from '../application/staff.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Controller('restaurant/staff')
@UseGuards(RestaurantJwtGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.staffService.list(restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.create(restaurantId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(restaurantId, id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.staffService.delete(restaurantId, id);
  }
}
