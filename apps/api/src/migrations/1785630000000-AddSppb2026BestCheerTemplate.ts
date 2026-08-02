import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Quinto modelo de sistema com conteúdo real (2026-08-02), mesma fonte
// (SPPB) — ver project_system_scoring_templates na memória. Categoria
// "Best Cheer".
//
// Duas lacunas reais no documento original, confirmadas com o usuário
// antes de escrever esta migration: o cabeçalho lista "Dificuldade e
// Execução de Dance (10/10 = 20 pontos)" e "Criatividade (10 pontos)",
// mas o documento só traz rubrica de 4 faixas pra "Dificuldade do
// Dance" — não existe nenhuma tabela "Execução de Dance" nem
// "Criatividade" no texto fonte. Por pedido do usuário, os dois viram
// item de avaliação comum (0 a 10, useScoreBands=false) até o texto
// oficial aparecer — não inventado aqui. Também corrigidos, sem
// precisar perguntar (consistência óbvia com o padrão de toda faixa
// "Insuficiente" de item 0-10 nos outros 4 documentos desta mesma
// fonte): (1) a tabela "Execução de Tumbling" tinha "Insuficiente (0 a
// 10,0)" no documento — tratado como erro de digitação, usado 0 a 1,0
// como nas demais faixas equivalentes; (2) as tabelas "Execução de
// Jumps"/"Execução de Tumbling" apareciam duplicadas no arquivo
// (texto idêntico duas vezes) — usada só uma ocorrência de cada.
export const SPPB_2026_BEST_CHEER_TEMPLATE_ID =
  '8d0e0f6f-6f2f-4fbc-d24e-000000000001';
const TEMPLATE_ID = SPPB_2026_BEST_CHEER_TEMPLATE_ID;

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

interface CriterionSeed {
  name: string;
  maxScore: number;
  bands: Band[] | null;
}

interface GroupSeed {
  name: string;
  children: CriterionSeed[];
}

const DIFICULDADE_JUMPS_BANDS = withRange(
  bands([
    'Amplitude baixa e dificuldade muito abaixo do esperado. Pouca variedade e quase nenhuma conexão.',
    'Amplitude limitada e dificuldade abaixo do esperado. Variedade limitada e conexões simples.',
    'Boa amplitude e dificuldade dentro do esperado. Boa variedade e conexões dentro do esperado.',
    'Excelente amplitude e dificuldade alta. Variedade alta e conexões bem trabalhadas.',
  ]),
  [0, 1, 4, 7, 10],
);

const EXECUCAO_JUMPS_BANDS = withRange(
  bands([
    'Altura baixa e flex pouco demonstrada. Controle corporal fraco e flexibilidade limitada.',
    'Altura limitada e flex irregular. Controle corporal irregular e flexibilidade inconsistente.',
    'Boa altura e flex bem demonstrada. Bom controle corporal e flexibilidade dentro do esperado.',
    'Excelente altura e flex muito bem demonstrada. Excelente controle corporal e flexibilidade muito bem demonstrada.',
  ]),
  [0, 1, 4, 7, 10],
);

const DIFICULDADE_TUMBLING_BANDS = withRange(
  bands([
    'Passadas simples e elementos muito abaixo do esperado. Pouca variedade e poucas combinações; dificuldade geral baixa.',
    'Complexidade limitada e elementos abaixo do esperado. Variedade limitada e combinações simples; dificuldade geral abaixo do esperado.',
    'Boa complexidade e elementos dentro do esperado. Boa variedade e combinações dentro do esperado; dificuldade geral adequada.',
    'Complexidade alta e elementos difíceis e bem escolhidos. Variedade alta e combinações bem trabalhadas; dificuldade geral alta e bem distribuída.',
  ]),
  [0, 1, 4, 7, 10],
);

const EXECUCAO_TUMBLING_BANDS = withRange(
  bands([
    'Pouco controle corporal; passadas travadas, com quebras claras. Chegadas instáveis; pouca amplitude e pouca fluidez geral.',
    'Controle corporal irregular; fluidez limitada, com pausas perceptíveis. Chegadas irregulares; amplitude e fluidez abaixo do esperado.',
    'Bom controle corporal; boa fluidez na maior parte das passadas. Boas chegadas; amplitude e fluidez dentro do esperado.',
    'Excelente controle e posição corporal; passadas muito fluidas e contínuas. Chegadas muito sólidas; ótima amplitude e fluidez geral, acima do esperado.',
  ]),
  [0, 1, 4, 7, 10],
);

const DIFICULDADE_DANCE_BANDS = withRange(
  bands([
    'Complexidade baixa e ritmo fraco. Pouco uso de níveis e foco; trabalho de pés e chão muito limitado.',
    'Complexidade limitada e ritmo abaixo do esperado. Uso simples de níveis e foco; pouco trabalho de pés e chão.',
    'Boa complexidade e ritmo dentro do esperado. Bom uso de níveis e foco; trabalho de pés e chão dentro do esperado.',
    'Complexidade alta e ritmo muito bem trabalhado. Uso forte de níveis e foco; ótimo trabalho de pés e chão, acima do esperado.',
  ]),
  [0, 1, 4, 7, 10],
);

const USO_TABLADO_BANDS = withRange(
  bands([
    'Fica quase o tempo todo no mesmo quadrante. Pouco deslocamento e pouca ocupação do tablado.',
    'Sai do quadrante em poucos momentos. Deslocamentos curtos e previsíveis, com uso limitado do espaço.',
    'Usa mais de um quadrante de forma clara. Boa distribuição e deslocamentos dentro do esperado.',
    'Usa o tablado de forma ampla e estratégica. Mudanças de quadrante frequentes e bem conectadas, com ótima ocupação do espaço.',
  ]),
  [0, 1, 4, 7, 10],
);

const PERFORMANCE_BANDS = withRange(
  bands([
    'Energia baixa e pouca intenção de entretenimento. Erros variados e pouca confiança na execução do que foi proposto.',
    'Energia moderada, porém irregular; entretenimento limitado. Perfeição e confiança inconsistentes, com erros claros durante a apresentação.',
    'Boa energia e bom entretenimento na maior parte do tempo. Boa perfeição e confiança dentro do esperado, com pequenos erros.',
    'Energia alta e constante; apresentação muito envolvente. Excelente perfeição e confiança, com domínio do que foi proposto do início ao fim.',
  ]),
  [0, 10, 13.5, 17, 20],
);

const GROUPS: GroupSeed[] = [
  {
    name: 'Jumps',
    children: [
      { name: 'Dificuldade', maxScore: 10, bands: DIFICULDADE_JUMPS_BANDS },
      { name: 'Execução', maxScore: 10, bands: EXECUCAO_JUMPS_BANDS },
    ],
  },
  {
    name: 'Tumbling',
    children: [
      { name: 'Dificuldade', maxScore: 10, bands: DIFICULDADE_TUMBLING_BANDS },
      { name: 'Execução', maxScore: 10, bands: EXECUCAO_TUMBLING_BANDS },
    ],
  },
  {
    name: 'Dance',
    children: [
      { name: 'Dificuldade', maxScore: 10, bands: DIFICULDADE_DANCE_BANDS },
      // Sem rubrica no documento original — nota livre, ver comentário
      // no topo do arquivo.
      { name: 'Execução', maxScore: 10, bands: null },
    ],
  },
];

// Itens de topo sem grupo (não são "X e Y", são um item único cada).
const STANDALONE: CriterionSeed[] = [
  { name: 'Uso de Tablado', maxScore: 10, bands: USO_TABLADO_BANDS },
  // Sem rubrica no documento original — nota livre, ver comentário no
  // topo do arquivo.
  { name: 'Criatividade', maxScore: 10, bands: null },
  { name: 'Performance', maxScore: 20, bands: PERFORMANCE_BANDS },
];

export class AddSppb2026BestCheerTemplate1785630000000
  implements MigrationInterface
{
  name = 'AddSppb2026BestCheerTemplate1785630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore =
      GROUPS.reduce((sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0), 0) +
      STANDALONE.reduce((s, c) => s + c.maxScore, 0);

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year") VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [
        TEMPLATE_ID,
        'Best Cheer',
        'Modelo oficial para a categoria Best Cheer.',
        targetScore,
        SYSTEM_SCORING_TEMPLATES_OWNER_ID,
        'Sistema de Produtores Privados Brasileiros (SPPB)',
        2026,
      ],
    );

    let order = 0;

    for (const group of GROUPS) {
      const groupId = randomUUID();
      const groupMaxScore = group.children.reduce((s, c) => s + c.maxScore, 0);
      await queryRunner.query(
        `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order") VALUES ($1, $2, NULL, 'group', $3, $4, $5)`,
        [groupId, TEMPLATE_ID, group.name, groupMaxScore, order++],
      );

      for (const [childOrder, child] of group.children.entries()) {
        await this.insertScoreItem(queryRunner, groupId, childOrder, child);
      }
    }

    for (const item of STANDALONE) {
      await this.insertScoreItem(queryRunner, null, order++, item);
    }
  }

  private async insertScoreItem(
    queryRunner: QueryRunner,
    parentId: string | null,
    order: number,
    item: CriterionSeed,
  ): Promise<void> {
    if (item.bands) {
      await queryRunner.query(
        `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order", "use_score_bands", "score_bands") VALUES ($1, $2, $3, 'score_item', $4, $5, $6, true, $7::jsonb)`,
        [randomUUID(), TEMPLATE_ID, parentId, item.name, item.maxScore, order, JSON.stringify(item.bands)],
      );
    } else {
      await queryRunner.query(
        `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "max_score", "order") VALUES ($1, $2, $3, 'score_item', $4, $5, $6)`,
        [randomUUID(), TEMPLATE_ID, parentId, item.name, item.maxScore, order],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "scoring_templates" WHERE "id" = $1`, [
      TEMPLATE_ID,
    ]);
  }
}
