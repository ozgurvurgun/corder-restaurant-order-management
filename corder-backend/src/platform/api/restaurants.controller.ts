import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RestaurantService } from '../application/restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';
import { CategoryService } from '../../restaurant/application/category.service';

@Controller('platform/restaurants')
@UseGuards(PlatformJwtGuard)
export class RestaurantsController {
  constructor(
    private readonly service: RestaurantService,
    private readonly categoryService: CategoryService,
  ) {}

  @Get()
  async findAll() {
    const list = await this.service.findAll();
    return list.map((r) => {
      const { terminalPasswordHash, ...rest } = r;
      return rest;
    });
  }

  /** Product categories defined in the panel (IDs for printer mapping, etc.). */
  @Get(':id/categories')
  async listCategories(@Param('id') id: string) {
    await this.service.findOne(id);
    return this.categoryService.findByRestaurant(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const r = await this.service.findOne(id);
    const { terminalPasswordHash, ...rest } = r;
    return rest;
  }

  @Post()
  create(@Body() dto: CreateRestaurantDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRestaurantDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
