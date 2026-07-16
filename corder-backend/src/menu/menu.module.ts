import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantEntity } from '../platform/domain/restaurant.entity';
import { CategoryEntity } from '../restaurant/domain/category.entity';
import { ProductEntity } from '../restaurant/domain/product.entity';
import { CampaignEntity } from '../restaurant/domain/campaign.entity';
import { MenuQueryService } from './application/menu-query.service';
import { MenuController } from './api/menu.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RestaurantEntity, CategoryEntity, ProductEntity, CampaignEntity]),
  ],
  controllers: [MenuController],
  providers: [MenuQueryService],
  exports: [MenuQueryService],
})
export class MenuModule {}
