import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchedule1784161740300 implements MigrationInterface {
  name = 'CreateSchedule1784161740300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "schedule_days" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "day_index" integer NOT NULL, "date" date NOT NULL, "start_minutes" integer NOT NULL DEFAULT '480', "end_minutes" integer NOT NULL DEFAULT '1200', "default_warmup_minutes" integer NOT NULL DEFAULT '10', "mat_count" integer NOT NULL DEFAULT '1', "warmup_area_count" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6c680708836f207756d0d275d54" UNIQUE ("event_id", "day_index"), CONSTRAINT "PK_92e16541f328fb9658feccc082a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_344a3a879983814901fbde371e" ON "schedule_days" ("event_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."schedule_resources_type_enum" AS ENUM('mat', 'warmup', 'ceremony', 'award', 'break', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "schedule_resources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "schedule_day_id" uuid NOT NULL, "type" "public"."schedule_resources_type_enum" NOT NULL, "name" character varying(100) NOT NULL, "order" integer NOT NULL DEFAULT '0', "paired_resource_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b0905b9520e725a172e6693f5e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a57b91e7e2d6483d1ec6a5572" ON "schedule_resources" ("schedule_day_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."schedule_entries_type_enum" AS ENUM('presentation', 'warmup', 'break', 'ceremony', 'award')`,
    );
    await queryRunner.query(
      `CREATE TABLE "schedule_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "resource_id" uuid NOT NULL, "type" "public"."schedule_entries_type_enum" NOT NULL, "order" integer NOT NULL, "duration_minutes" integer NOT NULL, "team_id" uuid, "category_id" uuid, "linked_entry_id" uuid, "label" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bfe848ea36c4b3d8a4b18ec82aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_55f1d5ff6b81569abf3865a2e0" ON "schedule_entries" ("resource_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_329a97f2301d9a0fa5ec5ed302" ON "schedule_entries" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_942ae874442559890f7f097bfe" ON "schedule_entries" ("category_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD CONSTRAINT "FK_344a3a879983814901fbde371e7" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" ADD CONSTRAINT "FK_6a57b91e7e2d6483d1ec6a5572f" FOREIGN KEY ("schedule_day_id") REFERENCES "schedule_days"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" ADD CONSTRAINT "FK_ae270fee91bd51767d606b6e526" FOREIGN KEY ("paired_resource_id") REFERENCES "schedule_resources"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD CONSTRAINT "FK_55f1d5ff6b81569abf3865a2e04" FOREIGN KEY ("resource_id") REFERENCES "schedule_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD CONSTRAINT "FK_329a97f2301d9a0fa5ec5ed302a" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD CONSTRAINT "FK_942ae874442559890f7f097bfeb" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD CONSTRAINT "FK_d93f8111f965006dacbd159c2b9" FOREIGN KEY ("linked_entry_id") REFERENCES "schedule_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP CONSTRAINT "FK_d93f8111f965006dacbd159c2b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP CONSTRAINT "FK_942ae874442559890f7f097bfeb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP CONSTRAINT "FK_329a97f2301d9a0fa5ec5ed302a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP CONSTRAINT "FK_55f1d5ff6b81569abf3865a2e04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" DROP CONSTRAINT "FK_ae270fee91bd51767d606b6e526"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" DROP CONSTRAINT "FK_6a57b91e7e2d6483d1ec6a5572f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP CONSTRAINT "FK_344a3a879983814901fbde371e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_942ae874442559890f7f097bfe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_329a97f2301d9a0fa5ec5ed302"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55f1d5ff6b81569abf3865a2e0"`,
    );
    await queryRunner.query(`DROP TABLE "schedule_entries"`);
    await queryRunner.query(`DROP TYPE "public"."schedule_entries_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a57b91e7e2d6483d1ec6a5572"`,
    );
    await queryRunner.query(`DROP TABLE "schedule_resources"`);
    await queryRunner.query(
      `DROP TYPE "public"."schedule_resources_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_344a3a879983814901fbde371e"`,
    );
    await queryRunner.query(`DROP TABLE "schedule_days"`);
  }
}
