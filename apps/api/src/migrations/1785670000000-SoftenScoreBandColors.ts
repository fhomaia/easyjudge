import { MigrationInterface, QueryRunner } from 'typeorm';

// Faixa de pontuação usa a cor como cor de TEXTO (nome da faixa) e
// preenchimento do trilho/polegar do slider da súmula do jurado — fica
// na tela o tempo todo durante o julgamento, então a paleta antiga
// (mesma família "500" de VIBRANT_COLORS) ficava cansativa de olhar
// (pedido do usuário, 2026-08-02). Troca 1:1 pela versão mais clara
// ("400") da mesma família de matiz — ver PASTEL_BAND_COLORS em
// apps/web/src/lib/avatarColor.ts, usada pelo builder (ScoreBandsEditor)
// daqui pra frente. Só troca o valor exato da cor (não toca em
// nome/min/max/descrição), então não afeta nenhuma cor que um usuário
// já tenha escolhido manualmente fora dessa lista específica.
const COLOR_MAP: Record<string, string> = {
  '#ef4444': '#f87171', // red-500 -> red-400
  '#f97316': '#fb923c', // orange-500 -> orange-400
  '#f59e0b': '#fbbf24', // amber-500 -> amber-400
  '#3b82f6': '#60a5fa', // blue-500 -> blue-400
  '#22c55e': '#4ade80', // green-500 -> green-400
};

interface Band {
  name: string;
  description: string | null;
  color: string;
  min: number;
  max: number;
}

export class SoftenScoreBandColors1785670000000
  implements MigrationInterface
{
  name = 'SoftenScoreBandColors1785670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; score_bands: Band[] }[] = await queryRunner.query(
      `SELECT id, score_bands FROM "scoring_criteria" WHERE score_bands IS NOT NULL`,
    );

    for (const row of rows) {
      let changed = false;
      const next = row.score_bands.map((band) => {
        const mapped = COLOR_MAP[band.color];
        if (!mapped) return band;
        changed = true;
        return { ...band, color: mapped };
      });
      if (!changed) continue;
      await queryRunner.query(
        `UPDATE "scoring_criteria" SET "score_bands" = $1::jsonb WHERE id = $2`,
        [JSON.stringify(next), row.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const reverseMap: Record<string, string> = Object.fromEntries(
      Object.entries(COLOR_MAP).map(([oldColor, newColor]) => [newColor, oldColor]),
    );
    const rows: { id: string; score_bands: Band[] }[] = await queryRunner.query(
      `SELECT id, score_bands FROM "scoring_criteria" WHERE score_bands IS NOT NULL`,
    );
    for (const row of rows) {
      let changed = false;
      const next = row.score_bands.map((band) => {
        const mapped = reverseMap[band.color];
        if (!mapped) return band;
        changed = true;
        return { ...band, color: mapped };
      });
      if (!changed) continue;
      await queryRunner.query(
        `UPDATE "scoring_criteria" SET "score_bands" = $1::jsonb WHERE id = $2`,
        [JSON.stringify(next), row.id],
      );
    }
  }
}
