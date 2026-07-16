import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompletedOrders1743465000000 implements MigrationInterface {
  name = 'CompletedOrders1743465000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_completed_orders_restaurant_waiter"`);
    await queryRunner.query(`DROP INDEX "IDX_completed_orders_restaurant_closed"`);
    await queryRunner.query(`DROP TABLE "completed_orders"`);
  }
}

