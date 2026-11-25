import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoiceAnnouncementEnabledToRestaurants1760000021000
  implements MigrationInterface
{
  name = 'AddVoiceAnnouncementEnabledToRestaurants1760000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      ADD COLUMN IF NOT EXISTS "voice_announcement_enabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
      DROP COLUMN IF EXISTS "voice_announcement_enabled"
    `);
  }
}
