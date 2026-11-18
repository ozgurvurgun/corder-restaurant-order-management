# Database Architecture & Operations (`corder-backend`)

This document summarizes the schema design, migration strategy, indexing, and operational practices for the CORDER PostgreSQL database.

## Schema & Migration Strategy

- **Production (`NODE_ENV=production`)**:
  - `synchronize` is strictly disabled (`false`) even if `DB_SYNCHRONIZE=true` is set in the environment.
  - Migrations under `src/migrations/*.ts` run automatically on application startup (`migrationsRun: true`, `migrationsTransactionMode: 'each'`) unless `SKIP_MIGRATIONS_ON_START=true` is set.
  - Manual migration execution:
    ```bash
    pnpm run build
    pnpm run migration:run
    # Rollback last migration:
    pnpm run migration:revert
    ```
- **Development (`NODE_ENV=development`)**:
  - When `DB_SYNCHRONIZE=true`, TypeORM synchronizes entity metadata directly and skips `migrationsRun` to avoid DDL collisions.
  - When `DB_SYNCHRONIZE=false` (recommended default), startup runs migrations identically to production.

## Migration History

1. `1760000000000-CoreAndCatalogSchema.ts`: Core platform (`platform_admins`, `restaurants`, `root_admins`, `boss_restaurants`), RBAC (`restaurant_roles`, `restaurant_staff`), POS (`tables`, `categories`, `products`, `orders`, `order_items`), printing (`print_jobs`), and marketing (`campaigns`).
2. `1760000001000-BillingAndInventorySchema.ts`: Cash register (`cash_shifts`, `cash_transactions`, `completed_orders`), tabs & credit (`open_accounts`, `open_account_items`, `open_account_payments`, `ledger_customers`, `ledger_entries`), inventory (`suppliers`, `stock_materials`, `stock_movements`, `purchase_orders`, `inventory_counts`), printer configs (`restaurant_printer_configs`), and audit logs (`restaurant_audit_logs`).
3. `1760000002000-FranchiseHierarchyAndBillingSchema.ts`: Franchise hierarchy and subscription billing columns on `restaurants` and `root_admins`, plus `platform_billing_configs`.
4. `1760000003000-ProductionSchemaAlignmentAndHardening.ts`:
   - Replaces the overly restrictive `(restaurant_id, slug)` category unique constraint with parent-scoped partial unique indexes (`UQ_categories_restaurant_root_slug` where `parent_id IS NULL` and `UQ_categories_restaurant_parent_slug` where `parent_id IS NOT NULL`).
   - Aligns all timestamp columns to `TIMESTAMPTZ`.
   - Adds `ON DELETE SET NULL` foreign keys on `restaurants.root_admin_id`, `tables.session_staff_id`, `stock_materials.supplier_id`, `ledger_entries.table_id`, and `ledger_entries.completed_order_id`.
   - Adds partial unique index `UQ_restaurants_terminal_email` and composite tenant indexes for hot POS and reporting queries.
5. `1760000004000-SubscriptionPeriodLedgerSchema.ts`:
   - Adds `restaurants.billing_start_period` (`YYYY-MM`) and creates normalized `restaurant_subscription_payments` table supporting single/multi-month (`periods text[]`), payment date (`paid_at`), payment method, edit/delete ledger operations, and drops legacy `restaurants.payment_history` JSONB column.
6. `1760000005000-StandardizeCorderAppEmails.ts`:
   - Standardizes all existing `platform_admins.email` (`<local>@corder.app`), `restaurants.terminal_email` (`<local>@<slug>.corder.app`), `restaurant_staff.email` (`<local>@<restaurant-slug>.corder.app`), and `root_admins.email` (`<local>@<brand-or-branch-slug>.corder.app`).

## Key Constraints & Indexes

- **Tenant Isolation**: Every business table includes `restaurant_id` (or belongs to a parent row with `restaurant_id`) with `ON DELETE CASCADE` referential integrity.
- **Single Open Shift Guarantee**: Partial unique index `IDX_cash_shifts_one_open_per_restaurant ON cash_shifts(restaurant_id) WHERE status = 'open'` prevents race conditions from opening multiple concurrent cash shifts in the same branch.
- **Hot Tenant Indexes**:
  - `orders(restaurant_id, status)`, `orders(restaurant_id, table_id, status)`, `orders(restaurant_id, created_at)`
  - `order_items(order_id)`, `order_items(order_id, status)`
  - `tables(restaurant_id, section, name)`, `tables(restaurant_id, status)`
  - `categories(restaurant_id, slug) WHERE parent_id IS NULL`, `categories(restaurant_id, parent_id, slug) WHERE parent_id IS NOT NULL`
  - `completed_orders(restaurant_id, closed_at)`, `completed_orders(restaurant_id, waiter)`
  - `cash_shifts(restaurant_id, status)`, `cash_shifts(restaurant_id, opened_at)`
  - `ledger_entries(restaurant_id, customer_id, created_at)`, `ledger_entries(restaurant_id, completed_order_id)`
  - `stock_movements(restaurant_id, material_id, created_at)`
  - `print_jobs(restaurant_id, printed_at, created_at)`

## Backups & Scaling Notes

1. **Automated Pre-Deploy Backups**: `deploy/remote-deploy.sh` automatically runs `pg_dump` before applying new containers/migrations and retains the 10 most recent compressed dumps in `corder-backend/backups/`.
2. **Connection Pooling**: Configurable via `DB_POOL_MAX` (default `20`), with 5s connection timeout and 30s idle timeout.
3. **Horizontal Scaling (Socket.IO & Rate Limiting)**:
   - By default, `corder-backend` runs as a single API container instance behind nginx.
   - `OrdersGateway` (Socket.IO `/ws` rooms) and `LoginRateLimiterService` store state in process memory. If scaling the `api` service beyond 1 replica, attach `@socket.io/redis-adapter` and a shared Redis store for rate limiting.
