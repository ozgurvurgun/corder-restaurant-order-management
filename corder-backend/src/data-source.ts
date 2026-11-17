import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

const envCandidates = [join(process.cwd(), '.env'), join(__dirname, '..', '.env')];
for (const envPath of envCandidates) {
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Ignore if already loaded or unreadable
    }
  }
}

const isProd = process.env.NODE_ENV === 'production';
const password = process.env.DB_PASSWORD ?? '';
if (isProd && !password.trim()) {
  throw new Error('Missing required environment variable: DB_PASSWORD');
}

const sslEnabled = process.env.DB_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'corder',
  password,
  database: process.env.DB_NAME ?? 'corder',
  entities: [join(__dirname, '**', '*.entity.js')],
  migrations: [join(__dirname, 'migrations', '*.js')],
  synchronize: false,
  migrationsRun: false,
  migrationsTransactionMode: 'each',
  ssl: sslEnabled
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});
