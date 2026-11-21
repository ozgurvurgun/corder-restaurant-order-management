import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScale10kPerformanceIndexes1760000017000
  implements MigrationInterface
{
  name = 'AddScale10kPerformanceIndexes1760000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_restaurant_created"
      ON "stock_movements" ("restaurant_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_brand_name_lower_trim"
      ON "restaurants" (LOWER(TRIM("brand_name")))
      WHERE "brand_name" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_active_restaurant_table_created"
      ON "orders" ("restaurant_id", "table_id", "created_at" DESC)
      WHERE "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_print_jobs_restaurant_type_created"
      ON "print_jobs" ("restaurant_id", "print_type", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purchase_orders_restaurant_created"
      ON "purchase_orders" ("restaurant_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_open_accounts_restaurant_created"
      ON "open_accounts" ("restaurant_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_platform_notifications_status_sent_at"
      ON "platform_notifications" ("status", "sent_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_web_push_subscriptions_updated_at"
      ON "web_push_subscriptions" ("updated_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_web_push_subscriptions_updated_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_platform_notifications_status_sent_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_open_accounts_restaurant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchase_orders_restaurant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_print_jobs_restaurant_type_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_active_restaurant_table_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_restaurants_brand_name_lower_trim"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_movements_restaurant_created"`,
    );
  }
}
