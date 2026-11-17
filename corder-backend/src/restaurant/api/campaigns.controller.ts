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
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';

@Controller('restaurant/campaigns')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignService) {}

  @Get()
  @RequirePermissions('catalog.view', 'catalog.manage_campaigns')
  list(@RestaurantId() restaurantId: string) {
    return this.service.list(restaurantId);
  }

  @Post()
  @RequirePermissions('catalog.manage_campaigns')
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
      validUntil:
        body.validUntil && body.validUntil.trim()
          ? new Date(body.validUntil)
          : null,
      isActive: body.isActive,
    });
  }

  @Put(':id')
  @RequirePermissions('catalog.manage_campaigns')
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
      validUntil:
        body.validUntil === undefined
          ? undefined
          : body.validUntil && body.validUntil.trim()
            ? new Date(body.validUntil)
            : null,
      isActive: body.isActive,
    });
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage_campaigns')
  remove(
    @RestaurantId() restaurantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(restaurantId, id);
  }

  @Post('reorder')
  @RequirePermissions('catalog.manage_campaigns')
  reorder(@RestaurantId() restaurantId: string, @Body() body: ReorderItemsDto) {
    return this.service.reorder(restaurantId, body.ids ?? []);
  }
}
