import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Terceiro modelo de sistema com conteúdo real (2026-08-02), mesma
// fonte (SPPB) — ver project_system_scoring_templates na memória.
// Categoria "Best Basket". Mesma estrutura do Best Jumper (grupo com 2
// itens de avaliação por componente, não multiplicador via `weight` —
// que nem existe mais no schema, removido no mesmo dia por não ser
// usado em nenhum cálculo real), desta vez confirmada pelo próprio
// documento fonte, que já escreve "(10/10 = 20 pontos)" explicitamente
// em vez de "peso 2".
export const SPPB_2026_BEST_BASKET_TEMPLATE_ID =
  '6b8c8f4f-4d0f-4d9c-b02c-000000000001';
const TEMPLATE_ID = SPPB_2026_BEST_BASKET_TEMPLATE_ID;

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
// nos 3 baskets — texto idêntico ao Best Jumper (mesmo documento fonte
// reaproveita a mesma rubrica de dificuldade/execução por sequência
// independente da categoria).
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

const BASKET_CHILDREN: CriterionSeed[] = [
  { name: 'Dificuldade', maxScore: 10, bands: DIFICULDADE_SEQUENCIA_BANDS },
  { name: 'Execução', maxScore: 10, bands: EXECUCAO_SEQUENCIA_BANDS },
];

const GROUPS: GroupSeed[] = [
  { name: 'Primeiro Basket', children: BASKET_CHILDREN },
  { name: 'Segundo Basket', children: BASKET_CHILDREN },
  { name: 'Terceiro Basket', children: BASKET_CHILDREN },
  {
    name: 'Geral de Baskets',
    children: [
      {
        name: 'Dificuldade Geral de Baskets',
        maxScore: 20,
        // Texto idêntico ao usado em "Dificuldade Geral de Jumps" do
        // documento original (fala de "jumps" mesmo na seção de
        // Baskets) — transcrito como está na fonte, não corrigido.
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
        name: 'Execução Geral de Baskets',
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

export class AddSppb2026BestBasketTemplate1785610000000
  implements MigrationInterface
{
  name = 'AddSppb2026BestBasketTemplate1785610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore = GROUPS.reduce(
      (sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0),
      0,
    );

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year") VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [
        TEMPLATE_ID,
        'Best Basket',
        'Modelo oficial para a categoria Best Basket.',
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
