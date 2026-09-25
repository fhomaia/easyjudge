import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Renomeia o item "Difficulty Elements" do subgrupo Dance (Overall ->
// Dance) pra só "Difficulty" — nome usado na súmula da USS (pedido do
// usuário, 2026-09-25). Só texto: o id do item continua o mesmo, então
// escala de jurados e notas já lançadas não mudam.
const OLD_NAME = 'Difficulty Elements';
const NEW_NAME = 'Difficulty';

async function findDanceId(queryRunner: QueryRunner): Promise<string> {
  const rows = (await queryRunner.query(
    `SELECT d.id FROM "scoring_criteria" d
       JOIN "scoring_criteria" o ON o.id = d.parent_id
      WHERE d.template_id = $1 AND d.type = 'group' AND d.name = 'Dance'
        AND o.type = 'group' AND o.name = 'Overall' AND o.parent_id IS NULL`,
    [USS_NON_TUMBLING_COED_TEMPLATE_ID],
  )) as { id: string }[];
  return rows[0].id;
}

export class RenameUssDanceDifficultyElements1790100000000 implements MigrationInterface {
  name = 'RenameUssDanceDifficultyElements1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const danceId = await findDanceId(queryRunner);
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "name" = $1 WHERE template_id = $2 AND parent_id = $3 AND name = $4`,
      [NEW_NAME, USS_NON_TUMBLING_COED_TEMPLATE_ID, danceId, OLD_NAME],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const danceId = await findDanceId(queryRunner);
    await queryRunner.query(
      `UPDATE "scoring_criteria" SET "name" = $1 WHERE template_id = $2 AND parent_id = $3 AND name = $4`,
      [OLD_NAME, USS_NON_TUMBLING_COED_TEMPLATE_ID, danceId, NEW_NAME],
    );
  }
}
