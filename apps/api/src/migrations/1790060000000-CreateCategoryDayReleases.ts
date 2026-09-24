import { MigrationInterface, QueryRunner } from 'typeorm';

// Liberação por categoria em cada dia (ver CategoryDayRelease). O estado
// atual das chaves globais de cada evento (events.*_released_at, versão
// ativa) é copiado pra todo par dia+categoria que já tem apresentação,
// então quem já tinha liberado continua liberado. As colunas antigas em
// `events` ficam no banco (não são mais lidas).
export class CreateCategoryDayReleases1790060000000 implements MigrationInterface {
  name = 'CreateCategoryDayReleases1790060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "category_day_releases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alias_id" uuid NOT NULL,
        "schedule_day_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "scores_released_at" TIMESTAMP WITH TIME ZONE,
        "contestation_released_at" TIMESTAMP WITH TIME ZONE,
        "results_released_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_category_day_releases_day_category" UNIQUE ("schedule_day_id", "category_id"),
        CONSTRAINT "PK_category_day_releases_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_category_day_releases_alias_id" ON "category_day_releases" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_day_releases" ADD CONSTRAINT "FK_category_day_releases_schedule_day" FOREIGN KEY ("schedule_day_id") REFERENCES "schedule_days"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_day_releases" ADD CONSTRAINT "FK_category_day_releases_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "category_day_releases"
        ("alias_id", "schedule_day_id", "category_id", "scores_released_at", "contestation_released_at", "results_released_at")
      SELECT DISTINCT ON (d."id", se."category_id")
        d."alias_id", d."id", se."category_id",
        e."scores_released_at", e."contestation_released_at", e."results_released_at"
      FROM "schedule_entries" se
      JOIN "schedule_resources" r ON r."id" = se."resource_id"
      JOIN "schedule_days" d ON d."id" = r."schedule_day_id"
      JOIN "events" e ON e."alias_id" = d."alias_id" AND e."active" = true
      JOIN "categories" c ON c."id" = se."category_id"
      WHERE se."type" = 'presentation'
        AND (e."scores_released_at" IS NOT NULL
          OR e."contestation_released_at" IS NOT NULL
          OR e."results_released_at" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "category_day_releases" DROP CONSTRAINT "FK_category_day_releases_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_day_releases" DROP CONSTRAINT "FK_category_day_releases_schedule_day"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_category_day_releases_alias_id"`,
    );
    await queryRunner.query(`DROP TABLE "category_day_releases"`);
  }
}
