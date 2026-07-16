import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RootAdminService } from '../application/root-admin.service';
import { CreateRootAdminDto } from './dto/create-root-admin.dto';
import { UpdateRootAdminDto } from './dto/update-root-admin.dto';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';

@Controller('platform/restaurants/:restaurantId/root-admins')
@UseGuards(PlatformJwtGuard)
export class RootAdminsController {
  constructor(private readonly service: RootAdminService) {}

  @Get()
  findByRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.service.findByRestaurantId(restaurantId);
  }

  @Post()
  create(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: Omit<CreateRootAdminDto, 'restaurantId'>,
  ) {
    return this.service.create({ ...dto, restaurantId } as CreateRootAdminDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRootAdminDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
