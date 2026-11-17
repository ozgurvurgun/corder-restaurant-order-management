# CORDER Backend

NestJS 10 + TypeORM 0.3 + PostgreSQL 16 + Socket.IO API for CORDER (multi-tenant restaurant POS, panel, waiter terminal, boss PWA, platform admin, and print-agent).

## Development

```bash
cp .env.example .env
./start-dev.sh
# or: pnpm run start:dev  (PostgreSQL must already be running on :5432)
```

- API default: `http://localhost:4000`
- Health & Readiness:
  - `GET /health` — full health check (includes PostgreSQL `SELECT 1` connectivity check)
  - `GET /health/live` — lightweight process liveness probe
  - `GET /health/ready` — readiness probe (verifies DB pool initialization + query)

## Verification & Testing

```bash
# TypeScript typecheck
pnpm run typecheck

# Unit tests (Node 20 built-in node:test runner via tsconfig.test.json)
pnpm test

# Production build
pnpm run build
```

## Database Migrations & Demo Seed

```bash
# Run pending TypeORM migrations manually
pnpm run build
pnpm run migration:run

# Revert last migration
pnpm run migration:revert

# Seed realistic multi-branch demo data
pnpm run seed:demo
```

## Production & Scaling Notes

See `.env.production.example`, `docker-compose.yml`, `deploy/nginx.conf`, and `deploy/remote-deploy.sh`.

- **Migrations on Startup**: In production (`NODE_ENV=production`), `DB_SYNCHRONIZE` is always disabled and TypeORM migrations run automatically on startup unless `SKIP_MIGRATIONS_ON_START=true` is set.
- **Socket.IO & Rate Limiter Scaling**: The default Docker Compose topology runs a single `api` container replica because Socket.IO room broadcasts (`/ws`) and login/PIN rate limiting use in-memory state. To run multiple `api` replicas behind a load balancer, configure `@socket.io/redis-adapter` and a shared Redis store.
- Database architecture & index notes: [docs/DATABASE.md](docs/DATABASE.md).
