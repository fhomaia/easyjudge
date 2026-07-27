import { MigrationInterface, QueryRunner } from 'typeorm';

// Suporte a EventActivityAction.COMPLETED (EventsService.completeEvent)
// — mesmo padrão de ExpandEventActivityLog, mas pra um valor só.
export class AddCompletedToEventActivityLogAction1785300100000
  implements MigrationInterface
{
  name = 'AddCompletedToEventActivityLogAction1785300100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_activity_logs_action_enum" ADD VALUE 'completed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "event_activity_logs" WHERE "action" = 'completed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_activity_logs_action_enum" RENAME TO "event_activity_logs_action_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_activity_logs_action_enum" AS ENUM('created', 'updated', 'published', 'unpublished', 'started', 'deleted', 'category_created', 'category_updated', 'category_deleted', 'program_created', 'program_updated', 'program_deleted', 'team_created', 'team_updated', 'team_deleted', 'regulation_document_uploaded', 'regulation_document_removed', 'regulation_deductions_updated', 'staff_member_added', 'staff_member_updated', 'staff_member_removed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_activity_logs" ALTER COLUMN "action" TYPE "public"."event_activity_logs_action_enum" USING "action"::"text"::"public"."event_activity_logs_action_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."event_activity_logs_action_enum_old"`,
    );
  }
}
