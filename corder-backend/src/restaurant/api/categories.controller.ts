import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CategoryService } from '../application/category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/categories')
@UseGuards(RestaurantJwtGuard)
export class CategoriesController {
  constructor(private readonly service: CategoryService) {}

  @Get()
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateCategoryDto) {
    return this.service.create(restaurantId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(id, restaurantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }

  @Post('reorder')
  reorder(@RestaurantId() restaurantId: string, @Body() body: ReorderCategoriesDto) {
    return this.service.reorder(restaurantId, body);
  }
}
