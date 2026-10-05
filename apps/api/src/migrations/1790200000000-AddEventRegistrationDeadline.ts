import { MigrationInterface, QueryRunner } from 'typeorm';

// Data limite da inscrição pelo próprio programa (2026-10-05, ver
// isRegistrationOpen em events/registration-window.ts). Nulo = sem data
// limite (inscrição aberta enquanto o evento estiver em rascunho ou
// publicado). Só cria a coluna.
export class AddEventRegistrationDeadline1790200000000
  implements MigrationInterface
{
  name = 'AddEventRegistrationDeadline1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "registration_deadline" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "registration_deadline"`,
    );
  }
}
