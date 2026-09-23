import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Reorganiza a árvore do template USS Non-Tumbling — pedido do usuário
// (2026-09-23): Building e Jump ganham 2 subgrupos cada, "Difficulty"
// e "Execution", com os critérios correspondentes movidos pra dentro.
// O grupo raiz "Execution" (que tinha Stunt/Pyramid/Toss/Jump
// Execution soltos) deixa de existir — Stunt/Pyramid/Toss Execution
// viram filhos de Building > Execution, Jump Execution vira filho de
// Jump > Execution. Só reorganização de árvore, nenhum valor de
// pontuação muda (Building: 32+12=44; Jump: 2+4=6; meta geral do
// template continua 58). Ids buscados por nome (gerados via
// randomUUID nas migrations anteriores, não são fixos).
export class RegroupUssNonTumblingByDifficultyExecution1790010000000
  implements MigrationInterface
{
  name = 'RegroupUssNonTumblingByDifficultyExecution1790010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const buildingId = await this.findGroupId(queryRunner, 'Building', null);
    const jumpId = await this.findGroupId(queryRunner, 'Jump', null);
    const executionId = await this.findGroupId(queryRunner, 'Execution', null);

    const buildingDifficultyId = randomUUID();
    const buildingExecutionId = randomUUID();
    const jumpDifficultyId = randomUUID();
    const jumpExecutionId = randomUUID();

    await this.insertGroup(queryRunner, buildingDifficultyId, buildingId, 'Difficulty', 32, 0);
    await this.insertGroup(queryRunner, buildingExecutionId, buildingId, 'Execution', 12, 1);
    await this.insertGroup(queryRunner, jumpDifficultyId, jumpId, 'Difficulty', 2, 0);
    await this.insertGroup(queryRunner, jumpExecutionId, jumpId, 'Execution', 4, 1);

    // Difficulty (Building): mantém a própria ordem relativa de antes.
    await this.reparent(queryRunner, buildingId, buildingDifficultyId, [
      'Stunt Difficulty',
      'Stunt Degree of Difficulty',
      'Stunt Max Participation',
      'Pyramid Difficulty',
      'Toss Difficulty',
    ]);
    // Execution (Building): só os 3 relativos a stunt/pirâmide/toss.
    await this.reparent(queryRunner, executionId, buildingExecutionId, [
      'Stunt Execution',
      'Pyramid Execution',
      'Toss Execution',
    ]);
    await this.reparent(queryRunner, jumpId, jumpDifficultyId, ['Jump Difficulty']);
    await this.reparent(queryRunner, executionId, jumpExecutionId, ['Jump Execution']);

    // Grupo raiz "Execution" fica vazio — remove, e ajusta max_score/
    // order dos 2 grupos raiz que restaram.
    await queryRunner.query(`DELETE FROM "scoring_criteria" WHERE "id" = $1`, [executionId]);
    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 44 WHERE "id" = $1`, [buildingId]);
    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 6 WHERE "id" = $1`, [jumpId]);
    await queryRunner.query(`UPDATE "scoring_criteria" SET "order" = 1 WHERE "id" = $1`, [jumpId]);
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "order" = 2 WHERE template_id = $1 AND parent_id IS NULL AND name = 'Overall'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const buildingId = await this.findGroupId(queryRunner, 'Building', null);
    const jumpId = await this.findGroupId(queryRunner, 'Jump', null);
    const buildingDifficultyId = await this.findGroupId(queryRunner, 'Difficulty', buildingId);
    const buildingExecutionId = await this.findGroupId(queryRunner, 'Execution', buildingId);
    const jumpDifficultyId = await this.findGroupId(queryRunner, 'Difficulty', jumpId);
    const jumpExecutionId = await this.findGroupId(queryRunner, 'Execution', jumpId);

    const executionId = randomUUID();
    await this.insertGroup(queryRunner, executionId, null, 'Execution', 16, 2);

    await this.reparent(queryRunner, buildingDifficultyId, buildingId, [
      'Stunt Difficulty',
      'Stunt Degree of Difficulty',
      'Stunt Max Participation',
      'Pyramid Difficulty',
      'Toss Difficulty',
    ]);
    await this.reparent(queryRunner, buildingExecutionId, executionId, [
      'Stunt Execution',
      'Pyramid Execution',
      'Toss Execution',
    ]);
    await this.reparent(queryRunner, jumpDifficultyId, jumpId, ['Jump Difficulty']);
    await this.reparent(queryRunner, jumpExecutionId, executionId, ['Jump Execution']);

    await queryRunner.query(`DELETE FROM "scoring_criteria" WHERE "id" = ANY($1)`, [
      [buildingDifficultyId, buildingExecutionId, jumpDifficultyId, jumpExecutionId],
    ]);
    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 32 WHERE "id" = $1`, [buildingId]);
    await queryRunner.query(`UPDATE "scoring_criteria" SET "max_score" = 2, "order" = 1 WHERE "id" = $1`, [
      jumpId,
    ]);
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "order" = 3 WHERE template_id = $1 AND parent_id IS NULL AND name = 'Overall'`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID],
    );
  }

  private async findGroupId(
    queryRunner: QueryRunner,
    name: string,
    parentId: string | null,
  ): Promise<string> {
    const rows: Array<{ id: string }> = await queryRunner.query(
      parentId === null
        ? `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = $2 AND parent_id IS NULL`
        : `SELECT id FROM "scoring_criteria" WHERE template_id = $1 AND type = 'group' AND name = $2 AND parent_id = $3`,
      parentId === null
        ? [USS_NON_TUMBLING_COED_TEMPLATE_ID, name]
        : [USS_NON_TUMBLING_COED_TEMPLATE_ID, name, parentId],
    );
    if (rows.length === 0) throw new Error(`Group not found: ${name} (parent=${parentId})`);
    return rows[0].id;
  }

  private async insertGroup(
    queryRunner: QueryRunner,
    id: string,
    parentId: string | null,
    name: string,
    maxScore: number,
    order: number,
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order") VALUES ($1, $2, $3, 'group', $4, $5, $6)`,
      [id, USS_NON_TUMBLING_COED_TEMPLATE_ID, parentId, name, maxScore, order],
    );
  }

  private async reparent(
    queryRunner: QueryRunner,
    oldParentId: string,
    newParentId: string,
    names: string[],
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "parent_id" = $1 WHERE template_id = $2 AND parent_id = $3 AND name = ANY($4)`,
      [newParentId, USS_NON_TUMBLING_COED_TEMPLATE_ID, oldParentId, names],
    );
  }
}
