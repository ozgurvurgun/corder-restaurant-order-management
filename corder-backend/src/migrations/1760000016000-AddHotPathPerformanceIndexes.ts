import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotPathPerformanceIndexes1760000016000 implements MigrationInterface {
  name = 'AddHotPathPerformanceIndexes1760000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_unprinted_kitchen"
      ON "orders" ("restaurant_id", "created_at")
      WHERE "kitchen_ticket_printed_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_print_jobs_unprinted"
      ON "print_jobs" ("restaurant_id", "created_at")
      WHERE "printed_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_completed_orders_restaurant_opened"
      ON "completed_orders" ("restaurant_id", "opened_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cash_transactions_shift_ref_type"
      ON "cash_transactions" ("restaurant_id", "shift_id", "type", "reference")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_transactions_shift_ref_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_completed_orders_restaurant_opened"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_print_jobs_unprinted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_unprinted_kitchen"`);
  }
}

