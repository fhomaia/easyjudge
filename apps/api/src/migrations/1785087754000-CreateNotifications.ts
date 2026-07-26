import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1785087754000 implements MigrationInterface {
  name = 'CreateNotifications1785087754000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('presentation_completed', 'scores_released', 'results_released', 'contestation_released', 'evaluation_pending', 'contestation_requested')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_audience_enum" AS ENUM('all', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alias_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "audience" "public"."notifications_audience_enum" NOT NULL, "title" character varying NOT NULL, "schedule_entry_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notifications" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_alias_id_created_at" ON "notifications" ("alias_id", "created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "notifications_seen_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_members" DROP COLUMN "notifications_seen_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_alias_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_audience_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
  }
}
