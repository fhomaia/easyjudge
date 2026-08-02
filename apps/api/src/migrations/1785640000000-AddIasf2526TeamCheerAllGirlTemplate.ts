import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Sexto modelo de sistema com conteúdo real (2026-08-02), nova fonte
// (IASF, não SPPB) — ver project_system_scoring_templates na memória.
// Categoria "Team Cheer", divisão All Girl (ver arquivo irmão desta
// migration pra Coed — só o critério "Stunt Difficulty" difere entre
// as duas divisões, todo o resto é idêntico). Fonte:
// IASF_Scoring_2526_L1-L7.pdf ("INTERNATIONAL L1-L7 DIVISIONS",
// temporada 2025-2026).
//
// Decisões tomadas com o usuário antes de escrever esta migration:
// conteúdo mantido em inglês (não traduzido, fiel ao documento
// original); os 16 itens de pontuação agrupados por tema (Stunt/
// Pyramid/Toss/Tumbling/Jump/Dance + 3 itens soltos), não uma árvore
// plana. Tabelas de "Team Majority" (Stunt/Toss/Tumbling & Jump)
// deliberadamente OMITIDAS a pedido do usuário (são referência de
// contagem de atletas, não critério de nota).
//
// Ajustes de transcrição feitos sem precisar perguntar (mecânicos, não
// editoriais): toda tabela do documento tem uma linha "0 = No skills
// performed" separada da primeira faixa numérica (ex. "1-8") — como o
// validador do app exige que a primeira faixa comece exatamente em 0
// (ScoringCriteriaService.assertBandsCoverMaxScore), a linha "0" foi
// incorporada à faixa mais baixa (min passa a ser 0, não 1/2/4),
// mesmo nas caixas de Technique/Creativity/Formations/Performance que
// não repetem a nota "a zero is issued..." em toda caixa (mas repetem
// na maioria — extensão consistente com o padrão do próprio
// documento). Caixas de "Considerations" (bullet list, comparação
// entre equipes) e notas de rodapé (ex. "Advanced Jumps: Herkie...")
// foram anexadas à `description` do critério correspondente, não
// modeladas como faixa própria. Nomes de faixa sem rótulo qualitativo
// no documento (as tabelas de Difficulty, diferente das de Technique)
// ganharam um nome curto derivado do próprio texto da faixa (não é
// conteúdo novo, só um rótulo pro dropdown/slider).
export const IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID =
  '9e1f1f7f-7003-4f1d-a35f-000000000001';
const TEMPLATE_ID = IASF_2526_TEAM_CHEER_ALL_GIRL_TEMPLATE_ID;

interface Band {
  name: string;
  description: string | null;
  color: string;
  min: number;
  max: number;
}

function band(name: string, min: number, max: number, description: string | null = null): Band {
  return { name, description, color: '#94a3b8', min, max };
}

// Cores fixas pras 3 faixas "Below/Average/Above Average" (mesmo
// padrão de progressão ruim->boa usado nos modelos SPPB).
function tierBands(edges: [number, number, number, number]): Band[] {
  return [
    { name: 'Below Average', description: null, color: '#ef4444', min: edges[0], max: edges[1] },
    { name: 'Average', description: null, color: '#f59e0b', min: edges[1], max: edges[2] },
    { name: 'Above Average', description: null, color: '#22c55e', min: edges[2], max: edges[3] },
  ];
}

interface CriterionSeed {
  name: string;
  maxScore: number;
  description: string | null;
  bands: Band[];
}

interface GroupSeed {
  name: string;
  children: CriterionSeed[];
}

const STUNT_TECHNIQUE_DESC =
  'Execution • Stability • Flexibility • Uniformity • Sync. A zero is issued when no skills are performed.';
const STUNT_TECHNIQUE_BANDS: Band[] = tierBands([0, 8, 18, 20]);

const GROUPS: GroupSeed[] = [
  {
    name: 'Stunt',
    children: [
      {
        name: 'Stunt Difficulty (All Girl)',
        maxScore: 20,
        description:
          'Cumulative throughout the routine. Considered when COMPARING teams: degree of difficulty of skills; percentage of team participation; minimal use of bases; variety of load-ins, dismounts, and transitions; pace, additional skills, and combination of skills (non-level appropriate included) may increase your score within range.',
        bands: [
          band(
            'No Skills / Below Majority',
            0,
            8,
            'No skills performed. Less than a Majority of the team performs a level appropriate skill.',
          ),
          band(
            'Majority Level-Appropriate',
            8,
            20,
            'A Majority of the team performs a level appropriate skill.',
          ),
        ],
      },
      {
        name: 'Stunt Technique',
        maxScore: 20,
        description: STUNT_TECHNIQUE_DESC,
        bands: STUNT_TECHNIQUE_BANDS,
      },
    ],
  },
  {
    name: 'Pyramid',
    children: [
      {
        name: 'Pyramid Difficulty',
        maxScore: 20,
        description:
          "Cumulative throughout the routine. Consecutive transitions within a pyramid will not meet the minimum requirement of hitting a structure. Structures must meet the definition of a \"pyramid\" in the IASF rules/glossary. Considered when COMPARING teams: degree of difficulty of skills; percentage of team participation; minimal use of bases; variety of load-ins, dismounts, and transitions; pace, additional skills, and combination of skills (non-level appropriate included) may increase your score within range.",
        bands: [
          band(
            'Below Minimum Structures',
            0,
            12,
            'No skills performed. No level appropriate skills and/or less than two structures.',
          ),
          band(
            '1+ Skill, 2 Structures',
            12,
            20,
            'A minimum of 1 level appropriate skill and two structures.',
          ),
        ],
      },
      {
        name: 'Pyramid Technique',
        maxScore: 20,
        description:
          'Execution • Stability • Flexibility • Uniformity • Sync. A zero is issued when no skills are performed.',
        bands: tierBands([0, 8, 18, 20]),
      },
    ],
  },
  {
    name: 'Toss',
    children: [
      {
        name: 'Toss Difficulty (L2-L7)',
        maxScore: 5,
        description:
          'Cumulative throughout the routine. Applies to Levels 2-7 (no toss component in Level 1). Considered when COMPARING teams: degree of difficulty of tosses (L3-L7); percentage of team participation; variety (L3-L7); additional tosses (non-level appropriate included) may increase your score within range; height.',
        bands: [
          band('No Level-Appropriate Toss', 0, 2, 'No skills performed. No level appropriate toss performed.'),
          band('Below Majority', 2, 3, 'Less than a Majority of the team performs a level appropriate toss.'),
          band('Majority Level-Appropriate', 3, 5, 'A Majority of the team performs a level appropriate toss.'),
        ],
      },
      {
        name: 'Toss Technique (L2-L7)',
        maxScore: 5,
        description:
          'Execution • Flexibility • Uniformity • Sync. Applies to Levels 2-7. A zero is issued when no skills are performed.',
        bands: tierBands([0, 2, 4, 5]),
      },
    ],
  },
  {
    name: 'Tumbling',
    children: [
      {
        name: 'Standing Tumbling Difficulty',
        maxScore: 5,
        description:
          'Cumulative throughout the routine. In levels 5-7, Jump/Tuck combination will be considered level appropriate. In levels 6-7, all single and double twisting skills will count as level appropriate. In Levels 1-4, individual tumbling passes (by a single person) will NOT be considered in the scoring process; in Levels 5-7 they WILL be considered. Synchronized tumbling is defined as passes intended to start and finish at the same time with more than one athlete. Considered when COMPARING teams: degree of difficulty of skills/passes; percentage of team participation; synchronization; specialty combination; variety; additional skills and combination of skills (non-level appropriate included) may increase your score within range.',
        bands: [
          band(
            'Below Majority / Below Level',
            0,
            3,
            'No skills performed. Less than a Majority of the team performs a level appropriate pass or a Majority perform below level appropriate passes.',
          ),
          band(
            'Majority Level-Appropriate',
            3,
            5,
            'A Majority of the team performs a level appropriate pass including passes with multiple athletes and multiple synchronized passes.',
          ),
        ],
      },
      {
        name: 'Running Tumbling Difficulty',
        maxScore: 5,
        description:
          'Cumulative throughout the routine. In levels 6-7, all single and double twisting skills will count as level appropriate. In Levels 1-4, individual tumbling passes (by a single person) will NOT be considered in the scoring process; in Levels 5-7 they WILL be considered. Synchronized tumbling is defined as passes intended to start and finish at the same time with more than one athlete. Considered when COMPARING teams: degree of difficulty of skills/passes; percentage of team participation; synchronization; specialty combination; variety; additional skills and combination of skills (non-level appropriate included) may increase your score within range.',
        bands: [
          band(
            'Below Majority / Below Level',
            0,
            3,
            'No skills performed. Less than a Majority of the team performs a level appropriate pass or a Majority perform below level appropriate passes.',
          ),
          band(
            'Majority Level-Appropriate',
            3,
            5,
            'A Majority of the team performs a level appropriate pass including passes with multiple athletes and multiple synchronized passes.',
          ),
        ],
      },
      {
        name: 'Tumbling Technique',
        maxScore: 5,
        description:
          'Execution • Uniformity • Body Control • Landings • Sync. A zero is issued when no skills are performed.',
        bands: tierBands([0, 2, 4, 5]),
      },
    ],
  },
  {
    name: 'Jump',
    children: [
      {
        name: 'Jump Difficulty',
        maxScore: 5,
        description:
          'Cumulative throughout the routine. Advanced Jumps: Herkie, Hurdler, Toe Touch, Pike, Double Nine. Considered when COMPARING teams: percentage of team participation; variety; connected jumps; synchronization; height.',
        bands: [
          band(
            'Below Majority',
            0,
            4,
            'No skills performed. Less than a Majority of the team performs 3 advanced jumps.',
          ),
          band('Majority 3 Advanced Jumps', 4, 5, 'A Majority of the team performs 3 advanced jumps.'),
        ],
      },
      {
        name: 'Jump Technique',
        maxScore: 5,
        description: 'Execution • Flexibility • Uniformity • Sync. A zero is issued when no skills are performed.',
        bands: tierBands([0, 2, 4, 5]),
      },
    ],
  },
  {
    name: 'Dance',
    children: [
      {
        name: 'Dance Difficulty',
        maxScore: 5,
        description:
          'Considered: Visual Elements; Variety Of Levels; Formation Changes; Pace & Intricacy; Footwork & Floorwork; Partnerwork; Team Participation. A zero is issued when no skills/elements are performed.',
        bands: tierBands([0, 2, 4, 5]),
      },
      {
        name: 'Dance Technique',
        maxScore: 5,
        description:
          'Considered: Perfection; Synchronization; Precision of spacing; Uniformity; Arm/Motion placement; Entertainment value; Energy level. A zero is issued when no skills/elements are performed.',
        bands: tierBands([0, 2, 4, 5]),
      },
    ],
  },
];

const STANDALONE: CriterionSeed[] = [
  {
    name: 'Routine Creativity',
    maxScore: 10,
    description:
      "A team's ability to consistently demonstrate innovative, visual, and creative ideas throughout all routine elements.",
    bands: tierBands([0, 4, 8, 10]),
  },
  {
    name: 'Formations & Transitions',
    maxScore: 10,
    description:
      "A team's ability to demonstrate precise spacing, uniform timing, strong pace, and seamless flow between elements.",
    bands: tierBands([0, 4, 8, 10]),
  },
  {
    name: 'Performance',
    maxScore: 5,
    description:
      "A team's ability to demonstrate high levels of energy, entertainment value, confidence, and showmanship.",
    bands: tierBands([0, 2, 4, 5]),
  },
];

export class AddIasf2526TeamCheerAllGirlTemplate1785640000000
  implements MigrationInterface
{
  name = 'AddIasf2526TeamCheerAllGirlTemplate1785640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore =
      GROUPS.reduce((sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0), 0) +
      STANDALONE.reduce((s, c) => s + c.maxScore, 0);

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year") VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [
        TEMPLATE_ID,
        'Team Cheer (All Girl)',
        'Official IASF scoring system for Team Cheer, Levels 1-7, All Girl divisions (2025-2026 season). Team Majority reference tables intentionally omitted (not a scored criterion).',
        targetScore,
        SYSTEM_SCORING_TEMPLATES_OWNER_ID,
        'International All Star Federation (IASF)',
        2025,
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
    await queryRunner.query(
      `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "description", "max_score", "order", "use_score_bands", "score_bands") VALUES ($1, $2, $3, 'score_item', $4, $5, $6, $7, true, $8::jsonb)`,
      [
        randomUUID(),
        TEMPLATE_ID,
        parentId,
        item.name,
        item.description,
        item.maxScore,
        order,
        JSON.stringify(item.bands),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "scoring_templates" WHERE "id" = $1`, [
      TEMPLATE_ID,
    ]);
  }
}
