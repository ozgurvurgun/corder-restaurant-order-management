import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeCorderAppEmails1760000005000
  implements MigrationInterface
{
  name = 'StandardizeCorderAppEmails1760000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Platform Admins -> <local>@corder.app
    await queryRunner.query(`
      WITH normalized AS (
        SELECT
          pa."id",
          COALESCE(
            NULLIF(
              trim(both '.' from regexp_replace(
                translate(lower(split_part(pa."email", '@', 1)), 'çğıöşüİI', 'cgiosuii'),
                '[^a-z0-9._+-]+', '', 'g'
              )),
              ''
            ),
            'admin'
          ) AS local_part,
          pa."created_at"
        FROM "platform_admins" pa
      ),
      ranked AS (
        SELECT
          "id",
          local_part,
          ROW_NUMBER() OVER (PARTITION BY local_part ORDER BY "created_at" ASC, "id" ASC) AS rn
        FROM normalized
      )
      UPDATE "platform_admins" pa
      SET "email" = (
        CASE WHEN ranked.rn = 1 THEN ranked.local_part ELSE ranked.local_part || ranked.rn::text END
      ) || '@corder.app'
      FROM ranked
      WHERE pa."id" = ranked."id"
    `);

    // 2. Restaurants (email & terminal_email) -> <local>@<slug>.corder.app
    await queryRunner.query(`
      UPDATE "restaurants" r
      SET
        "email" = CASE
          WHEN r."email" IS NOT NULL AND btrim(r."email") <> '' THEN
            COALESCE(
              NULLIF(
                trim(both '.' from regexp_replace(
                  translate(lower(split_part(r."email", '@', 1)), 'çğıöşüİI', 'cgiosuii'),
                  '[^a-z0-9._+-]+', '', 'g'
                )),
                ''
              ),
              'info'
            ) || '@' || r."slug" || '.corder.app'
          ELSE r."email"
        END,
        "terminal_email" = CASE
          WHEN r."terminal_email" IS NOT NULL AND btrim(r."terminal_email") <> '' THEN
            COALESCE(
              NULLIF(
                trim(both '.' from regexp_replace(
                  translate(lower(split_part(r."terminal_email", '@', 1)), 'çğıöşüİI', 'cgiosuii'),
                  '[^a-z0-9._+-]+', '', 'g'
                )),
                ''
              ),
              'terminal'
            ) || '@' || r."slug" || '.corder.app'
          ELSE r."terminal_email"
        END
    `);

    // 3. Restaurant Staff -> <local>@<restaurant-slug>.corder.app
    await queryRunner.query(`
      WITH normalized AS (
        SELECT
          rs."id",
          r."slug" AS tenant_slug,
          COALESCE(
            NULLIF(
              trim(both '.' from regexp_replace(
                translate(lower(split_part(rs."email", '@', 1)), 'çğıöşüİI', 'cgiosuii'),
                '[^a-z0-9._+-]+', '', 'g'
              )),
              ''
            ),
            'personel'
          ) AS local_part,
          rs."created_at"
        FROM "restaurant_staff" rs
        INNER JOIN "restaurants" r ON r."id" = rs."restaurant_id"
        WHERE rs."email" IS NOT NULL AND btrim(rs."email") <> ''
      ),
      ranked AS (
        SELECT
          "id",
          tenant_slug,
          local_part,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_slug, local_part
            ORDER BY "created_at" ASC, "id" ASC
          ) AS rn
        FROM normalized
      )
      UPDATE "restaurant_staff" rs
      SET "email" = (
        CASE WHEN ranked.rn = 1 THEN ranked.local_part ELSE ranked.local_part || ranked.rn::text END
      ) || '@' || ranked.tenant_slug || '.corder.app'
      FROM ranked
      WHERE rs."id" = ranked."id"
    `);

    // 4. Root Admins (Boss accounts) -> <local>@<brand-or-branch-slug>.corder.app
    await queryRunner.query(`
      WITH resolved_boss AS (
        SELECT
          ra."id",
          COALESCE(
            NULLIF(
              trim(both '.' from regexp_replace(
                translate(lower(split_part(ra."email", '@', 1)), 'çğıöşüİI', 'cgiosuii'),
                '[^a-z0-9._+-]+', '', 'g'
              )),
              ''
            ),
            'boss'
          ) AS local_part,
          CASE
            WHEN ra."boss_tier" = 'brand_owner'
              AND ra."brand_name" IS NOT NULL
              AND btrim(ra."brand_name") <> ''
            THEN NULLIF(
              trim(both '-' from regexp_replace(
                translate(lower(ra."brand_name"), 'çğıöşüİI', 'cgiosuii'),
                '[^a-z0-9]+', '-', 'g'
              )),
              ''
            )
            ELSE COALESCE(
              (SELECT r."slug" FROM "restaurants" r WHERE r."id" = ra."restaurant_id"),
              (
                SELECT r."slug"
                FROM "boss_restaurants" br
                INNER JOIN "restaurants" r ON r."id" = br."restaurant_id"
                WHERE br."boss_id" = ra."id"
                ORDER BY br."created_at" ASC
                LIMIT 1
              )
            )
          END AS tenant_slug,
          ra."created_at"
        FROM "root_admins" ra
      ),
      with_domain AS (
        SELECT
          "id",
          local_part,
          CASE
            WHEN tenant_slug IS NOT NULL AND tenant_slug <> ''
            THEN tenant_slug || '.corder.app'
            ELSE 'corder.app'
          END AS domain_part,
          "created_at"
        FROM resolved_boss
      ),
      ranked AS (
        SELECT
          "id",
          local_part,
          domain_part,
          ROW_NUMBER() OVER (
            PARTITION BY domain_part, local_part
            ORDER BY "created_at" ASC, "id" ASC
          ) AS rn
        FROM with_domain
      )
      UPDATE "root_admins" ra
      SET "email" = (
        CASE WHEN ranked.rn = 1 THEN ranked.local_part ELSE ranked.local_part || ranked.rn::text END
      ) || '@' || ranked.domain_part
      FROM ranked
      WHERE ra."id" = ranked."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`);
  }
}
