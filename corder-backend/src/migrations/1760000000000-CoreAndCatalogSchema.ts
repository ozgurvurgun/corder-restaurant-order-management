import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoreAndCatalogSchema1760000000000 implements MigrationInterface {
  name = 'CoreAndCatalogSchema1760000000000';

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
        "restaurant_id" uuid,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "phone" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_root_admins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_root_admins_email" UNIQUE ("email"),
        CONSTRAINT "FK_root_admins_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_root_admins_restaurant_id" ON "root_admins" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "boss_restaurants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "boss_id" uuid NOT NULL,
        "restaurant_id" uuid NOT NULL,
        "title" character varying(80) NOT NULL DEFAULT 'Owner',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_boss_restaurants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_boss_restaurants_boss" FOREIGN KEY ("boss_id") REFERENCES "root_admins"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_boss_restaurants_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_boss_restaurants_boss_restaurant" ON "boss_restaurants" ("boss_id", "restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_boss_restaurants_restaurant_id" ON "boss_restaurants" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "restaurant_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "key" character varying(64) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "color" character varying(32) NOT NULL DEFAULT '#e63462',
        "is_system" boolean NOT NULL DEFAULT false,
        "can_access_panel" boolean NOT NULL DEFAULT false,
        "can_access_terminal" boolean NOT NULL DEFAULT true,
        "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "max_discount_percent" integer NOT NULL DEFAULT 0,
        "max_discount_amount" numeric(10,2),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_roles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_roles_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_restaurant_roles_restaurant_key" ON "restaurant_roles" ("restaurant_id", "key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_roles_restaurant_id" ON "restaurant_roles" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "restaurant_staff" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "email" character varying,
        "password_hash" character varying,
        "pin_hash" character varying(120),
        "name" character varying NOT NULL,
        "role" character varying(64) NOT NULL,
        "phone" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "can_access_panel" boolean NOT NULL DEFAULT false,
        "can_access_terminal" boolean NOT NULL DEFAULT true,
        "permissions_override" jsonb,
        "granted_permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "revoked_permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "max_discount_percent_override" integer,
        "max_discount_amount_override" numeric(10,2),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_staff" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_staff_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_staff_restaurant_id" ON "restaurant_staff" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_staff_restaurant_active" ON "restaurant_staff" ("restaurant_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_staff_email" ON "restaurant_staff" ("email")`,
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
      `CREATE INDEX "IDX_orders_restaurant_table_status" ON "orders" ("restaurant_id", "table_id", "status")`,
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
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order_status" ON "order_items" ("order_id", "status")`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "campaigns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "print_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_staff"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "boss_restaurants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "root_admins"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_admins"`);
  }
}
