import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoryParentId1744700000000 implements MigrationInterface {
  name = 'CategoryParentId1744700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "UQ_categories_restaurant_slug"`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "parent_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "FK_categories_parent"
      FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_restaurant_root_slug"
      ON "categories" ("restaurant_id", "slug")
      WHERE "parent_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_restaurant_parent_child_slug"
      ON "categories" ("restaurant_id", "parent_id", "slug")
      WHERE "parent_id" IS NOT NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_categories_parent_id" ON "categories" ("parent_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_categories_parent_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_categories_restaurant_parent_child_slug"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_categories_restaurant_root_slug"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_parent"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "parent_id"`);
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_restaurant_slug" UNIQUE ("restaurant_id", "slug")`,
    );
  }
}
