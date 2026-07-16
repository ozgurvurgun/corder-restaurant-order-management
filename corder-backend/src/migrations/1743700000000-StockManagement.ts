import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockManagement1743700000000 implements MigrationInterface {
  name = 'StockManagement1743700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_materials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_materials_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_materials_restaurant_name" ON "stock_materials" ("restaurant_id", "name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "contact_person" character varying,
        "phone" character varying,
        "email" character varying,
        "address" character varying,
        "notes" text,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suppliers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suppliers_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_suppliers_restaurant_name" ON "suppliers" ("restaurant_id", "name")`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inventory_counts_restaurant_created"`);
    await queryRunner.query(`DROP TABLE "inventory_counts"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_orders_restaurant_status_created"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP INDEX "IDX_stock_movements_restaurant_material_created"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP INDEX "IDX_suppliers_restaurant_name"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
    await queryRunner.query(`DROP INDEX "IDX_stock_materials_restaurant_name"`);
    await queryRunner.query(`DROP TABLE "stock_materials"`);
  }
}

