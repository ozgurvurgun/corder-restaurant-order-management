import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './common/database/database.config';
import { validateRequiredStartupEnv } from './common/security/env.validation';
import { SecurityModule } from './common/security/security.module';
import { PlatformModule } from './platform/platform.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { MenuModule } from './menu/menu.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateRequiredStartupEnv,
    }),
    SecurityModule,
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    PlatformModule,
    RestaurantModule,
    MenuModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
