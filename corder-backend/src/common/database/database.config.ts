import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const skipMigrations = this.config.get<string>('SKIP_MIGRATIONS_ON_START') === 'true';
    const runMigrations = isProd && !skipMigrations;

    return {
      type: 'postgres',
      host: this.config.get('DB_HOST', 'localhost'),
      port: this.config.get<number>('DB_PORT', 5432),
      username: this.config.get('DB_USERNAME', 'corder'),
      password: this.config.get('DB_PASSWORD', 'corder_secret'),
      database: this.config.get('DB_NAME', 'corder'),
      autoLoadEntities: true,
      synchronize: !isProd,
      logging: this.config.get('NODE_ENV') === 'development',
      migrations: [join(__dirname, '..', '..', 'migrations', '*.js')],
      migrationsRun: runMigrations,
    };
  }
}
