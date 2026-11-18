import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantEntity } from '../platform/domain/restaurant.entity';
import { CategoryEntity } from '../restaurant/domain/category.entity';
import { ProductEntity } from '../restaurant/domain/product.entity';
import { CampaignEntity } from '../restaurant/domain/campaign.entity';
import { TableEntity } from '../restaurant/domain/table.entity';
import { WaiterCallEntity } from '../restaurant/domain/waiter-call.entity';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { MenuQueryService } from './application/menu-query.service';
import { MenuController } from './api/menu.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantEntity,
      CategoryEntity,
      ProductEntity,
      CampaignEntity,
      TableEntity,
      WaiterCallEntity,
    ]),
    forwardRef(() => RestaurantModule),
  ],
  controllers: [MenuController],
  providers: [MenuQueryService],
  exports: [MenuQueryService],
})
export class MenuModule {}
