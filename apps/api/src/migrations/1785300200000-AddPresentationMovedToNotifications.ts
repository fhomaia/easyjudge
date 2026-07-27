import { MigrationInterface, QueryRunner } from 'typeorm';

// Suporte a NotificationType.PRESENTATION_MOVED
// (ScheduleService.moveEntry) — mesmo padrão de
// AddPresentationCancelledToNotifications, ADD VALUE direto.
export class AddPresentationMovedToNotifications1785300200000
  implements MigrationInterface
{
  name = 'AddPresentationMovedToNotifications1785300200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'presentation_moved'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" = 'presentation_moved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('presentation_completed', 'scores_released', 'results_released', 'contestation_released', 'evaluation_pending', 'contestation_requested', 'presentation_started', 'presentation_cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."notifications_type_enum_old"`,
    );
  }
}
