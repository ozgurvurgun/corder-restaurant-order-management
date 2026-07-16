# CORDER Backend

NestJS API for CORDER (restaurants, menu, panel, terminal).

## Development

```bash
cp .env.example .env
./start-dev.sh
# or: pnpm run start:dev  (PostgreSQL must already be running on :5432)
```

API default: `http://localhost:4000`

## Production

See `.env.production.example`, `docker-compose.yml`, and `deploy/remote-deploy.sh`.

Database notes: [docs/DATABASE.md](docs/DATABASE.md).
