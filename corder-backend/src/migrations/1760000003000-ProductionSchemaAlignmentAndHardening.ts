import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionSchemaAlignmentAndHardening1760000003000
  implements MigrationInterface
{
  name = 'ProductionSchemaAlignmentAndHardening1760000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // 1. Idempotently ensure all columns previously added in runtime onModuleInit hooks exist
    await queryRunner.query(`
      ALTER TABLE "tables"
        ADD COLUMN IF NOT EXISTS "discount" jsonb,
        ADD COLUMN IF NOT EXISTS "split_info" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "cost_price" numeric(10,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "show_in_quick_sale" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "print_agent_username" character varying,
        ADD COLUMN IF NOT EXISTS "print_agent_password_hash" character varying,
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
      DROP INDEX IF EXISTS "IDX_restaurants_print_agent_token_hash";
      ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "print_agent_token_hash";
    `);

    await queryRunner.query(`
      ALTER TABLE "root_admins"
        ADD COLUMN IF NOT EXISTS "boss_tier" character varying(32) NOT NULL DEFAULT 'franchise_owner',
        ADD COLUMN IF NOT EXISTS "brand_name" character varying(120)
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

    // Close any duplicate 'open' shifts per restaurant (keeping the most recently opened shift)
    // and ensure the partial unique index for one open shift per restaurant exists
    await queryRunner.query(`
      WITH ranked_open_shifts AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "restaurant_id"
            ORDER BY "opened_at" DESC, "id" DESC
          ) AS rn
        FROM "cash_shifts"
        WHERE "status" = 'open'
      )
      UPDATE "cash_shifts" cs
      SET
        "status" = 'closed',
        "closed_at" = COALESCE(cs."closed_at", now()),
        "closed_by" = COALESCE(cs."closed_by", 'System Migration Cleanup')
      FROM ranked_open_shifts r
      WHERE cs."id" = r."id" AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cash_shifts_one_open_per_restaurant"
        ON "cash_shifts" ("restaurant_id")
        WHERE "status" = 'open'
    `);

    // 2. Ensure print_jobs.id has a database-level UUID default even if initialized via synchronize
    await queryRunner.query(`
      ALTER TABLE "print_jobs"
        ALTER COLUMN "id" SET DEFAULT gen_random_uuid()
    `);

    // 3. Replace overly restrictive (restaurant_id, slug) category unique constraint with
    // parent-scoped partial unique indexes matching CategoryService.slugInUse(restaurantId, parentId, slug)
    await queryRunner.query(`
      ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "UQ_categories_restaurant_slug";
      DROP INDEX IF EXISTS "UQ_categories_restaurant_slug";
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_restaurant_root_slug"
        ON "categories" ("restaurant_id", "slug")
        WHERE "parent_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_restaurant_parent_slug"
        ON "categories" ("restaurant_id", "parent_id", "slug")
        WHERE "parent_id" IS NOT NULL
    `);

    // 4. Convert any timestamp-without-time-zone audit columns (from prior DB_SYNCHRONIZE runs) to TIMESTAMPTZ
    await queryRunner.query(`
      DO $$
      DECLARE
        col_rec RECORD;
      BEGIN
        FOR col_rec IN
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type = 'timestamp without time zone'
            AND column_name IN ('created_at', 'updated_at', 'opened_at', 'closed_at', 'paid_at', 'received_at', 'printed_at', 'cancelled_at', 'session_locked_at', 'valid_until', 'suspended_at', 'last_payment_date', 'date')
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
            col_rec.table_name,
            col_rec.column_name,
            col_rec.column_name
          );
        END LOOP;
      END $$;
    `);

    // 5. Clean up any orphaned nullable reference columns and add missing ON DELETE SET NULL foreign keys
    await queryRunner.query(`
      UPDATE "restaurants"
      SET "root_admin_id" = NULL
      WHERE "root_admin_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "root_admins" WHERE "root_admins"."id" = "restaurants"."root_admin_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_restaurants_root_admin'
        ) THEN
          ALTER TABLE "restaurants"
            ADD CONSTRAINT "FK_restaurants_root_admin"
            FOREIGN KEY ("root_admin_id") REFERENCES "root_admins"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE "tables"
      SET "session_staff_id" = NULL, "session_staff_name" = NULL, "session_locked_at" = NULL
      WHERE "session_staff_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "restaurant_staff" WHERE "restaurant_staff"."id" = "tables"."session_staff_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tables_session_staff'
        ) THEN
          ALTER TABLE "tables"
            ADD CONSTRAINT "FK_tables_session_staff"
            FOREIGN KEY ("session_staff_id") REFERENCES "restaurant_staff"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE "stock_materials"
      SET "supplier_id" = NULL
      WHERE "supplier_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "suppliers" WHERE "suppliers"."id" = "stock_materials"."supplier_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_materials_supplier'
        ) THEN
          ALTER TABLE "stock_materials"
            ADD CONSTRAINT "FK_stock_materials_supplier"
            FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE "ledger_entries"
      SET "table_id" = NULL
      WHERE "table_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tables" WHERE "tables"."id" = "ledger_entries"."table_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_ledger_entries_table'
        ) THEN
          ALTER TABLE "ledger_entries"
            ADD CONSTRAINT "FK_ledger_entries_table"
            FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE "ledger_entries"
      SET "completed_order_id" = NULL
      WHERE "completed_order_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "completed_orders" WHERE "completed_orders"."id" = "ledger_entries"."completed_order_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_ledger_entries_completed_order'
        ) THEN
          ALTER TABLE "ledger_entries"
            ADD CONSTRAINT "FK_ledger_entries_completed_order"
            FOREIGN KEY ("completed_order_id") REFERENCES "completed_orders"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 6. Normalize empty credential strings and add tenant/hot-query composite indexes
    await queryRunner.query(`
      UPDATE "restaurants" SET "terminal_email" = NULL WHERE "terminal_email" IS NOT NULL AND btrim("terminal_email") = '';
      UPDATE "restaurants" SET "print_agent_username" = NULL WHERE "print_agent_username" IS NOT NULL AND btrim("print_agent_username") = '';
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT "terminal_email"
          FROM "restaurants"
          WHERE "terminal_email" IS NOT NULL
          GROUP BY "terminal_email"
          HAVING COUNT(*) > 1
        ) THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_restaurants_terminal_email"
            ON "restaurants" ("terminal_email")
            WHERE "terminal_email" IS NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tables_restaurant_section_name"
        ON "tables" ("restaurant_id", "section", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tables_restaurant_status"
        ON "tables" ("restaurant_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_restaurant_completed_order"
        ON "ledger_entries" ("restaurant_id", "completed_order_id")
        WHERE "completed_order_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cash_shifts_restaurant_opened_at"
        ON "cash_shifts" ("restaurant_id", "opened_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_counts_restaurant_status"
        ON "inventory_counts" ("restaurant_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_materials_supplier_id"
        ON "stock_materials" ("supplier_id")
        WHERE "supplier_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_campaigns_restaurant_active_order"
        ON "campaigns" ("restaurant_id", "is_active", "order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campaigns_restaurant_active_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_materials_supplier_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_counts_restaurant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_shifts_restaurant_opened_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_entries_restaurant_completed_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tables_restaurant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tables_restaurant_section_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_restaurants_terminal_email"`);

    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "FK_ledger_entries_completed_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "FK_ledger_entries_table"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_materials" DROP CONSTRAINT IF EXISTS "FK_stock_materials_supplier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT IF EXISTS "FK_tables_session_staff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP CONSTRAINT IF EXISTS "FK_restaurants_root_admin"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_restaurant_parent_slug"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_restaurant_root_slug"`);
  }
}
