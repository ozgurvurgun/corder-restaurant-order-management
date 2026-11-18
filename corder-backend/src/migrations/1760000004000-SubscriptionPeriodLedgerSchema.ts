import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionPeriodLedgerSchema1760000004000
  implements MigrationInterface
{
  name = 'SubscriptionPeriodLedgerSchema1760000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "billing_start_period" character varying(7)
    `);

    await queryRunner.query(`
      UPDATE "restaurants"
      SET "billing_start_period" = to_char("created_at" AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM')
      WHERE "billing_start_period" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurant_subscription_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "restaurant_id" uuid NOT NULL,
        "paid_at" TIMESTAMPTZ NOT NULL,
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "periods" text[] NOT NULL,
        "period_start" character varying(7) NOT NULL,
        "period_end" character varying(7) NOT NULL,
        "months_count" integer NOT NULL DEFAULT 1,
        "payment_method" character varying(32) NOT NULL DEFAULT 'bank_transfer',
        "note" text,
        "recorded_by" character varying(120),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_subscription_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sub_payments_restaurant" FOREIGN KEY ("restaurant_id")
          REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sub_payments_restaurant_paid_at"
        ON "restaurant_subscription_payments" ("restaurant_id", "paid_at" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_sub_payments_paid_at"
        ON "restaurant_subscription_payments" ("paid_at" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_sub_payments_periods_gin"
        ON "restaurant_subscription_payments" USING GIN ("periods");
    `);

    const hasLegacyHistory: Array<{ exists: boolean }> = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'restaurants'
          AND column_name = 'payment_history'
      ) AS "exists"
    `);

    if (hasLegacyHistory[0]?.exists) {
      await queryRunner.query(`
        WITH extracted AS (
          SELECT
            r."id" AS restaurant_id,
            r."billing_status",
            elem->>'period' AS period_val,
            COALESCE(NULLIF(elem->>'amount', '')::numeric(10,2), 0) AS amount_val,
            COALESCE(NULLIF(elem->>'paidAt', '')::timestamptz, now()) AS paid_at_val,
            NULLIF(elem->>'note', '') AS note_val,
            NULLIF(elem->>'recordedBy', '') AS recorded_by_val,
            ROW_NUMBER() OVER (
              PARTITION BY r."id", elem->>'period'
              ORDER BY COALESCE(NULLIF(elem->>'paidAt', '')::timestamptz, now()) DESC
            ) AS rn
          FROM "restaurants" r
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(r."payment_history") = 'array' THEN r."payment_history"
              ELSE '[]'::jsonb
            END
          ) AS elem
          WHERE (elem->>'period') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
            AND (
              r."billing_status" = 'paid'
              OR (elem->>'period') < to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM')
            )
        )
        INSERT INTO "restaurant_subscription_payments" (
          "restaurant_id",
          "paid_at",
          "amount",
          "periods",
          "period_start",
          "period_end",
          "months_count",
          "payment_method",
          "note",
          "recorded_by",
          "created_at",
          "updated_at"
        )
        SELECT
          restaurant_id,
          paid_at_val,
          amount_val,
          ARRAY[period_val]::text[],
          period_val,
          period_val,
          1,
          'bank_transfer',
          note_val,
          recorded_by_val,
          paid_at_val,
          paid_at_val
        FROM extracted
        WHERE rn = 1
          AND NOT EXISTS (
            SELECT 1
            FROM "restaurant_subscription_payments" rsp
            WHERE rsp."restaurant_id" = extracted.restaurant_id
              AND extracted.period_val = ANY(rsp."periods")
          )
      `);

      await queryRunner.query(`
        UPDATE "restaurants" r
        SET
          "last_payment_date" = sub.latest_paid_at,
          "last_paid_period" = sub.latest_period
        FROM (
          SELECT
            r2."id" AS restaurant_id,
            (
              SELECT MAX(rsp."paid_at")
              FROM "restaurant_subscription_payments" rsp
              WHERE rsp."restaurant_id" = r2."id"
            ) AS latest_paid_at,
            (
              SELECT MAX(p)
              FROM "restaurant_subscription_payments" rsp,
              LATERAL unnest(rsp."periods") AS p
              WHERE rsp."restaurant_id" = r2."id"
            ) AS latest_period
          FROM "restaurants" r2
        ) sub
        WHERE r."id" = sub.restaurant_id
      `);

      await queryRunner.query(`
        ALTER TABLE "restaurants"
          DROP COLUMN IF EXISTS "payment_history"
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "payment_history" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sub_payments_periods_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sub_payments_paid_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sub_payments_restaurant_paid_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_subscription_payments"`);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "billing_start_period"
    `);
  }
}

