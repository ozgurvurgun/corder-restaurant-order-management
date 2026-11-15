import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { requireConfigSecret } from '../security/env.validation';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const skipMigrations = this.config.get<string>('SKIP_MIGRATIONS_ON_START') === 'true';
    const runMigrations = isProd && !skipMigrations;
    const password = isProd
      ? requireConfigSecret(this.config, 'DB_PASSWORD')
      : (this.config.get<string>('DB_PASSWORD') ?? '');

    return {
      type: 'postgres',
      host: this.config.get('DB_HOST', 'localhost'),
      port: this.config.get<number>('DB_PORT', 5432),
      username: this.config.get('DB_USERNAME', 'corder'),
      password,
      database: this.config.get('DB_NAME', 'corder'),
      autoLoadEntities: true,
      synchronize: !isProd,
      logging: this.config.get('NODE_ENV') === 'development',
      migrations: [join(__dirname, '..', '..', 'migrations', '*.js')],
      migrationsRun: runMigrations,
    };
  }
}
