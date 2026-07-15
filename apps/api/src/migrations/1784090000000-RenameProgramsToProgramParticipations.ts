import { MigrationInterface, QueryRunner } from 'typeorm';

// Rename Program -> ProgramParticipation (2026-07-15): a entidade
// "programs" virou um nome ambíguo ao lado da nova ProgramProfile
// (perfil canônico) introduzida na migration anterior. Postgres não
// renomeia constraint/índice junto com a tabela (mesma gotcha já
// documentada na migration RenameTeamsToPrograms) — por isso o rename
// explícito de cada um logo em seguida.
export class RenameProgramsToProgramParticipations1784090000000
  implements MigrationInterface
{
  name = 'RenameProgramsToProgramParticipations1784090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "programs" RENAME TO "program_participations"`);

    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "PK_programs_id" TO "PK_program_participations_id"`,
    );

    await queryRunner.query(
      `ALTER INDEX "IDX_2caff4c94e1d52431f484e71ed" RENAME TO "IDX_program_participations_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "FK_2caff4c94e1d52431f484e71edb" TO "FK_program_participations_event_id"`,
    );

    await queryRunner.query(
      `ALTER INDEX "IDX_7f41ced131b5c9b9f8b99d088f" RENAME TO "IDX_program_participations_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "FK_7f41ced131b5c9b9f8b99d088f8" TO "FK_program_participations_user_id"`,
    );

    await queryRunner.query(
      `ALTER INDEX "IDX_b44b72ef368c7a57f4777d81b0" RENAME TO "IDX_program_participations_created_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "FK_b44b72ef368c7a57f4777d81b0f" TO "FK_program_participations_created_by_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "FK_program_participations_created_by_id" TO "FK_b44b72ef368c7a57f4777d81b0f"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_program_participations_created_by_id" RENAME TO "IDX_b44b72ef368c7a57f4777d81b0"`,
    );

    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "FK_program_participations_user_id" TO "FK_7f41ced131b5c9b9f8b99d088f8"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_program_participations_user_id" RENAME TO "IDX_7f41ced131b5c9b9f8b99d088f"`,
    );

    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "FK_program_participations_event_id" TO "FK_2caff4c94e1d52431f484e71edb"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_program_participations_event_id" RENAME TO "IDX_2caff4c94e1d52431f484e71ed"`,
    );

    await queryRunner.query(
      `ALTER TABLE "program_participations" RENAME CONSTRAINT "PK_program_participations_id" TO "PK_programs_id"`,
    );

    await queryRunner.query(`ALTER TABLE "program_participations" RENAME TO "programs"`);
  }
}
