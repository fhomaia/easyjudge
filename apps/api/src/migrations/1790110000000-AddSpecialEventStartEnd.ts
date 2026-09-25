import { MigrationInterface, QueryRunner } from 'typeorm';

// Início/fim sinalizados de eventos especiais do cronograma (Almoço,
// Batalhas, Premiação...) — admin/assessor sinaliza pelo menu "⋯" do
// Cronograma ao vivo (pedido do usuário, 2026-09-25). Só aditiva:
// colunas novas nulas + dois valores novos no enum de notificação.
export class AddSpecialEventStartEnd1790110000000 implements MigrationInterface {
  name = 'AddSpecialEventStartEnd1790110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "started_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" ADD "ended_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'special_event_started'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'special_event_ended'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type"::text IN ('special_event_started', 'special_event_ended')`,
    );
    // Postgres não tem "DROP VALUE" de enum: recria o tipo sem os dois.
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('presentation_completed', 'scores_released', 'results_released', 'contestation_released', 'evaluation_pending', 'contestation_requested', 'presentation_started', 'presentation_cancelled', 'presentation_moved')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "ended_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_entries" DROP COLUMN "started_at"`,
    );
  }
}
