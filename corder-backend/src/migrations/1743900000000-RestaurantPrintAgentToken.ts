import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestaurantPrintAgentToken1743900000000 implements MigrationInterface {
  name = 'RestaurantPrintAgentToken1743900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "restaurants" ADD "print_agent_token" character varying(128)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_restaurants_print_agent_token" ON "restaurants" ("print_agent_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_restaurants_print_agent_token"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "print_agent_token"`);
  }
}
