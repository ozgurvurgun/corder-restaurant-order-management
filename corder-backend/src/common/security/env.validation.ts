import { ConfigService } from '@nestjs/config';

export const DEFAULT_JWT_EXPIRES_IN = '12h';

export function requireEnvString(raw: unknown, name: string): string {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (!val) {
    throw new Error(`${name} environment variable must be set and non-empty`);
  }
  return val;
}

export function requireConfigSecret(config: ConfigService, name: string): string {
  return requireEnvString(config.get<string>(name), name);
}

export function validateRequiredStartupEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  requireEnvString(env.JWT_SECRET, 'JWT_SECRET');
  requireEnvString(env.PLATFORM_JWT_SECRET, 'PLATFORM_JWT_SECRET');
  if (env.NODE_ENV === 'production') {
    requireEnvString(env.DB_PASSWORD, 'DB_PASSWORD');
  }
  return env;
}

