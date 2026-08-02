import { MigrationInterface, QueryRunner } from 'typeorm';
import { IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID } from './1785640000000-AddIasf2526TeamCheerAllGirlTemplate';
import { IASF_2526_TEAM_CHEER_COED_TEMPLATE_ID } from './1785650000000-AddIasf2526TeamCheerCoedTemplate';

// Correção: os critérios de "Difficulty" dos templates IASF Team Cheer
// (All Girl/Coed) foram criados com todas as faixas na mesma cor cinza
// fixa (#94a3b8) — o helper `band()` das duas migrations originais
// nunca variava a cor por posição, diferente do helper `tierBands()`
// (usado nos critérios de Technique/Creativity/Formations/Performance,
// que já tinham a progressão vermelho->verde). Pedido do usuário
// depois de notar isso na tela. Como as duas migrations originais já
// foram executadas (local e, possivelmente, produção), a correção é
// via UPDATE aqui, não editando o arquivo antigo — mesmo padrão já
// usado antes (ver AddYearToScoringTemplates pra um template já
// criado). IDs de critério não são conhecidos (gerados via
// randomUUID() em tempo de execução), então a correção localiza as
// linhas por template_id + name.
const PALETTES: Record<number, string[]> = {
  2: ['#ef4444', '#22c55e'],
  3: ['#ef4444', '#f97316', '#22c55e'],
};

const DIFFICULTY_CRITERION_NAMES = [
  'Stunt Difficulty (All Girl)',
  'Stunt Difficulty (Coed)',
  'Pyramid Difficulty',
  'Toss Difficulty (L2-L7)',
  'Standing Tumbling Difficulty',
  'Running Tumbling Difficulty',
  'Jump Difficulty',
];

interface Band {
  name: string;
  description: string | null;
  color: string;
  min: number;
  max: number;
}

export class FixIasfDifficultyBandColors1785660000000
  implements MigrationInterface
{
  name = 'FixIasfDifficultyBandColors1785660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; score_bands: Band[] }[] = await queryRunner.query(
      `SELECT id, score_bands FROM "scoring_criteria" WHERE template_id = ANY($1) AND name = ANY($2)`,
      [
        [IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID, IASF_2526_TEAM_CHEER_COED_TEMPLATE_ID],
        DIFFICULTY_CRITERION_NAMES,
      ],
    );

    for (const row of rows) {
      const palette = PALETTES[row.score_bands.length];
      if (!palette) continue;
      const fixed = row.score_bands.map((band, i) => ({ ...band, color: palette[i] }));
      await queryRunner.query(
        `UPDATE "scoring_criteria" SET "score_bands" = $1::jsonb WHERE id = $2`,
        [JSON.stringify(fixed), row.id],
      );
    }
  }

  public async down(): Promise<void> {
    // Correção de cor não tem reversão significativa (voltar pro
    // cinza uniforme não seria útil) — down() intencionalmente vazio,
    // mesmo padrão de outras migrations de dado que não modelam um
    // "estado anterior" que valha a pena restaurar.
  }
}
