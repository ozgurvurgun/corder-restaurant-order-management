import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderUserDisplayName1744600000000 implements MigrationInterface {
  name = 'OrderUserDisplayName1744600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "user_display_name" character varying(120)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "user_display_name"`);
  }
}
