import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderKitchenTicketPrintedAt1744000000000 implements MigrationInterface {
  name = 'OrderKitchenTicketPrintedAt1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "kitchen_ticket_printed_at" TIMESTAMPTZ`);
    await queryRunner.query(
      `UPDATE "orders" SET "kitchen_ticket_printed_at" = NOW() WHERE "kitchen_ticket_printed_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "kitchen_ticket_printed_at"`);
  }
}
