import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Mesma correção de SplitUssNonTumblingExecutionCriterion, agora pra
// "Toss & Jump Execution" — pedido do usuário (2026-09-23): também
// virava um item só (4.0, já que a migration anterior tinha deixado
// esse item herdando a escala 0-4.0, ver comentário de
// RemoveUssNonTumblingTumblingExecution) cobrindo Toss e Jump juntos.
// Vira Toss Execution + Jump Execution, cada uma 0-4.0 (mesma escala
// já usada em Stunt Execution/Pyramid Execution). Seção Execution
// passa de 10.0 pra 16.0 (4×4.0); meta geral do template de 52 pra 58.
// Descrições já direto em português (a migration de tradução já rodou
// antes desta).
const OLD_NAME = 'Toss & Jump Execution';
const OLD_DESCRIPTION_PT =
  'Começa em 2,0; mesma escala de redução .1/.2/.3 de cima, no máximo .3 de desconto por driver. Equipes que realizam apenas 1 toss recebem automaticamente .3 de desconto em qualquer driver que gere redução. Drivers de Toss — Top Person: controle corporal, execução consistente, pernas retas/pontas dos pés esticadas, posicionamento dos braços. Bases/Spotters: timing, postura firme, controlado, cradle. Altura: distância entre os pés do top person e as mãos das bases (desconto limitado a 0,1). Drivers de Jump — Posicionamento dos Braços, Posicionamento das Pernas (pernas retas, pontas dos pés esticadas, altura, aterrissagens), Sincronização: timing (limitado a 0,1).';

const TOSS_EXECUTION_DESC_PT =
  'Começa em 4,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Equipes que realizam apenas 1 toss recebem automaticamente .3 de desconto em qualquer driver que gere redução. Drivers — Top Person: controle corporal, execução consistente, pernas retas/pontas dos pés esticadas, posicionamento dos braços. Bases/Spotters: timing, postura firme, controlado, cradle. Altura: distância entre os pés do top person e as mãos das bases (desconto limitado a 0,1).';

const JUMP_EXECUTION_DESC_PT =
  'Começa em 4,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Drivers — Posicionamento dos Braços, Posicionamento das Pernas (pernas retas, pontas dos pés esticadas, altura, aterrissagens), Sincronização: timing (limitado a 0,1).';

const NEW_ITEMS: Array<{ name: string; order: number; description: string }> = [
  { name: 'Toss Execution', order: 2, description: TOSS_EXECUTION_DESC_PT },
  { name: 'Jump Execution', order: 3, description: JUMP_EXECUTION_DESC_PT },
];

export class SplitUssNonTumblingTossJumpExecution1790000000000
  implements MigrationInterface
{
  name = 'SplitUssNonTumblingTossJumpExecution1790000000000';

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

    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 16 WHERE "id" = $1`, [groupId]);
    await queryRunner.query(`UPDATE "scoring_templates" SET "target_score" = 58 WHERE "id" = $1`, [
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
      `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "description", "max_score", "order") VALUES ($1, $2, $3, 'score_item', $4, $5, 4.0, 2)`,
      [randomUUID(), USS_NON_TUMBLING_COED_TEMPLATE_ID, groupId, OLD_NAME, OLD_DESCRIPTION_PT],
    );

    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 10 WHERE "id" = $1`, [groupId]);
    await queryRunner.query(`UPDATE "scoring_templates" SET "target_score" = 52 WHERE "id" = $1`, [
      USS_NON_TUMBLING_COED_TEMPLATE_ID,
    ]);
  }
}
