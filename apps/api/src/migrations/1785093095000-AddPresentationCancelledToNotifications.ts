import { MigrationInterface, QueryRunner } from 'typeorm';

// Fecha o gap deixado de propósito quando o sistema de notificações foi
// construído — "[apresentação] cancelada" dependia do fluxo de
// desistência, que não existia ainda.
export class AddPresentationCancelledToNotifications1785093095000
  implements MigrationInterface
{
  name = 'AddPresentationCancelledToNotifications1785093095000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'presentation_cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" = 'presentation_cancelled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('presentation_completed', 'scores_released', 'results_released', 'contestation_released', 'evaluation_pending', 'contestation_requested', 'presentation_started')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."notifications_type_enum_old"`,
    );
  }
}
