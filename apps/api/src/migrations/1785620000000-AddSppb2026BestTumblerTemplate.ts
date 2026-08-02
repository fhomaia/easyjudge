import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Quarto modelo de sistema com conteúdo real (2026-08-02), mesma fonte
// (SPPB) — ver project_system_scoring_templates na memória. Categoria
// "Best Tumbler". Mesma estrutura do Best Jumper/Best Basket (grupo
// com 2 itens de avaliação por componente), confirmada de novo pelo
// documento fonte ("10/10 = 20 pontos"). Diferença deste documento:
// cada sequência tem um nome próprio (Standing/Running/Livre), não
// "Primeira/Segunda/Terceira" genérico.
export const SPPB_2026_BEST_TUMBLER_TEMPLATE_ID =
  '7c9d9f5f-5e1f-4eab-a13d-000000000001';
const TEMPLATE_ID = SPPB_2026_BEST_TUMBLER_TEMPLATE_ID;

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
// nas 3 sequências de tumbling.
const DIFICULDADE_SEQUENCIA_BANDS = withRange(
  bands([
    'Passada simples. Elementos muito abaixo do esperado.',
    'Complexidade limitada. Elementos abaixo do esperado.',
    'Boa complexidade. Elementos dentro do esperado.',
    'Complexidade alta. Elementos difíceis e bem escolhidos.',
  ]),
  [0, 1, 4, 7, 10],
);

const EXECUCAO_SEQUENCIA_BANDS = withRange(
  bands([
    'Pouco controle corporal. Passada travada, com quebras claras.',
    'Controle corporal irregular. Fluidez limitada, com pausas perceptíveis.',
    'Bom controle corporal. Boa fluidez na maior parte da passada.',
    'Excelente controle e posição corporal. Passada muito fluida e contínua.',
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
  { name: 'Primeira Sequência de Standing Tumbling', children: SEQUENCE_CHILDREN },
  { name: 'Segunda Sequência de Running Tumbling', children: SEQUENCE_CHILDREN },
  { name: 'Terceira Sequência Livre', children: SEQUENCE_CHILDREN },
  {
    name: 'Geral de Tumbling',
    children: [
      {
        name: 'Dificuldade Geral de Tumbling',
        maxScore: 20,
        bands: withRange(
          bands([
            'Pouca variedade e poucas combinações. Dificuldade geral baixa.',
            'Variedade limitada; combinações simples. Dificuldade geral abaixo do esperado.',
            'Boa variedade; combinações dentro do esperado. Dificuldade geral adequada.',
            'Variedade alta; combinações bem trabalhadas. Dificuldade geral alta e bem distribuída.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
      {
        name: 'Execução Geral de Tumbling',
        maxScore: 20,
        bands: withRange(
          bands([
            'Chegadas instáveis; controle corporal fraco. Pouca amplitude e pouca fluidez geral.',
            'Chegadas irregulares; controle corporal inconsistente. Amplitude e fluidez abaixo do esperado.',
            'Boas chegadas; bom controle corporal na maior parte do tempo. Amplitude e fluidez dentro do esperado.',
            'Chegadas muito sólidas; excelente controle corporal. Ótima amplitude e fluidez geral, acima do esperado.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
    ],
  },
];

export class AddSppb2026BestTumblerTemplate1785620000000
  implements MigrationInterface
{
  name = 'AddSppb2026BestTumblerTemplate1785620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore = GROUPS.reduce(
      (sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0),
      0,
    );

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year") VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [
        TEMPLATE_ID,
        'Best Tumbler',
        'Modelo oficial para a categoria Best Tumbler.',
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
