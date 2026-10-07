import { MigrationInterface, QueryRunner } from 'typeorm';

// Regras de crossover do evento (2026-10-07), na etapa Regulamento, e a
// hora em que o atleta entrou em cada equipe+categoria: num conflito entre
// dois programas, a pendência fica com quem inscreveu o atleta por último.
// As linhas que já existiam ficam com a hora da migration (empate, que o
// cálculo desempata pelo envio da ficha).
export class AddCrossoverRules1790310000000 implements MigrationInterface {
  name = 'AddCrossoverRules1790310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD "crossover_rules" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_category_athletes" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_category_athletes" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP COLUMN "crossover_rules"`,
    );
  }
}
