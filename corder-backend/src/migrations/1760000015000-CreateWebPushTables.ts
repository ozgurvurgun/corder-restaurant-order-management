import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebPushTables1760000015000 implements MigrationInterface {
  name = 'CreateWebPushTables1760000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "web_push_vapid_keys" (
        "id" varchar(32) PRIMARY KEY,
        "public_key" text NOT NULL,
        "private_jwk" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "web_push_subscriptions" (
        "endpoint" text PRIMARY KEY,
        "restaurant_id" uuid NOT NULL,
        "root_admin_id" uuid NULL,
        "app_type" varchar(32) NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "web_push_subscriptions"
      ADD COLUMN IF NOT EXISTS "root_admin_id" uuid NULL
    `);

    await queryRunner.query(`
      DELETE FROM "web_push_subscriptions" s
      WHERE NOT EXISTS (
        SELECT 1 FROM "restaurants" r WHERE r.id = s.restaurant_id
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_web_push_subscriptions_restaurant'
        ) THEN
          ALTER TABLE "web_push_subscriptions"
          ADD CONSTRAINT "FK_web_push_subscriptions_restaurant"
          FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_web_push_subscriptions_root_admin'
        ) THEN
          ALTER TABLE "web_push_subscriptions"
          ADD CONSTRAINT "FK_web_push_subscriptions_root_admin"
          FOREIGN KEY ("root_admin_id") REFERENCES "root_admins"("id") ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_web_push_subscriptions_app_type'
        ) THEN
          ALTER TABLE "web_push_subscriptions"
          ADD CONSTRAINT "CHK_web_push_subscriptions_app_type"
          CHECK ("app_type" IN ('terminal', 'merchant', 'boss'));
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_web_push_subscriptions_rest_app"
      ON "web_push_subscriptions" ("restaurant_id", "app_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_web_push_subscriptions_root_admin"
      ON "web_push_subscriptions" ("root_admin_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "web_push_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "web_push_vapid_keys"`);
  }
}

