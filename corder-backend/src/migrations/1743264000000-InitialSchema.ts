import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1743264000000 implements MigrationInterface {
  name = 'InitialSchema1743264000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "platform_admins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
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
        "root_admin_id" uuid,
        "terminal_email" character varying,
        "terminal_password_hash" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_restaurants_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurants_terminal_email" ON "restaurants" ("terminal_email")`,
    );

    await queryRunner.query(`
      CREATE TABLE "root_admins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_root_admins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_root_admins_email" UNIQUE ("email"),
        CONSTRAINT "FK_root_admins_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_root_admins_restaurant_id" ON "root_admins" ("restaurant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tables" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "section" character varying NOT NULL DEFAULT 'default',
        "status" character varying NOT NULL DEFAULT 'empty',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tables" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tables_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tables_restaurant_id" ON "tables" ("restaurant_id")`);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "show_in_terminal" boolean NOT NULL DEFAULT true,
        "show_in_menu" boolean NOT NULL DEFAULT true,
        "order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_categories_restaurant_slug" UNIQUE ("restaurant_id", "slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_restaurant_id" ON "categories" ("restaurant_id")`,
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
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_products_category_id" ON "products" ("category_id")`);

    await queryRunner.query(`
      CREATE TABLE "restaurant_staff" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "email" character varying,
        "password_hash" character varying,
        "pin" character varying(20),
        "name" character varying NOT NULL,
        "role" character varying(20) NOT NULL,
        "phone" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_staff" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_staff_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_staff_restaurant_id" ON "restaurant_staff" ("restaurant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_restaurant_staff_restaurant_pin" ON "restaurant_staff" ("restaurant_id", "pin")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "table_id" uuid NOT NULL,
        "user_id" uuid,
        "status" character varying NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
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
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")`);

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
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaigns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaigns_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_campaigns_restaurant_id" ON "campaigns" ("restaurant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TABLE "cash_shifts"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "restaurant_staff"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "tables"`);
    await queryRunner.query(`DROP TABLE "root_admins"`);
    await queryRunner.query(`DROP TABLE "restaurants"`);
    await queryRunner.query(`DROP TABLE "platform_admins"`);
  }
}
