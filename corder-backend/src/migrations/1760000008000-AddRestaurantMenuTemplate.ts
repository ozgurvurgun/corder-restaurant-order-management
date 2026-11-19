import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantMenuTemplate1760000008000
  implements MigrationInterface
{
  name = 'AddRestaurantMenuTemplate1760000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "menu_template" varchar(40) NOT NULL DEFAULT 'classic'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "menu_template"
    `);
  }
}
