import { MigrationInterface, QueryRunner } from 'typeorm';

// Valores fixos permitidos num item de avaliação (ex.: Stunt
// Difficulty só aceita 2.5/3.0/3.5/4.0/4.5), alternativa às faixas —
// ver ScoringCriterion.useFixedValues/fixedValues.
export class AddFixedValuesToScoringCriteria1790080000000 implements MigrationInterface {
  name = 'AddFixedValuesToScoringCriteria1790080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD "use_fixed_values" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" ADD "fixed_values" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP COLUMN "fixed_values"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scoring_criteria" DROP COLUMN "use_fixed_values"`,
    );
  }
}
