import { MigrationInterface, QueryRunner } from 'typeorm';

export class GenericScheduleResources1784198711437 implements MigrationInterface {
  name = 'GenericScheduleResources1784198711437';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" ADD "supports_presentations" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "schedule_resources" SET "supports_presentations" = true WHERE "type" = 'mat'`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" DROP COLUMN "type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."schedule_resources_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "mat_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "warmup_area_count"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD "warmup_area_count" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD "mat_count" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."schedule_resources_type_enum" AS ENUM('mat', 'warmup', 'ceremony', 'award', 'break', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" ADD "type" "public"."schedule_resources_type_enum"`,
    );
    await queryRunner.query(
      `UPDATE "schedule_resources" SET "type" = 'mat' WHERE "supports_presentations" = true`,
    );
    await queryRunner.query(
      `UPDATE "schedule_resources" SET "type" = 'other' WHERE "type" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" ALTER COLUMN "type" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_resources" DROP COLUMN "supports_presentations"`,
    );
  }
}
