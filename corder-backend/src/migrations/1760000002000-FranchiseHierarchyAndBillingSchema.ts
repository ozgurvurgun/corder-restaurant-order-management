import { MigrationInterface, QueryRunner } from 'typeorm';

export class FranchiseHierarchyAndBillingSchema1760000002000 implements MigrationInterface {
  name = 'FranchiseHierarchyAndBillingSchema1760000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "brand_name" character varying(120),
        ADD COLUMN IF NOT EXISTS "branch_type" character varying(32) NOT NULL DEFAULT 'independent',
        ADD COLUMN IF NOT EXISTS "franchisee_company_name" character varying(160),
        ADD COLUMN IF NOT EXISTS "royalty_rate" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "monthly_fee" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "billing_status" character varying(32) NOT NULL DEFAULT 'paid',
        ADD COLUMN IF NOT EXISTS "is_access_suspended" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "suspension_reason" character varying(160),
        ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "last_payment_date" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "last_paid_period" character varying(16),
        ADD COLUMN IF NOT EXISTS "billing_notes" text,
        ADD COLUMN IF NOT EXISTS "payment_history" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_brand_name" ON "restaurants" ("brand_name");
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_billing_status" ON "restaurants" ("billing_status");
    `);

    await queryRunner.query(`
      ALTER TABLE "root_admins"
        ADD COLUMN IF NOT EXISTS "boss_tier" character varying(32) NOT NULL DEFAULT 'franchise_owner',
        ADD COLUMN IF NOT EXISTS "brand_name" character varying(120)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_root_admins_boss_tier" ON "root_admins" ("boss_tier");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_billing_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "receiver_name" character varying(160) NOT NULL DEFAULT 'Corder Software and Technology Inc.',
        "iban" character varying(64) NOT NULL DEFAULT 'TR33 0006 1005 1978 6457 8413 26',
        "bank_name" character varying(120) NOT NULL DEFAULT 'Garanti BBVA',
        "collection_start_day" integer NOT NULL DEFAULT 25,
        "collection_end_day" integer NOT NULL DEFAULT 30,
        "support_phone" character varying(64),
        "support_email" character varying(120),
        "payment_instructions" text,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_billing_configs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_billing_configs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_root_admins_boss_tier"`);
    await queryRunner.query(`
      ALTER TABLE "root_admins"
        DROP COLUMN IF EXISTS "brand_name",
        DROP COLUMN IF EXISTS "boss_tier"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_billing_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_brand_name"`);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "payment_history",
        DROP COLUMN IF EXISTS "billing_notes",
        DROP COLUMN IF EXISTS "last_paid_period",
        DROP COLUMN IF EXISTS "last_payment_date",
        DROP COLUMN IF EXISTS "suspended_at",
        DROP COLUMN IF EXISTS "suspension_reason",
        DROP COLUMN IF EXISTS "is_access_suspended",
        DROP COLUMN IF EXISTS "billing_status",
        DROP COLUMN IF EXISTS "monthly_fee",
        DROP COLUMN IF EXISTS "royalty_rate",
        DROP COLUMN IF EXISTS "franchisee_company_name",
        DROP COLUMN IF EXISTS "branch_type",
        DROP COLUMN IF EXISTS "brand_name"
    `);
  }
}

