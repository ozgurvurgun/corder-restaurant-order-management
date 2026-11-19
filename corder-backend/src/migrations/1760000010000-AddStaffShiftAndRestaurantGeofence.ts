import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffShiftAndRestaurantGeofence1760000010000
  implements MigrationInterface
{
  name = 'AddStaffShiftAndRestaurantGeofence1760000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurant_staff"
        ADD COLUMN IF NOT EXISTS "shift_restriction_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "shift_start_time" character varying(8),
        ADD COLUMN IF NOT EXISTS "shift_end_time" character varying(8),
        ADD COLUMN IF NOT EXISTS "shift_cutoff_offset_minutes" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "terminal_location_restriction_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "location_latitude" double precision,
        ADD COLUMN IF NOT EXISTS "location_longitude" double precision,
        ADD COLUMN IF NOT EXISTS "location_radius_meters" integer NOT NULL DEFAULT 150
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurants"
        DROP COLUMN IF EXISTS "location_radius_meters",
        DROP COLUMN IF EXISTS "location_longitude",
        DROP COLUMN IF EXISTS "location_latitude",
        DROP COLUMN IF EXISTS "terminal_location_restriction_enabled"
    `);

    await queryRunner.query(`
      ALTER TABLE "restaurant_staff"
        DROP COLUMN IF EXISTS "shift_cutoff_offset_minutes",
        DROP COLUMN IF EXISTS "shift_end_time",
        DROP COLUMN IF EXISTS "shift_start_time",
        DROP COLUMN IF EXISTS "shift_restriction_enabled"
    `);
  }
}
