import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ProductService } from '../application/product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/products')
@UseGuards(RestaurantJwtGuard)
export class ProductsController {
  constructor(private readonly service: ProductService) {}

  @Get()
  findAll(@RestaurantId() restaurantId: string) {
    return this.service.findByRestaurant(restaurantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.findOne(id, restaurantId);
  }

  @Post()
  create(@RestaurantId() restaurantId: string, @Body() dto: CreateProductDto) {
    return this.service.create(restaurantId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(id, restaurantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.service.remove(id, restaurantId);
  }

  @Post('reorder')
  reorder(
    @RestaurantId() restaurantId: string,
    @Body() body: { ids: string[] },
  ) {
    return this.service.reorder(restaurantId, body.ids ?? []);
  }
}
