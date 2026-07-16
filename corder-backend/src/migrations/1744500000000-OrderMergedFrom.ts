import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderMergedFrom1744500000000 implements MigrationInterface {
  name = 'OrderMergedFrom1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "merged_from" character varying(160)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "merged_from"`);
  }
}
