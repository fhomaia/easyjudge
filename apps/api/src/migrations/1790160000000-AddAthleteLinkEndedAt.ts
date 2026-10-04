import { MigrationInterface, QueryRunner } from 'typeorm';

// Vínculo atleta<->programa encerrado em vez de apagado (2026-10-03):
// quem sai da equipe mantém o histórico dos eventos já iniciados ou
// concluídos (ver AthletesService.endLink). Só cria a coluna; vínculos
// existentes continuam ativos.
export class AddAthleteLinkEndedAt1790160000000 implements MigrationInterface {
  name = 'AddAthleteLinkEndedAt1790160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" ADD "ended_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "athlete_links" DROP COLUMN "ended_at"`,
    );
  }
}
