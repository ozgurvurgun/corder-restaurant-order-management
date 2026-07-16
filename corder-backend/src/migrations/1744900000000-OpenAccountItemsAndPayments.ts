import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpenAccountItemsAndPayments1744900000000 implements MigrationInterface {
  name = 'OpenAccountItemsAndPayments1744900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(`CREATE INDEX "IDX_open_account_items_account" ON "open_account_items" ("open_account_id")`);

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
    await queryRunner.query(`CREATE INDEX "IDX_open_account_payments_account" ON "open_account_payments" ("open_account_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "open_account_payments"`);
    await queryRunner.query(`DROP TABLE "open_account_items"`);
  }
}
