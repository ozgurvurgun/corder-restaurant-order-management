import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAdminEntity } from './domain/platform-admin.entity';
import { RestaurantEntity } from './domain/restaurant.entity';
import { RootAdminEntity } from './domain/root-admin.entity';
import { BossRestaurantEntity } from './domain/boss-restaurant.entity';
import { PlatformBillingConfigEntity } from './domain/platform-billing-config.entity';
import { RestaurantSubscriptionPaymentEntity } from './domain/restaurant-subscription-payment.entity';
import { PlatformNotificationEntity } from './domain/platform-notification.entity';
import { PlatformAuthService } from './application/platform-auth.service';
import { RestaurantService } from './application/restaurant.service';
import { PlatformBillingService } from './application/platform-billing.service';
import { PlatformSupportService } from './application/platform-support.service';
import { PlatformNotificationsService } from './application/platform-notifications.service';
import { RootAdminService } from './application/root-admin.service';
import { PlatformAuthController } from './api/platform-auth.controller';
import {
  PlatformBillingController,
  RestaurantsController,
} from './api/restaurants.controller';
import {
  PlatformBossesController,
  RootAdminsController,
} from './api/root-admins.controller';
import { PlatformNotificationsController } from './api/platform-notifications.controller';
import { PlatformJwtStrategy } from './infrastructure/platform-jwt.strategy';
import { PlatformAdminSeed } from './infrastructure/platform-admin.seed';
import { RestaurantModule } from '../restaurant/restaurant.module';
import {
  DEFAULT_JWT_EXPIRES_IN,
  requireConfigSecret,
} from '../common/security/env.validation';

@Module({
  imports: [
    RestaurantModule,
    TypeOrmModule.forFeature([
      PlatformAdminEntity,
      RestaurantEntity,
      RootAdminEntity,
      BossRestaurantEntity,
      PlatformBillingConfigEntity,
      RestaurantSubscriptionPaymentEntity,
      PlatformNotificationEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'platform-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireConfigSecret(config, 'PLATFORM_JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN) },
      }),
    }),
  ],
  controllers: [
    PlatformAuthController,
    RestaurantsController,
    PlatformBillingController,
    RootAdminsController,
    PlatformBossesController,
    PlatformNotificationsController,
  ],
  providers: [
    PlatformAuthService,
    RestaurantService,
    PlatformBillingService,
    PlatformSupportService,
    PlatformNotificationsService,
    RootAdminService,
    PlatformJwtStrategy,
    PlatformAdminSeed,
  ],
  exports: [
    PlatformAuthService,
    RestaurantService,
    PlatformBillingService,
    PlatformSupportService,
    PlatformNotificationsService,
    RootAdminService,
  ],
})
export class PlatformModule {}
