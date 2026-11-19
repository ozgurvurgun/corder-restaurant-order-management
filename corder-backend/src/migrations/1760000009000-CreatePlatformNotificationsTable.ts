import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformNotificationsTable1760000009000
  implements MigrationInterface
{
  name = 'CreatePlatformNotificationsTable1760000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "message" text NOT NULL,
        "level" character varying(24) NOT NULL DEFAULT 'info',
        "target_apps" jsonb NOT NULL DEFAULT '["merchant","boss"]'::jsonb,
        "target_restaurant_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "scheduled_at" TIMESTAMP WITH TIME ZONE,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "status" character varying(24) NOT NULL DEFAULT 'sent',
        "created_by" character varying(120) NOT NULL DEFAULT 'Platform Admin',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_platform_notifications_status_scheduled"
        ON "platform_notifications" ("status", "scheduled_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_platform_notifications_sent_at"
        ON "platform_notifications" ("sent_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_notifications"`);
  }
}

