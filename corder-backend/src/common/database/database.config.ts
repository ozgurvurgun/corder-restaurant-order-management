import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { requireConfigSecret } from '../security/env.validation';

export interface DatabaseRuntimeFlags {
  isProd: boolean;
  synchronize: boolean;
  migrationsRun: boolean;
}

export function resolveDatabaseRuntimeFlags(env: {
  NODE_ENV?: string;
  DB_SYNCHRONIZE?: string;
  SKIP_MIGRATIONS_ON_START?: string;
}): DatabaseRuntimeFlags {
  const isProd = env.NODE_ENV === 'production';
  const synchronize = !isProd && env.DB_SYNCHRONIZE === 'true';
  const skipMigrations = env.SKIP_MIGRATIONS_ON_START === 'true';
  const migrationsRun = !synchronize && !skipMigrations;
  return { isProd, synchronize, migrationsRun };
}

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const flags = resolveDatabaseRuntimeFlags({
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      DB_SYNCHRONIZE: this.config.get<string>('DB_SYNCHRONIZE'),
      SKIP_MIGRATIONS_ON_START: this.config.get<string>('SKIP_MIGRATIONS_ON_START'),
    });

    const password = flags.isProd
      ? requireConfigSecret(this.config, 'DB_PASSWORD')
      : (this.config.get<string>('DB_PASSWORD') ?? '');

    const sslEnabled = this.config.get<string>('DB_SSL') === 'true';
    const poolMaxRaw = Number(this.config.get('DB_POOL_MAX', 20));
    const poolMax =
      Number.isFinite(poolMaxRaw) && poolMaxRaw > 0 ? Math.floor(poolMaxRaw) : 20;

    return {
      type: 'postgres',
      host: this.config.get('DB_HOST', 'localhost'),
      port: Number(this.config.get<number>('DB_PORT', 5432)),
      username: this.config.get('DB_USERNAME', 'corder'),
      password,
      database: this.config.get('DB_NAME', 'corder'),
      autoLoadEntities: true,
      synchronize: flags.synchronize,
      logging:
        this.config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      migrations: [join(__dirname, '..', '..', 'migrations', '*.js')],
      migrationsRun: flags.migrationsRun,
      migrationsTransactionMode: 'each',
      ssl: sslEnabled
        ? {
            rejectUnauthorized:
              this.config.get<string>('DB_SSL_REJECT_UNAUTHORIZED') !== 'false',
          }
        : false,
      extra: {
        max: poolMax,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      },
    };
  }
}
