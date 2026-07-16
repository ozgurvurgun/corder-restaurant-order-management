import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderItemCancelMeta1744800000000 implements MigrationInterface {
  name = 'OrderItemCancelMeta1744800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "cancel_reason" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "cancelled_by" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "cancelled_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "cancelled_at"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "cancelled_by"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "cancel_reason"`);
  }
}
