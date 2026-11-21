import { MigrationInterface, QueryRunner } from 'typeorm';
import { formatTitleCase } from '../common/text/text-normalizer';

export class BackfillCashAndLedgerDescriptionsTitleCase1760000019000
  implements MigrationInterface
{
  name = 'BackfillCashAndLedgerDescriptionsTitleCase1760000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cashRows = (await queryRunner.query(
      `SELECT "id", "description" FROM "cash_transactions" WHERE "description" IS NOT NULL`,
    )) as Array<{ id: string; description: string }>;

    if (Array.isArray(cashRows)) {
      for (const row of cashRows) {
        const formatted = formatTitleCase(row.description, 'tr');
        if (formatted && formatted !== row.description) {
          await queryRunner.query(
            `UPDATE "cash_transactions" SET "description" = $1 WHERE "id" = $2`,
            [formatted, row.id],
          );
        }
      }
    }

    const ledgerRows = (await queryRunner.query(
      `SELECT "id", "description" FROM "ledger_entries" WHERE "description" IS NOT NULL`,
    )) as Array<{ id: string; description: string }>;

    if (Array.isArray(ledgerRows)) {
      for (const row of ledgerRows) {
        const formatted = formatTitleCase(row.description, 'tr');
        if (formatted && formatted !== row.description) {
          await queryRunner.query(
            `UPDATE "ledger_entries" SET "description" = $1 WHERE "id" = $2`,
            [formatted, row.id],
          );
        }
      }
    }

    const openAccountRows = (await queryRunner.query(
      `SELECT "id", "description" FROM "open_accounts" WHERE "description" IS NOT NULL`,
    )) as Array<{ id: string; description: string }>;

    if (Array.isArray(openAccountRows)) {
      for (const row of openAccountRows) {
        const formatted = formatTitleCase(row.description, 'tr');
        if (formatted && formatted !== row.description) {
          await queryRunner.query(
            `UPDATE "open_accounts" SET "description" = $1 WHERE "id" = $2`,
            [formatted, row.id],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`);
  }
}
