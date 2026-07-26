import { MigrationInterface, QueryRunner } from 'typeorm';

// Mesmo padrão de AddAthleteRoleToEventMembers — ADD VALUE é reversível
// livremente, mas o down() precisa do caminho rename->create->cast->drop
// porque Postgres não tem DROP VALUE de enum.
export class AddPresentationStartedToNotifications1785089423000
  implements MigrationInterface
{
  name = 'AddPresentationStartedToNotifications1785089423000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'presentation_started'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" = 'presentation_started'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('presentation_completed', 'scores_released', 'results_released', 'contestation_released', 'evaluation_pending', 'contestation_requested')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
  }
}
