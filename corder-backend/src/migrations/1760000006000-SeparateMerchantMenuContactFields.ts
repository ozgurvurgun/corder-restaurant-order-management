import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateMerchantMenuContactFields1760000006000
  implements MigrationInterface
{
  name = 'SeparateMerchantMenuContactFields1760000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "menu_phone" character varying,
        ADD COLUMN IF NOT EXISTS "menu_address" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "menu_address",
        DROP COLUMN IF EXISTS "menu_phone"
    `);
  }
}

