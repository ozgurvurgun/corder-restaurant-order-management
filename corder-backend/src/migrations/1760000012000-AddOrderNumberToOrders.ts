import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderNumberToOrders1760000012000 implements MigrationInterface {
  name = 'AddOrderNumberToOrders1760000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "order_number" varchar(32)
    `);

    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          id,
          to_char(created_at AT TIME ZONE 'Europe/Istanbul', 'YYMMDD')
            || '-'
            || LPAD(
              ROW_NUMBER() OVER (
                PARTITION BY restaurant_id, to_char(created_at AT TIME ZONE 'Europe/Istanbul', 'YYMMDD')
                ORDER BY created_at ASC, id ASC
              )::text,
              3,
              '0'
            ) AS computed_order_number
        FROM "orders"
        WHERE "order_number" IS NULL
      )
      UPDATE "orders" o
      SET "order_number" = n.computed_order_number
      FROM numbered n
      WHERE o.id = n.id
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_number" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_restaurant_order_number"
      ON "orders" ("restaurant_id", "order_number")
    `);

    await queryRunner.query(`
      UPDATE "completed_orders" co
      SET "orders_snapshot" = COALESCE((
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(elem) = 'object' AND o.order_number IS NOT NULL
            THEN elem || jsonb_build_object('orderNumber', o.order_number)
            ELSE elem
          END
          ORDER BY ord
        )
        FROM jsonb_array_elements(co.orders_snapshot) WITH ORDINALITY AS arr(elem, ord)
        LEFT JOIN "orders" o ON (elem->>'id') = o.id::text
      ), co.orders_snapshot)
      WHERE jsonb_typeof(co.orders_snapshot) = 'array'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_restaurant_order_number"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "order_number"`);
  }
}
