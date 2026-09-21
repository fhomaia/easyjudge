import { MigrationInterface, QueryRunner } from 'typeorm';

// Tipos de dedução PADRÃO (IASF) que o organizador removeu no modo
// "Personalizado" de um evento. Só oculta naquele evento — os tipos
// continuam existindo (modo IASF / restaurar). Escrita à mão (o
// migration:generate traz deriva de schema alheia, ver CLAUDE.md).
export class AddHiddenDeductionsToRegulations1789910000000
  implements MigrationInterface
{
  name = 'AddHiddenDeductionsToRegulations1789910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "hidden_deductions" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "hidden_deductions"`,
    );
  }
}
