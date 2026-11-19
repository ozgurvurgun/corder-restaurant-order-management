import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabaseHardeningAndConstraints1760000011000
  implements MigrationInterface
{
  name = 'DatabaseHardeningAndConstraints1760000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // 1. Partial unique index: at most one 'in-progress' inventory count per restaurant
    await queryRunner.query(`
      WITH ranked_counts AS (
        SELECT "id",
               ROW_NUMBER() OVER (
                 PARTITION BY "restaurant_id"
                 ORDER BY "created_at" DESC, "id" DESC
               ) AS rn
        FROM "inventory_counts"
        WHERE "status" = 'in-progress'
      )
      UPDATE "inventory_counts" ic
      SET "status" = 'completed',
          "notes" = COALESCE(ic."notes" || ' ', '') || '[Auto-completed duplicate in-progress count during migration]'
      FROM ranked_counts r
      WHERE ic."id" = r."id" AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_inventory_counts_one_in_progress_per_restaurant"
        ON "inventory_counts" ("restaurant_id")
        WHERE "status" = 'in-progress'
    `);

    // 2. Foreign key FK_waiter_calls_table (ON DELETE CASCADE) & composite waiter_calls indexes
    await queryRunner.query(`
      DELETE FROM "waiter_calls" wc
      WHERE NOT EXISTS (
        SELECT 1 FROM "tables" t WHERE t."id" = wc."table_id"
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_waiter_calls_table'
        ) THEN
          ALTER TABLE "waiter_calls"
            ADD CONSTRAINT "FK_waiter_calls_table"
            FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_waiter_calls_restaurant_table_created"
        ON "waiter_calls" ("restaurant_id", "table_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_waiter_calls_restaurant_ack_created"
        ON "waiter_calls" ("restaurant_id", "acknowledged", "created_at" DESC)
    `);

    // 3. Partial unique index UQ_restaurant_staff_email on restaurant_staff (email) WHERE email IS NOT NULL
    await queryRunner.query(`
      UPDATE "restaurant_staff"
      SET "email" = NULL
      WHERE "email" IS NOT NULL AND btrim("email") = ''
    `);

    await queryRunner.query(`
      WITH ranked_staff_emails AS (
        SELECT "id",
               ROW_NUMBER() OVER (
                 PARTITION BY LOWER(BTRIM("email"))
                 ORDER BY "is_active" DESC, "created_at" ASC, "id" ASC
               ) AS rn
        FROM "restaurant_staff"
        WHERE "email" IS NOT NULL
      )
      UPDATE "restaurant_staff" rs
      SET "email" = NULL
      FROM ranked_staff_emails r
      WHERE rs."id" = r."id" AND r.rn > 1
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurant_staff_email"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_restaurant_staff_email"
        ON "restaurant_staff" ("email")
        WHERE "email" IS NOT NULL
    `);

    // 4. Deduplicate fraud_alerts by (restaurant_id, evidence->>'sourceKey') and create UQ_fraud_alerts_restaurant_source_key
    await queryRunner.query(`
      WITH ranked_alerts AS (
        SELECT "id",
               ROW_NUMBER() OVER (
                 PARTITION BY "restaurant_id", ("evidence" ->> 'sourceKey')
                 ORDER BY "created_at" ASC, "id" ASC
               ) AS rn
        FROM "fraud_alerts"
        WHERE ("evidence" ->> 'sourceKey') IS NOT NULL
          AND btrim("evidence" ->> 'sourceKey') <> ''
      )
      DELETE FROM "fraud_alerts" fa
      USING ranked_alerts r
      WHERE fa."id" = r."id" AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_fraud_alerts_restaurant_source_key"
        ON "fraud_alerts" ("restaurant_id", (("evidence" ->> 'sourceKey')))
        WHERE ("evidence" ->> 'sourceKey') IS NOT NULL
    `);

    // 5. Alter purchase_orders.supplier_id, stock_movements.material_id, and orders.table_id
    // to NULL-able with ON DELETE SET NULL instead of ON DELETE CASCADE
    await queryRunner.query(`
      ALTER TABLE "purchase_orders"
        ALTER COLUMN "supplier_id" DROP NOT NULL,
        DROP CONSTRAINT IF EXISTS "FK_purchase_orders_supplier",
        ADD CONSTRAINT "FK_purchase_orders_supplier"
          FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements"
        ALTER COLUMN "material_id" DROP NOT NULL,
        DROP CONSTRAINT IF EXISTS "FK_stock_movements_material",
        ADD CONSTRAINT "FK_stock_movements_material"
          FOREIGN KEY ("material_id") REFERENCES "stock_materials"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "table_id" DROP NOT NULL,
        DROP CONSTRAINT IF EXISTS "FK_orders_table",
        ADD CONSTRAINT "FK_orders_table"
          FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL
    `);

    // 6. Clamp negative stock_materials.current_stock to 0 and add CHECK constraints
    await queryRunner.query(`
      UPDATE "stock_materials" SET "current_stock" = 0 WHERE "current_stock" < 0;
      UPDATE "stock_materials" SET "min_stock" = 0 WHERE "min_stock" < 0;
      UPDATE "stock_materials" SET "cost_per_unit" = 0 WHERE "cost_per_unit" < 0;
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
        DROP CONSTRAINT IF EXISTS "CHK_products_price_non_negative",
        ADD CONSTRAINT "CHK_products_price_non_negative"
          CHECK ("price" >= 0 AND ("cost_price" IS NULL OR "cost_price" >= 0))
    `);

    await queryRunner.query(`
      ALTER TABLE "order_items"
        DROP CONSTRAINT IF EXISTS "CHK_order_items_price_quantity",
        ADD CONSTRAINT "CHK_order_items_price_quantity"
          CHECK ("price" >= 0 AND "quantity" >= 1)
    `);

    await queryRunner.query(`
      ALTER TABLE "completed_orders"
        DROP CONSTRAINT IF EXISTS "CHK_completed_orders_amounts_non_negative",
        ADD CONSTRAINT "CHK_completed_orders_amounts_non_negative"
          CHECK ("total_amount" >= 0 AND "discount_amount" >= 0 AND "net_amount" >= 0 AND "payment_tip" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_transactions"
        DROP CONSTRAINT IF EXISTS "CHK_cash_transactions_amount_non_negative",
        ADD CONSTRAINT "CHK_cash_transactions_amount_non_negative"
          CHECK ("amount" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "ledger_entries"
        DROP CONSTRAINT IF EXISTS "CHK_ledger_entries_amount_non_negative",
        ADD CONSTRAINT "CHK_ledger_entries_amount_non_negative"
          CHECK ("amount" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "open_accounts"
        DROP CONSTRAINT IF EXISTS "CHK_open_accounts_amounts_non_negative",
        ADD CONSTRAINT "CHK_open_accounts_amounts_non_negative"
          CHECK ("amount" >= 0 AND "paid_amount" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_materials"
        DROP CONSTRAINT IF EXISTS "CHK_stock_materials_non_negative",
        ADD CONSTRAINT "CHK_stock_materials_non_negative"
          CHECK ("current_stock" >= 0 AND "min_stock" >= 0 AND "cost_per_unit" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP CONSTRAINT IF EXISTS "CHK_restaurants_billing_bounds",
        ADD CONSTRAINT "CHK_restaurants_billing_bounds"
          CHECK ("royalty_rate" BETWEEN 0 AND 100 AND "monthly_fee" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "platform_billing_configs"
        DROP CONSTRAINT IF EXISTS "CHK_platform_billing_configs_days",
        ADD CONSTRAINT "CHK_platform_billing_configs_days"
          CHECK ("collection_start_day" BETWEEN 1 AND 31 AND "collection_end_day" BETWEEN 1 AND 31)
    `);

    // 7. Add missing composite indexes and drop the 12 redundant single-column left-prefix indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_order_status"
        ON "order_items" ("order_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cash_transactions_restaurant_created"
        ON "cash_transactions" ("restaurant_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cash_transactions_shift_created"
        ON "cash_transactions" ("shift_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_restaurant_category_created"
        ON "restaurant_audit_logs" ("restaurant_id", "category", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_category_order"
        ON "products" ("category_id", "order")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_categories_restaurant_order"
        ON "categories" ("restaurant_id", "order")
    `);

    // Drop 12 redundant single-column/prefix indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campaigns_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_shifts_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_transactions_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fraud_alerts_restaurant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_entries_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_open_accounts_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_order_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurant_roles_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurant_staff_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_restaurant_material"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tables_restaurant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_terminal_email"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the 12 single-column/prefix indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_restaurants_terminal_email" ON "restaurants" ("terminal_email")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tables_restaurant_id" ON "tables" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_movements_restaurant_material" ON "stock_movements" ("restaurant_id", "material_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_restaurant_staff_restaurant_id" ON "restaurant_staff" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_restaurant_roles_restaurant_id" ON "restaurant_roles" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_items_order_id" ON "order_items" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_open_accounts_restaurant_id" ON "open_accounts" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_restaurant_id" ON "ledger_entries" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_alerts_restaurant" ON "fraud_alerts" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cash_transactions_restaurant_id" ON "cash_transactions" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cash_shifts_restaurant_id" ON "cash_shifts" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_campaigns_restaurant_id" ON "campaigns" ("restaurant_id")`,
    );

    // Drop composite indexes added in step 7
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_restaurant_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_category_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_restaurant_category_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_transactions_shift_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cash_transactions_restaurant_created"`);

    // Drop CHECK constraints added in step 6
    await queryRunner.query(
      `ALTER TABLE "platform_billing_configs" DROP CONSTRAINT IF EXISTS "CHK_platform_billing_configs_days"`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP CONSTRAINT IF EXISTS "CHK_restaurants_billing_bounds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_materials" DROP CONSTRAINT IF EXISTS "CHK_stock_materials_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "open_accounts" DROP CONSTRAINT IF EXISTS "CHK_open_accounts_amounts_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "CHK_ledger_entries_amount_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_transactions" DROP CONSTRAINT IF EXISTS "CHK_cash_transactions_amount_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "completed_orders" DROP CONSTRAINT IF EXISTS "CHK_completed_orders_amounts_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "CHK_order_items_price_quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_price_non_negative"`,
    );

    // Revert step 5 FKs
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT IF EXISTS "FK_orders_table",
        ADD CONSTRAINT "FK_orders_table"
          FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
        DROP CONSTRAINT IF EXISTS "FK_stock_movements_material",
        ADD CONSTRAINT "FK_stock_movements_material"
          FOREIGN KEY ("material_id") REFERENCES "stock_materials"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_orders"
        DROP CONSTRAINT IF EXISTS "FK_purchase_orders_supplier",
        ADD CONSTRAINT "FK_purchase_orders_supplier"
          FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE
    `);

    // Revert step 4, 3, 2, 1
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_fraud_alerts_restaurant_source_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_restaurant_staff_email"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_restaurant_staff_email" ON "restaurant_staff" ("email")`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_waiter_calls_restaurant_ack_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_waiter_calls_restaurant_table_created"`);
    await queryRunner.query(
      `ALTER TABLE "waiter_calls" DROP CONSTRAINT IF EXISTS "FK_waiter_calls_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_inventory_counts_one_in_progress_per_restaurant"`,
    );
  }
}

