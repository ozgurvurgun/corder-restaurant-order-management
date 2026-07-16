import { MigrationInterface, QueryRunner } from 'typeorm';

export class TableSessionStaffLock1744300000000 implements MigrationInterface {
  name = 'TableSessionStaffLock1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tables"
      ADD COLUMN "session_staff_id" uuid NULL,
      ADD COLUMN "session_staff_name" character varying(120) NULL,
      ADD COLUMN "session_locked_at" TIMESTAMP WITH TIME ZONE NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tables"
      ADD CONSTRAINT "FK_tables_session_staff"
      FOREIGN KEY ("session_staff_id") REFERENCES "restaurant_staff"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tables" DROP CONSTRAINT IF EXISTS "FK_tables_session_staff"`);
    await queryRunner.query(`
      ALTER TABLE "tables"
      DROP COLUMN IF EXISTS "session_locked_at",
      DROP COLUMN IF EXISTS "session_staff_name",
      DROP COLUMN IF EXISTS "session_staff_id"
    `);
  }
}
