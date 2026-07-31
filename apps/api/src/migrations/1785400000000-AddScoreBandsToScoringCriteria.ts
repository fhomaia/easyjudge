import { MigrationInterface, QueryRunner } from 'typeorm';

// Faixas de pontuação opcionais por item de avaliação (ScoringCriterion)
// — só efeito visual na tela do jurado, ainda não implementado (ver
// CLAUDE.md). `score_bands` é jsonb (lista pequena, editada junto do
// resto do critério, sem necessidade de tabela própria).
export class AddScoreBandsToScoringCriteria1785400000000
  implements MigrationInterface
{
  name = 'AddScoreBandsToScoringCriteria1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD "use_score_bands" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD "score_bands" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP COLUMN "score_bands"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP COLUMN "use_score_bands"`,
    );
  }
}
