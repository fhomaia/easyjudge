import { MigrationInterface, QueryRunner } from 'typeorm';

// Regra direta da categoria (2026-10-06): mínimo/máximo de atletas e de
// idade (com a própria data de referência da idade), pra quem não quer
// criar uma opção de Tamanho/Faixa etária. Só acrescenta colunas.
export class AddCategoryDirectRules1790250000000 implements MigrationInterface {
  name = 'AddCategoryDirectRules1790250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "min_athletes" integer, ADD "max_athletes" integer, ADD "min_age" integer, ADD "max_age" integer, ADD "age_cutoff_date" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN "age_cutoff_date", DROP COLUMN "max_age", DROP COLUMN "min_age", DROP COLUMN "max_athletes", DROP COLUMN "min_athletes"`,
    );
  }
}
