# Database - Long-term use (5-10 years)

This document summarizes the design decisions and recommendations for running the CORDER database reliably over a long period.

## Strengths

- **PostgreSQL**: Scalable, ACID-compliant, safe for years of production use.
- **Restaurant isolation**: All business data is scoped by `restaurant_id`; multi-tenant setup is sound.
- **Relations**: Foreign keys and `ON DELETE CASCADE` keep referential integrity.
- **Indexes**: Composite indexes for common queries:
  - `orders(restaurant_id, status)`, `orders(restaurant_id, created_at)`
  - `order_items(order_id)`
  - `categories(restaurant_id, slug)` (unique)
  - `cash_shifts(restaurant_id, status)`
  - `restaurant_staff(restaurant_id, pin)`
  - `restaurant_id` indexes on other tables
- **Data types**: UUID primary keys, `decimal` prices, and `timestamptz` timestamps are appropriate choices.

## Recommendations (over the years)

1. **Backups**
   - Daily automated backup (pg_dump or server-side snapshot).
   - Keep at least one backup in a separate location.

2. **Monitoring**
   - Periodically check disk usage and growing tables (especially `orders`, `order_items`).
   - Use `log_min_duration_statement` or APM for slow queries.

3. **Archiving (optional, if growth is large)**
   - You can move old closed orders (e.g. older than 2-3 years) to an archive table or cold storage; day-to-day queries stay lighter.

4. **Production**
   - Use `synchronize: false` (already the case); apply schema changes via migrations.
   - Keep connection pool and connection limits reasonable.

With this design and these practices, the database can stay low-maintenance and reliable for 5-10 years.
