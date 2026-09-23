import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Agrupa "Dance — Difficulty Elements"/"Dance — Execution" (hoje
// filhos diretos de Overall) num subgrupo "Dance" — pedido do usuário
// (2026-09-23), mesmo padrão de RegroupUssNonTumblingByDifficultyExecution.
// Os itens são renomeados pra "Difficulty Elements"/"Execution" (o
// prefixo "Dance — " fica redundante uma vez aninhado). Só
// reorganização/renomeação — nenhum valor de pontuação muda (Overall
// continua 8.0; Dance = 1.0+1.0 = 2.0).
const OLD_DIFFICULTY_NAME = 'Dance — Difficulty Elements';
const OLD_EXECUTION_NAME = 'Dance — Execution';
const NEW_DIFFICULTY_NAME = 'Difficulty Elements';
const NEW_EXECUTION_NAME = 'Execution';

export class GroupUssNonTumblingDanceCriteria1790020000000
  implements MigrationInterface
{
  name = 'GroupUssNonTumblingDanceCriteria1790020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [overall] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Overall' AND parent_id IS NULL`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const overallId: string = overall.id;

    const danceId = randomUUID();
    await queryRunner.query(
      `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order") VALUES ($1, $2, $3, 'group', 'Dance', 2, 2)`,
      [danceId, USS_NON_TUMBLING_COED_TEMPLATE_ID, overallId],
    );

    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "parent_id" = $1, "name" = $2, "order" = 0 WHERE template_id = $3 AND parent_id = $4 AND name = $5`,
      [danceId, NEW_DIFFICULTY_NAME, USS_NON_TUMBLING_COED_TEMPLATE_ID, overallId, OLD_DIFFICULTY_NAME],
    );
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "parent_id" = $1, "name" = $2, "order" = 1 WHERE template_id = $3 AND parent_id = $4 AND name = $5`,
      [danceId, NEW_EXECUTION_NAME, USS_NON_TUMBLING_COED_TEMPLATE_ID, overallId, OLD_EXECUTION_NAME],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [overall] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Overall' AND parent_id IS NULL`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const overallId: string = overall.id;

    const [dance] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Dance' AND parent_id = $2`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, overallId],
    );
    const danceId: string = dance.id;

    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "parent_id" = $1, "name" = $2, "order" = 2 WHERE template_id = $3 AND parent_id = $4 AND name = $5`,
      [overallId, OLD_DIFFICULTY_NAME, USS_NON_TUMBLING_COED_TEMPLATE_ID, danceId, NEW_DIFFICULTY_NAME],
    );
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "parent_id" = $1, "name" = $2, "order" = 3 WHERE template_id = $3 AND parent_id = $4 AND name = $5`,
      [overallId, OLD_EXECUTION_NAME, USS_NON_TUMBLING_COED_TEMPLATE_ID, danceId, NEW_EXECUTION_NAME],
    );

    await queryRunner.query(`DELETE FROM "scoring_criteria" WHERE "id" = $1`, [danceId]);
  }
}
