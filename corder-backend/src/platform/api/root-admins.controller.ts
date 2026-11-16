import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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
    @Body() dto: CreateRootAdminDto,
  ) {
    return this.service.create({ ...dto, restaurantId });
  }

  @Post('link/:bossId')
  linkExisting(
    @Param('restaurantId') restaurantId: string,
    @Param('bossId') bossId: string,
  ) {
    return this.service.linkExistingBossToRestaurant(bossId, restaurantId);
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
  remove(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(id, restaurantId);
  }
}

@Controller('platform/bosses')
@UseGuards(PlatformJwtGuard)
export class PlatformBossesController {
  constructor(private readonly service: RootAdminService) {}

  @Get()
  findAll() {
    return this.service.findAllBosses();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRootAdminDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRootAdminDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/restaurants/:restaurantId')
  linkRestaurant(
    @Param('id') id: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.service.linkExistingBossToRestaurant(id, restaurantId);
  }

  @Delete(':id/restaurants/:restaurantId')
  unlinkRestaurant(
    @Param('id') id: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.service.unlinkBossFromRestaurant(id, restaurantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
