import { MigrationInterface, QueryRunner } from 'typeorm';

// Suporte a EventActivityAction.PRESENTATION_MOVED
// (ScheduleService.moveEntry, só quando o evento não está mais
// "created") — mesmo padrão de AddCompletedToEventActivityLogAction,
// ADD VALUE direto.
export class AddPresentationMovedToEventActivityLogAction1785300300000
  implements MigrationInterface
{
  name = 'AddPresentationMovedToEventActivityLogAction1785300300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_activity_logs_action_enum" ADD VALUE 'presentation_moved'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "event_activity_logs" WHERE "action" = 'presentation_moved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_activity_logs_action_enum" RENAME TO "event_activity_logs_action_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_activity_logs_action_enum" AS ENUM('created', 'updated', 'published', 'unpublished', 'started', 'deleted', 'category_created', 'category_updated', 'category_deleted', 'program_created', 'program_updated', 'program_deleted', 'team_created', 'team_updated', 'team_deleted', 'regulation_document_uploaded', 'regulation_document_removed', 'regulation_deductions_updated', 'staff_member_added', 'staff_member_updated', 'staff_member_removed', 'completed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" ALTER COLUMN "action" TYPE "public"."event_activity_logs_action_enum" USING "action"::"text"::"public"."event_activity_logs_action_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."event_activity_logs_action_enum_old"`,
    );
  }
}
