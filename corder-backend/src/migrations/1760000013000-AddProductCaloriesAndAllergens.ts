import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCaloriesAndAllergens1760000013000 implements MigrationInterface {
  name = 'AddProductCaloriesAndAllergens1760000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "calories" integer DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "allergens" jsonb DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN IF EXISTS "allergens",
      DROP COLUMN IF EXISTS "calories"
    `);
  }
}

