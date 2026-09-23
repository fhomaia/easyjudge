import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Corrige a nota de execução "Stunt/Pyramid & Standing/Running
// Tumbling" da migration anterior — pedido do usuário (2026-09-23),
// depois de revisar o template publicado: uma nota só (4.0) cobrindo
// Stunt+Pyramid+Standing Tumbling+Running Tumbling dava a entender que
// o MESMO critério e a MESMA quantidade de pontos valia pros 4 juntos
// ("ficou como se fosse um pra todos"). Vira 4 notas de execução
// independentes, cada uma 0-4.0 (mesma escala que o documento usa pras
// outras notas de execução, ex. Toss & Jump = 2.0) — a seção Execution
// passa de 6.0 pra 18.0 (4×4.0 + 2.0) e a meta geral do template de 48
// pra 60. Os "drivers" de cada uma continuam exatamente como o
// documento original lista: Stunt e Pyramid compartilham a MESMA lista
// (o documento só tem uma caixa "STUNT/PYRAMID DRIVERS", não duas
// separadas); Standing Tumbling e Running Tumbling também
// compartilham a mesma lista ("STANDING/RUNNING TUMBLING DRIVERS").
const OLD_NAME = 'Stunt/Pyramid & Standing/Running Tumbling Execution';
const OLD_DESCRIPTION =
  'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Top Person: body control, uniform flexibility, legs straight/locked, toes pointed. Bases/Spotters: stability, solid stance, feet stationary. Transitions: entries, dismounts, control skill to skill. Synchronization: timing (auto .3 off if fewer than 2 groups perform a level appropriate skill transition in Stunts/Pyramids). Standing/Running Tumbling — Approach, Body Control, Landings, Synchronization: timing (auto .3 off if no level appropriate pass is synchronized by 2 or more athletes).';

const STUNT_PYRAMID_DESC =
  'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Top Person: body control, uniform flexibility, legs straight/locked, toes pointed. Bases/Spotters: stability, solid stance, feet stationary. Transitions: entries, dismounts, control skill to skill. Synchronization: timing (auto .3 off if fewer than 2 groups perform a level appropriate skill transition).';

const TUMBLING_DESC =
  'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Approach, Body Control, Landings, Synchronization: timing (auto .3 off if no level appropriate pass is synchronized by 2 or more athletes).';

const NEW_ITEMS: Array<{ name: string; order: number; description: string }> = [
  { name: 'Stunt Execution', order: 0, description: STUNT_PYRAMID_DESC },
  { name: 'Pyramid Execution', order: 1, description: STUNT_PYRAMID_DESC },
  { name: 'Standing Tumbling Execution', order: 2, description: TUMBLING_DESC },
  { name: 'Running Tumbling Execution', order: 3, description: TUMBLING_DESC },
];

export class SplitUssNonTumblingExecutionCriterion1789970000000
  implements MigrationInterface
{
  name = 'SplitUssNonTumblingExecutionCriterion1789970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [group] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const groupId: string = group.id;

    await queryRunner.query(
      `DELETE FROM "scoring_criteria" WHERE template_id = $1 AND parent_id = $2 AND name = $3`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId, OLD_NAME],
    );

    for (const item of NEW_ITEMS) {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [group] = await queryRunner.query(
      `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = 'Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
    const groupId: string = group.id;

    await queryRunner.query(
      `DELETE FROM "scoring_criteria" WHERE template_id = $1 AND parent_id = $2 AND name = ANY($3)`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId, NEW_ITEMS.map((i) => i.name)],
    );

    await queryRunner.query(
      `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "description", "max_score", "order") VALUES ($1, $2, $3, 'score_item', $4, $5, 4.0, 0)`,
      [randomUUID(), USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId, OLD_NAME, OLD_DESCRIPTION],
    );

    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "order" = 1 WHERE template_id = $1 AND parent_id = $2 AND name = 'Toss & Jump Execution'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId],
    );

    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 6 WHERE "id" = $1`, [groupId]);
    await queryRunner.query(`UPDATE "scoring_templates" SET "target_score" = 48 WHERE "id" = $1`, [
      USS_NON_TUMBLING_COED_TEMPLATE_ID,
    ]);
  }
}
