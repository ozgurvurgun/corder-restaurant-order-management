import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductShowInMenuAndBackfillCashDescriptions1760000018000
  implements MigrationInterface
{
  name = 'AddProductShowInMenuAndBackfillCashDescriptions1760000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "show_in_menu" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      UPDATE "products"
      SET "show_in_menu" = true
      WHERE "show_in_menu" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_category_show_in_menu_order"
      ON "products" ("category_id", "show_in_menu", "order")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cash_transactions_restaurant_created"
      ON "cash_transactions" ("restaurant_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      UPDATE "cash_transactions"
      SET "description" = REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  "description",
                  '^walk-in sale - ',
                  'Hızlı Satış - ',
                  'i'
                ),
                ' - Check \\(split cash\\)$',
                ' - Hesap Kapanışı (Parçalı Nakit)'
              ),
              ' - Check$',
              ' - Hesap Kapanışı'
            ),
            ' - completed check adjustment$',
            ' - Hesap Düzenleme Farkı'
          ),
          '^Open account payment: ',
          'Açık Hesap Tahsilatı: '
        ),
        '^Ledger payment: ',
        'Cari Tahsilat: '
      )
      WHERE "description" LIKE '% - Check%'
         OR "description" LIKE '% - completed check adjustment'
         OR "description" LIKE 'Open account payment: %'
         OR "description" LIKE 'Ledger payment: %'
         OR "description" ILIKE 'walk-in sale - %'
    `);
    await queryRunner.query(`
      UPDATE "ledger_entries"
      SET "description" = CASE
        WHEN "description" = 'Payment received' THEN 'Cari Tahsilat'
        WHEN "description" LIKE 'Payment received (%)' THEN REPLACE("description", 'Payment received (', 'Cari Tahsilat (')
        WHEN "description" LIKE '% table check' THEN REGEXP_REPLACE("description", ' table check$', ' Hesap Kapanışı')
        ELSE "description"
      END
      WHERE "description" = 'Payment received'
         OR "description" LIKE 'Payment received (%)'
         OR "description" LIKE '% table check'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cash_transactions_restaurant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_products_category_show_in_menu_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "show_in_menu"`,
    );
  }
}

