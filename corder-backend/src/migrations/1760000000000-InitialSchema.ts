import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "platform_admins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_admins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_admins_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "restaurants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "address" character varying,
        "phone" character varying,
        "email" character varying,
        "status" character varying NOT NULL DEFAULT 'active',
        "tax_id" character varying,
        "whatsapp" character varying,
        "instagram" character varying,
        "facebook" character varying,
        "website" character varying,
        "working_hours" character varying,
        "root_admin_id" uuid,
        "terminal_email" character varying,
        "terminal_password_hash" character varying,
        "print_agent_token_hash" character varying(64),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_restaurants_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurants_terminal_email" ON "restaurants" ("terminal_email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_restaurants_print_agent_token_hash" ON "restaurants" ("print_agent_token_hash")`,
    );

    await queryRunner.query(`
      CREATE TABLE "root_admins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_root_admins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_root_admins_email" UNIQUE ("email"),
        CONSTRAINT "FK_root_admins_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_root_admins_restaurant_id" ON "root_admins" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "restaurant_staff" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "email" character varying,
        "password_hash" character varying,
        "pin_hash" character varying(120) NOT NULL,
        "name" character varying NOT NULL,
        "role" character varying(20) NOT NULL,
        "phone" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_staff" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_staff_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_staff_restaurant_id" ON "restaurant_staff" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tables" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "section" character varying NOT NULL DEFAULT 'default',
        "status" character varying NOT NULL DEFAULT 'empty',
        "session_staff_id" uuid,
        "session_staff_name" character varying(120),
        "session_locked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tables" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tables_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tables_restaurant_id" ON "tables" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "parent_id" uuid,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "show_in_terminal" boolean NOT NULL DEFAULT true,
        "show_in_menu" boolean NOT NULL DEFAULT true,
        "order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_restaurant_slug" UNIQUE ("restaurant_id", "slug"),
        CONSTRAINT "FK_categories_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_restaurant_id" ON "categories" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_parent_id" ON "categories" ("parent_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL,
        "image_url" character varying(512),
        "in_stock" boolean NOT NULL DEFAULT true,
        "order" integer NOT NULL DEFAULT 0,
        "ingredients" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_products_category_id" ON "products" ("category_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "table_id" uuid NOT NULL,
        "user_id" uuid,
        "user_display_name" character varying(120),
        "status" character varying NOT NULL DEFAULT 'active',
        "merged_from" character varying(160),
        "kitchen_ticket_printed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_orders_table" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_restaurant_status" ON "orders" ("restaurant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_restaurant_created" ON "orders" ("restaurant_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" character varying NOT NULL,
        "product_name" character varying NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "note" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "cancel_reason" character varying(500),
        "cancelled_by" character varying(255),
        "cancelled_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "print_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "print_type" character varying(32) NOT NULL,
        "payload" jsonb NOT NULL,
        "printed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_print_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_print_jobs_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_print_jobs_pending" ON "print_jobs" ("restaurant_id", "printed_at", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cash_shifts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "opened_by" character varying(255) NOT NULL,
        "opened_at" TIMESTAMPTZ NOT NULL,
        "closed_at" TIMESTAMPTZ,
        "closed_by" character varying(255),
        "status" character varying(20) NOT NULL DEFAULT 'open',
        "opening_balance" numeric(12,2) NOT NULL DEFAULT 0,
        "closing_balance" numeric(12,2),
        "notes" text,
        "cash_in" numeric(12,2) NOT NULL DEFAULT 0,
        "cash_out" numeric(12,2) NOT NULL DEFAULT 0,
        "total_revenue" numeric(12,2) NOT NULL DEFAULT 0,
        "total_nakit" numeric(12,2) NOT NULL DEFAULT 0,
        "total_kart" numeric(12,2) NOT NULL DEFAULT 0,
        "total_yemek_karti" numeric(12,2) NOT NULL DEFAULT 0,
        "total_multinet" numeric(12,2) NOT NULL DEFAULT 0,
        "transaction_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_cash_shifts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cash_shifts_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cash_shifts_restaurant_id" ON "cash_shifts" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cash_shifts_restaurant_status" ON "cash_shifts" ("restaurant_id", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cash_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "shift_id" uuid NOT NULL,
        "type" character varying(20) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "description" text NOT NULL,
        "reference" character varying(255),
        "created_by" character varying(255) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cash_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cash_transactions_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cash_transactions_shift" FOREIGN KEY ("shift_id") REFERENCES "cash_shifts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cash_transactions_restaurant_id" ON "cash_transactions" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cash_transactions_restaurant_shift" ON "cash_transactions" ("restaurant_id", "shift_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "completed_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "table_name" character varying(255) NOT NULL,
        "section" character varying(255) NOT NULL,
        "waiter" character varying(255) NOT NULL,
        "total_amount" numeric(12,2) NOT NULL,
        "discount_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "net_amount" numeric(12,2) NOT NULL,
        "closed_by" character varying(255) NOT NULL,
        "opened_at" TIMESTAMPTZ NOT NULL,
        "closed_at" TIMESTAMPTZ NOT NULL,
        "payment_method" character varying(50) NOT NULL,
        "payment_split" jsonb,
        "payment_discount" jsonb,
        "payment_tip" numeric(12,2) NOT NULL DEFAULT 0,
        "orders_snapshot" jsonb NOT NULL,
        "payment_snapshot" jsonb NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_completed_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_completed_orders_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_completed_orders_restaurant_closed" ON "completed_orders" ("restaurant_id", "closed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_completed_orders_restaurant_waiter" ON "completed_orders" ("restaurant_id", "waiter")`,
    );

    await queryRunner.query(`
      CREATE TABLE "open_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "customer_name" character varying(255) NOT NULL,
        "customer_phone" character varying(50),
        "amount" numeric(12,2) NOT NULL,
        "paid_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying(20) NOT NULL DEFAULT 'open',
        "description" text NOT NULL,
        "created_by" character varying(255) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "paid_at" TIMESTAMPTZ,
        CONSTRAINT "PK_open_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_open_accounts_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_open_accounts_restaurant_id" ON "open_accounts" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "open_account_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "open_account_id" uuid NOT NULL,
        "product_id" character varying(36),
        "product_name" character varying(500) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "price" numeric(12,2) NOT NULL,
        "note" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_open_account_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_open_account_items_account" FOREIGN KEY ("open_account_id") REFERENCES "open_accounts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_open_account_items_account_id" ON "open_account_items" ("open_account_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "open_account_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "open_account_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "received_by" character varying(255) NOT NULL,
        "received_by_user_id" character varying(36),
        "note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_open_account_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_open_account_payments_account" FOREIGN KEY ("open_account_id") REFERENCES "open_accounts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_open_account_payments_account_id" ON "open_account_payments" ("open_account_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ledger_customers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "phone" character varying(50),
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_customers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_customers_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_customers_restaurant_id" ON "ledger_customers" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "entry_type" character varying(20) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "description" text NOT NULL,
        "table_id" uuid,
        "table_name" character varying(255),
        "completed_order_id" uuid,
        "snapshot" jsonb,
        "received_by" character varying(255),
        "received_by_user_id" character varying(36),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_entries_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ledger_entries_customer" FOREIGN KEY ("customer_id") REFERENCES "ledger_customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_entries_restaurant_id" ON "ledger_entries" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_entries_customer_id" ON "ledger_entries" ("customer_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "campaigns" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "image_url" character varying NOT NULL,
        "discount_percent" integer,
        "original_price" numeric(10,2),
        "discounted_price" numeric(10,2),
        "valid_until" TIMESTAMPTZ,
        "is_active" boolean NOT NULL DEFAULT true,
        "order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaigns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaigns_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_campaigns_restaurant_id" ON "campaigns" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "contact_person" character varying(255),
        "phone" character varying(64),
        "email" character varying(255),
        "address" character varying(255),
        "notes" text,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suppliers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suppliers_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_suppliers_restaurant_name" ON "suppliers" ("restaurant_id", "name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "stock_materials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "unit" character varying(16) NOT NULL,
        "current_stock" numeric(12,3) NOT NULL DEFAULT 0,
        "min_stock" numeric(12,3) NOT NULL DEFAULT 0,
        "cost_per_unit" numeric(12,4) NOT NULL DEFAULT 0,
        "supplier_id" uuid,
        "category" character varying(128) NOT NULL DEFAULT 'Diger',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_materials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_materials_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_materials_restaurant_name" ON "stock_materials" ("restaurant_id", "name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "material_id" uuid NOT NULL,
        "material_name" character varying NOT NULL,
        "type" character varying(32) NOT NULL,
        "quantity" numeric(12,3) NOT NULL,
        "previous_stock" numeric(12,3) NOT NULL,
        "new_stock" numeric(12,3) NOT NULL,
        "unit_cost" numeric(12,4),
        "total_cost" numeric(12,4),
        "supplier_id" uuid,
        "reason" text,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_movements_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stock_movements_material" FOREIGN KEY ("material_id") REFERENCES "stock_materials"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stock_movements_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_movements_restaurant_material_created" ON "stock_movements" ("restaurant_id", "material_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "supplier_id" uuid NOT NULL,
        "supplier_name" character varying NOT NULL,
        "items" jsonb NOT NULL,
        "total_amount" numeric(12,4) NOT NULL,
        "status" character varying(32) NOT NULL,
        "notes" text,
        "created_by" character varying NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "received_at" TIMESTAMPTZ,
        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_purchase_orders_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_restaurant_status_created" ON "purchase_orders" ("restaurant_id", "status", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_counts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "date" TIMESTAMPTZ NOT NULL,
        "counted_by" character varying NOT NULL,
        "items" jsonb NOT NULL,
        "status" character varying(32) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_counts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_counts_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_counts_restaurant_created" ON "inventory_counts" ("restaurant_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "restaurant_printer_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "type" character varying(50) NOT NULL,
        "connection" character varying(20) NOT NULL DEFAULT 'network',
        "ip_address" character varying(100),
        "port" integer,
        "department" character varying(100),
        "status" character varying(20) NOT NULL DEFAULT 'offline',
        "paper_width" integer NOT NULL DEFAULT 80,
        "auto_cut" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_printer_configs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_printer_configs_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_printer_configs_restaurant_id" ON "restaurant_printer_configs" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "restaurant_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "user_id" character varying(64) NOT NULL,
        "user_name" character varying(120) NOT NULL,
        "action" character varying(120) NOT NULL,
        "category" character varying(32) NOT NULL,
        "details" text NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_audit_logs_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_audit_logs_restaurant_created" ON "restaurant_audit_logs" ("restaurant_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_printer_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_counts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_materials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "campaigns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_customers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "open_account_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "open_account_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "open_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "completed_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_shifts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "print_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_staff"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "root_admins"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_admins"`);
  }
}
