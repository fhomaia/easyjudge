import { MigrationInterface, QueryRunner } from 'typeorm';

// Inscrição pelo programa em rascunho até ele enviar (2026-10-05, ver
// ProgramRegistrationService.submit). Nulo = rascunho: não aparece pro
// produtor, nem no cronograma, nem nas contagens. Programas que já
// existem (todos cadastrados pelo produtor ou já visíveis) ficam como
// enviados.
export class AddProgramRegistrationSubmittedAt1790210000000
  implements MigrationInterface
{
  name = 'AddProgramRegistrationSubmittedAt1790210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_participations" ADD "submitted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "program_participations" SET "submitted_at" = "created_at"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_participations" DROP COLUMN "submitted_at"`,
    );
  }
}
