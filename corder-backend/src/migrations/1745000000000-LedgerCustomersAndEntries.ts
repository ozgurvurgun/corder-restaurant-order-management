import { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerCustomersAndEntries1745000000000 implements MigrationInterface {
  name = 'LedgerCustomersAndEntries1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(`CREATE INDEX "IDX_ledger_customers_restaurant" ON "ledger_customers" ("restaurant_id")`);

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
    await queryRunner.query(`CREATE INDEX "IDX_ledger_entries_restaurant" ON "ledger_entries" ("restaurant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_entries_customer" ON "ledger_entries" ("customer_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TABLE "ledger_customers"`);
  }
}
