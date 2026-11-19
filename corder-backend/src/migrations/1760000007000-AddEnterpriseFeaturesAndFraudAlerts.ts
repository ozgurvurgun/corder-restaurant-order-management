import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnterpriseFeaturesAndFraudAlerts1760000007000
  implements MigrationInterface
{
  name = 'AddEnterpriseFeaturesAndFraudAlerts1760000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "logo_url" character varying(500),
        ADD COLUMN IF NOT EXISTS "notifications_cleared_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "dismissed_notification_ids" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fraud_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurant_id" uuid NOT NULL,
        "rule_code" character varying(64) NOT NULL,
        "severity" character varying(16) NOT NULL,
        "risk_score" integer NOT NULL DEFAULT 50,
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "actor_name" character varying(160),
        "actor_id" uuid,
        "table_name" character varying(120),
        "amount_impact" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying(24) NOT NULL DEFAULT 'open',
        "resolution_note" text,
        "resolved_by" character varying(160),
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fraud_alerts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fraud_alerts_restaurant" FOREIGN KEY ("restaurant_id")
          REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fraud_alerts_restaurant"
        ON "fraud_alerts" ("restaurant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fraud_alerts_restaurant_status"
        ON "fraud_alerts" ("restaurant_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fraud_alerts_restaurant_created"
        ON "fraud_alerts" ("restaurant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "waiter_calls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurant_id" uuid NOT NULL,
        "table_id" uuid NOT NULL,
        "table_name" character varying(120) NOT NULL,
        "section_name" character varying(120),
        "request_type" character varying(32) NOT NULL DEFAULT 'waiter',
        "note" character varying(255),
        "acknowledged" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_waiter_calls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_waiter_calls_restaurant" FOREIGN KEY ("restaurant_id")
          REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_waiter_calls_restaurant_created"
        ON "waiter_calls" ("restaurant_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "waiter_calls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fraud_alerts"`);
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "dismissed_notification_ids",
        DROP COLUMN IF EXISTS "notifications_cleared_at",
        DROP COLUMN IF EXISTS "logo_url"
    `);
  }
}
