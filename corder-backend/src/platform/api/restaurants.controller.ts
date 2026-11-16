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
import { RestaurantService } from '../application/restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PlatformJwtGuard } from '../infrastructure/platform-jwt.guard';
import { CategoryService } from '../../restaurant/application/category.service';

function sanitizeRestaurant<
  T extends { terminalPasswordHash?: unknown; printAgentTokenHash?: unknown },
>(r: T) {
  const { terminalPasswordHash, printAgentTokenHash, ...rest } = r;
  return rest;
}

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
    return list.map(sanitizeRestaurant);
  }

  /** Product categories defined in the panel (IDs for printer mapping, etc.). */
  @Get(':id/categories')
  async listCategories(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.findOne(id);
    return this.categoryService.findByRestaurant(id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.service.findOne(id);
    return sanitizeRestaurant(r);
  }

  @Post()
  async create(@Body() dto: CreateRestaurantDto) {
    const created = await this.service.create(dto);
    return sanitizeRestaurant(created);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    const updated = await this.service.update(id, dto);
    return sanitizeRestaurant(updated);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
