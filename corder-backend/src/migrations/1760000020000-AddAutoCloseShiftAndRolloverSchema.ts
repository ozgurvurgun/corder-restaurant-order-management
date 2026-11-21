import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoCloseShiftAndRolloverSchema1760000020000
  implements MigrationInterface
{
  name = 'AddAutoCloseShiftAndRolloverSchema1760000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "auto_close_shift_enabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "auto_close_shift_time" varchar(5) NOT NULL DEFAULT '04:00'
    `);
    await queryRunner.query(`
      UPDATE "restaurants"
      SET "auto_close_shift_enabled" = true
      WHERE "auto_close_shift_enabled" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "restaurants"
      SET "auto_close_shift_time" = '04:00'
      WHERE "auto_close_shift_time" IS NULL OR TRIM("auto_close_shift_time") = ''
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_shifts"
      ADD COLUMN IF NOT EXISTS "is_auto_closed" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_shifts"
      ADD COLUMN IF NOT EXISTS "carried_over_tables_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_shifts"
      ADD COLUMN IF NOT EXISTS "carried_over_tables_amount" numeric(12,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "cash_shifts"
      ADD COLUMN IF NOT EXISTS "carried_over_tables_snapshot" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cash_shifts" DROP COLUMN IF EXISTS "carried_over_tables_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_shifts" DROP COLUMN IF EXISTS "carried_over_tables_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_shifts" DROP COLUMN IF EXISTS "carried_over_tables_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_shifts" DROP COLUMN IF EXISTS "is_auto_closed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "auto_close_shift_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "auto_close_shift_enabled"`,
    );
  }
}
