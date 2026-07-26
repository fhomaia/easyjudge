import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimerStartedScoreEventKind1785013000000
  implements MigrationInterface
{
  name = 'AddTimerStartedScoreEventKind1785013000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."score_events_kind_enum" ADD VALUE 'timer_started'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "score_events" WHERE "kind" = 'timer_started'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."score_events_kind_enum" RENAME TO "score_events_kind_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."score_events_kind_enum" AS ENUM('score_set', 'deduction_add', 'deduction_remove', 'comment_set', 'sketch_set', 'sheet_submitted', 'timer_stopped', 'deduction_code_set')`,
    );
    await queryRunner.query(
      `ALTER TABLE "score_events" ALTER COLUMN "kind" TYPE "public"."score_events_kind_enum" USING "kind"::"text"::"public"."score_events_kind_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."score_events_kind_enum_old"`);
  }
}
