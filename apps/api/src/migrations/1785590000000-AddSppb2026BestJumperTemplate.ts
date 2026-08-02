import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Segundo modelo de sistema com conteúdo real (2026-08-02), mesma
// fonte do primeiro (SPPB) — ver project_system_scoring_templates na
// memória. Categoria "Best Jumper".
//
// O documento original descreve os 4 componentes de topo como "(X
// pontos - peso 2)" — não modelado como um multiplicador (`weight` do
// ScoringCriterion existe no schema mas não é usado em NENHUM cálculo
// de nota real, ver ScoringService — só decorativo hoje), e sim como
// grupo com 2 itens de avaliação (Dificuldade + Execução), cada um já
// com sua própria rubrica completa de 4 faixas no documento original
// (0 a 10 por sequência, 0 a 20 no geral) — é a única leitura que não
// exige inventar novos limites de faixa: 10+10 por sequência e 20+20
// no geral já somam exatamente o "peso 2" citado, e chegam nos 100
// pontos totais declarados no cabeçalho do documento sem precisar do
// campo `weight`.
export const SPPB_2026_BEST_JUMPER_TEMPLATE_ID =
  '5a7b7f3f-3c9f-4c8b-af1b-000000000001';
const TEMPLATE_ID = SPPB_2026_BEST_JUMPER_TEMPLATE_ID;

interface Band {
  name: string;
  description: string;
  color: string;
  min: number;
  max: number;
}

function bands(texts: [string, string, string, string]): Band[] {
  return [
    { name: 'Insuficiente', description: texts[0], color: '#ef4444', min: 0, max: 0 },
    { name: 'Abaixo do Esperado', description: texts[1], color: '#f97316', min: 0, max: 0 },
    { name: 'Bom/Muito Bom', description: texts[2], color: '#3b82f6', min: 0, max: 0 },
    { name: 'Excelente', description: texts[3], color: '#22c55e', min: 0, max: 0 },
  ];
}

function withRange(list: Band[], edges: [number, number, number, number, number]): Band[] {
  return list.map((band, i) => ({ ...band, min: edges[i], max: edges[i + 1] }));
}

// Mesma rubrica ("de Cada Sequência" no documento original) reusada
// nas 3 sequências — texto idêntico nas 3, só o nome do critério muda.
const DIFICULDADE_SEQUENCIA_BANDS = withRange(
  bands([
    'Amplitude baixa. Dificuldade muito abaixo do esperado.',
    'Amplitude limitada. Dificuldade abaixo do esperado.',
    'Boa amplitude. Dificuldade dentro do esperado.',
    'Excelente amplitude. Dificuldade alta.',
  ]),
  [0, 1, 4, 7, 10],
);

const EXECUCAO_SEQUENCIA_BANDS = withRange(
  bands([
    'Altura baixa. Flex pouco demonstrada.',
    'Altura limitada. Flex irregular.',
    'Boa altura. Flex bem demonstrada.',
    'Excelente altura. Flex muito bem demonstrada.',
  ]),
  [0, 1, 4, 7, 10],
);

interface CriterionSeed {
  name: string;
  maxScore: number;
  bands: Band[];
}

interface GroupSeed {
  name: string;
  children: CriterionSeed[];
}

const SEQUENCE_CHILDREN: CriterionSeed[] = [
  { name: 'Dificuldade', maxScore: 10, bands: DIFICULDADE_SEQUENCIA_BANDS },
  { name: 'Execução', maxScore: 10, bands: EXECUCAO_SEQUENCIA_BANDS },
];

const GROUPS: GroupSeed[] = [
  { name: 'Primeira Sequência', children: SEQUENCE_CHILDREN },
  { name: 'Segunda Sequência', children: SEQUENCE_CHILDREN },
  { name: 'Terceira Sequência', children: SEQUENCE_CHILDREN },
  {
    name: 'Geral de Jumps',
    children: [
      {
        name: 'Dificuldade Geral de Jumps',
        maxScore: 20,
        bands: withRange(
          bands([
            'Pouca variedade de jumps. Quase nenhuma conexão; sequência repetitiva e previsível.',
            'Variedade limitada. Conexões simples.',
            'Boa variedade. Conexões dentro do esperado.',
            'Variedade alta. Conexões bem trabalhadas.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
      {
        name: 'Execução Geral de Jumps',
        maxScore: 20,
        bands: withRange(
          bands([
            'Controle corporal fraco. Flexibilidade limitada.',
            'Controle corporal irregular. Flexibilidade inconsistente.',
            'Bom controle corporal. Flexibilidade dentro do esperado.',
            'Excelente controle corporal. Flexibilidade muito bem demonstrada.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
    ],
  },
];

export class AddSppb2026BestJumperTemplate1785590000000
  implements MigrationInterface
{
  name = 'AddSppb2026BestJumperTemplate1785590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore = GROUPS.reduce(
      (sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0),
      0,
    );

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year") VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [
        TEMPLATE_ID,
        'Best Jumper',
        'Modelo oficial para a categoria Best Jumper.',
        targetScore,
        SYSTEM_SCORING_TEMPLATES_OWNER_ID,
        'Sistema de Produtores Privados Brasileiros (SPPB)',
        2026,
      ],
    );

    for (const [groupOrder, group] of GROUPS.entries()) {
      const groupId = randomUUID();
      const groupMaxScore = group.children.reduce((s, c) => s + c.maxScore, 0);
      await queryRunner.query(
        `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order") VALUES ($1, $2, NULL, 'group', $3, $4, $5)`,
        [groupId, TEMPLATE_ID, group.name, groupMaxScore, groupOrder],
      );

      for (const [childOrder, child] of group.children.entries()) {
        await queryRunner.query(
          `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order", "use_score_bands", "score_bands") VALUES ($1, $2, $3, 'score_item', $4, $5, $6, true, $7::jsonb)`,
          [
            randomUUID(),
            TEMPLATE_ID,
            groupId,
            child.name,
            child.maxScore,
            childOrder,
            JSON.stringify(child.bands),
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "scoring_templates" WHERE "id" = $1`, [
      TEMPLATE_ID,
    ]);
  }
}
