import { join } from 'path';
import { DataSource } from 'typeorm';

const isProd = process.env.NODE_ENV === 'production';
const password = process.env.DB_PASSWORD ?? '';
if (isProd && !password.trim()) {
  throw new Error('Missing required environment variable: DB_PASSWORD');
}

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
});
