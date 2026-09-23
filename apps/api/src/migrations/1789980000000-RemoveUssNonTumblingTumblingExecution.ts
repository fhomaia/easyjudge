import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Remove "Standing Tumbling Execution"/"Running Tumbling Execution" do
// template USS Non-Tumbling — pedido do usuário (2026-09-23), depois
// de perceber que essa divisão é justamente NON-TUMBLING (a página de
// Execution do PDF de origem é reaproveitada em vários documentos da
// USS, incluindo divisões que têm tumbling — não deveria ter sido
// incluída aqui, ver comentário da migration anterior). Fica só Stunt
// Execution + Pyramid Execution (0-4.0 cada) na seção Execution, que
// volta a valer 10.0 (4.0+4.0+2.0 do Toss & Jump) — meta geral do
// template cai de 60 pra 52.
const TUMBLING_ITEMS: Array<{ name: string; order: number; description: string }> = [
  {
    name: 'Standing Tumbling Execution',
    order: 2,
    description:
      'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Approach, Body Control, Landings, Synchronization: timing (auto .3 off if no level appropriate pass is synchronized by 2 or more athletes).',
  },
  {
    name: 'Running Tumbling Execution',
    order: 3,
    description:
      'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Approach, Body Control, Landings, Synchronization: timing (auto .3 off if no level appropriate pass is synchronized by 2 or more athletes).',
  },
];

export class RemoveUssNonTumblingTumblingExecution1789980000000
  implements MigrationInterface
{
  name = 'RemoveUssNonTumblingTumblingExecution1789980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [group] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const groupId: string = group.id;

    await queryRunner.query(
      `DELETE FROM "scoring_criteria" WHERE template_id = $1 AND parent_id = $2 AND name = ANY($3)`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId, TUMBLING_ITEMS.map((i) => i.name)],
    );

    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "order" = 2 WHERE template_id = $1 AND parent_id = $2 AND name = 'Toss & Jump Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId],
    );

    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 10 WHERE "id" = $1`, [groupId]);
    await queryRunner.query(`UPDATE "scoring_templates" SET "target_score" = 52 WHERE "id" = $1`, [
      USS_NON_TUMBLING_COED_TEMPLATE_ID,
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [group] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const groupId: string = group.id;

    for (const item of TUMBLING_ITEMS) {
      await queryRunner.query(
        `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "description", "max_score", "order") VALUES ($1, $2, $3, 'score_item', $4, $5, 4.0, $6)`,
        [randomUUID(), USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId, item.name, item.description, item.order],
      );
    }

    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "order" = 4 WHERE template_id = $1 AND parent_id = $2 AND name = 'Toss & Jump Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId],
    );

    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 18 WHERE "id" = $1`, [groupId]);
    await queryRunner.query(`UPDATE "scoring_templates" SET "target_score" = 60 WHERE "id" = $1`, [
      USS_NON_TUMBLING_COED_TEMPLATE_ID,
    ]);
  }
}
