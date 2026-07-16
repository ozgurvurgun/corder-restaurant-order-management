import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductIngredients1745100000000 implements MigrationInterface {
  name = 'ProductIngredients1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "ingredients" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "ingredients"`);
  }
}
