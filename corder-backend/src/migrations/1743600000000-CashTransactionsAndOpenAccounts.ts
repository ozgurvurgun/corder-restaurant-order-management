import { MigrationInterface, QueryRunner } from 'typeorm';

export class CashTransactionsAndOpenAccounts1743600000000 implements MigrationInterface {
  name = 'CashTransactionsAndOpenAccounts1743600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_shifts"
      ADD COLUMN "cash_in" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "cash_out" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "total_revenue" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "total_nakit" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "total_kart" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "total_yemek_karti" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "total_multinet" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN "transaction_count" integer NOT NULL DEFAULT 0
    `);

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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_open_accounts_restaurant_id"`);
    await queryRunner.query(`DROP TABLE "open_accounts"`);

    await queryRunner.query(`DROP INDEX "IDX_cash_transactions_restaurant_shift"`);
    await queryRunner.query(`DROP INDEX "IDX_cash_transactions_restaurant_id"`);
    await queryRunner.query(`DROP TABLE "cash_transactions"`);

    await queryRunner.query(`
      ALTER TABLE "cash_shifts"
      DROP COLUMN "cash_in",
      DROP COLUMN "cash_out",
      DROP COLUMN "total_revenue",
      DROP COLUMN "total_nakit",
      DROP COLUMN "total_kart",
      DROP COLUMN "total_yemek_karti",
      DROP COLUMN "total_multinet",
      DROP COLUMN "transaction_count"
    `);
  }
}

