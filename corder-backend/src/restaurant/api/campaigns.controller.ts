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
import { CampaignService } from '../application/campaign.service';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import {
  CreateCampaignBodyDto,
  UpdateCampaignBodyDto,
} from './dto/create-campaign.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/campaigns')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignService) {}

  @Get()
  list(@RestaurantId() restaurantId: string) {
    return this.service.list(restaurantId);
  }

  @Post()
  create(
    @RestaurantId() restaurantId: string,
    @Body() body: CreateCampaignBodyDto,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCampaignBodyDto,
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
  remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(restaurantId, id);
  }

  @Post('reorder')
  reorder(@RestaurantId() restaurantId: string, @Body() body: ReorderItemsDto) {
    return this.service.reorder(restaurantId, body.ids ?? []);
  }
}
