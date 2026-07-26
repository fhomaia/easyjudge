import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSheetSubmittedToScoreEvents1784998881579 implements MigrationInterface {
  name = 'AddSheetSubmittedToScoreEvents1784998881579';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."score_events_kind_enum" ADD VALUE 'sheet_submitted'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres não tem "DROP VALUE" de enum — se algum score_event já
    // usar 'sheet_submitted', apaga essas linhas antes de trocar o tipo
    // (são só marcadores, sem dado de nota/dedução associado).
    await queryRunner.query(
      `DELETE FROM "score_events" WHERE "kind" = 'sheet_submitted'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."score_events_kind_enum" RENAME TO "score_events_kind_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."score_events_kind_enum" AS ENUM('score_set', 'deduction_add', 'deduction_remove', 'comment_set', 'sketch_set')`,
    );
    await queryRunner.query(
      `ALTER TABLE "score_events" ALTER COLUMN "kind" TYPE "public"."score_events_kind_enum" USING "kind"::"text"::"public"."score_events_kind_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."score_events_kind_enum_old"`);
  }
}
