import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantReceiptFooterFields1760000012000
  implements MigrationInterface
{
  name = 'AddRestaurantReceiptFooterFields1760000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "receipt_footer_enabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "receipt_footer_title" varchar(120) NOT NULL DEFAULT 'Compart Software',
        ADD COLUMN IF NOT EXISTS "receipt_footer_url" varchar(160) NOT NULL DEFAULT 'compartsoftware.com'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "receipt_footer_url",
        DROP COLUMN IF EXISTS "receipt_footer_title",
        DROP COLUMN IF EXISTS "receipt_footer_enabled"
    `);
  }
}

