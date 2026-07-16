import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestaurantProfileFields1743800000000 implements MigrationInterface {
  name = 'RestaurantProfileFields1743800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "tax_id" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "whatsapp" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "instagram" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "facebook" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "website" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "working_hours" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "working_hours"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "website"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "facebook"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "instagram"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "whatsapp"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "tax_id"`);
  }
}

