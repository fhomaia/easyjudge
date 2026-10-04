import { MigrationInterface, QueryRunner } from 'typeorm';

// Nota máxima de grupo passa a ser sempre a soma dos filhos (2026-10-03,
// ver ScoringCriteriaService.recalculateGroupScores). Alinha os grupos
// existentes: repete a atualização de baixo pra cima até nada mudar
// (cada passada sobe um nível da árvore). Grupo sem filhos não é tocado.
// Sem `down`: o valor digitado antes não fica guardado.
export class RecalculateGroupMaxScores1790170000000 implements MigrationInterface {
  name = 'RecalculateGroupMaxScores1790170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (let pass = 0; pass < 20; pass++) {
      const result: [unknown[], number] = await queryRunner.query(`
        UPDATE "scoring_criteria" g
        SET "max_score" = s.total
        FROM (
          SELECT "parent_id", ROUND(SUM("max_score")::numeric, 6)::float AS total
          FROM "scoring_criteria"
          WHERE "parent_id" IS NOT NULL
          GROUP BY "parent_id"
        ) s
        WHERE g."id" = s."parent_id"
          AND g."type" = 'group'
          AND ABS(g."max_score" - s.total) > 1e-9
      `);
      if (result[1] === 0) break;
    }
  }

  public async down(): Promise<void> {}
}
