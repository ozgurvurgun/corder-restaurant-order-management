import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CampaignService } from '../application/campaign.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/campaigns')
@UseGuards(RestaurantJwtGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.service.list(restaurantId);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      imageUrl: string;
      discountPercent?: number;
      originalPrice?: number;
      discountedPrice?: number;
      validUntil?: string;
      isActive?: boolean;
    },
  ) {
    return this.service.create(restaurantId, {
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      discountPercent: body.discountPercent,
      originalPrice: body.originalPrice,
      discountedPrice: body.discountedPrice,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      isActive: body.isActive,
    });
  }

  @Put(':id')
  update(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      imageUrl?: string;
      discountPercent?: number;
      originalPrice?: number;
      discountedPrice?: number;
      validUntil?: string;
      isActive?: boolean;
    },
  ) {
    return this.service.update(restaurantId, id, {
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      discountPercent: body.discountPercent,
      originalPrice: body.originalPrice,
      discountedPrice: body.discountedPrice,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      isActive: body.isActive,
    });
  }

  @Delete(':id')
  remove(@RestaurantId() restaurantId: string, @Param('id') id: string) {
    return this.service.remove(restaurantId, id);
  }

  @Post('reorder')
  reorder(@RestaurantId() restaurantId: string, @Body() body: { ids: string[] }) {
    return this.service.reorder(restaurantId, body.ids ?? []);
  }
}

