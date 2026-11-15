import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAdminEntity } from './domain/platform-admin.entity';
import { RestaurantEntity } from './domain/restaurant.entity';
import { RootAdminEntity } from './domain/root-admin.entity';
import { PlatformAuthService } from './application/platform-auth.service';
import { RestaurantService } from './application/restaurant.service';
import { RootAdminService } from './application/root-admin.service';
import { PlatformAuthController } from './api/platform-auth.controller';
import { RestaurantsController } from './api/restaurants.controller';
import { RootAdminsController } from './api/root-admins.controller';
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
    TypeOrmModule.forFeature([PlatformAdminEntity, RestaurantEntity, RootAdminEntity]),
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
  controllers: [PlatformAuthController, RestaurantsController, RootAdminsController],
  providers: [PlatformAuthService, RestaurantService, RootAdminService, PlatformJwtStrategy, PlatformAdminSeed],
  exports: [PlatformAuthService, RestaurantService, RootAdminService],
})
export class PlatformModule {}
