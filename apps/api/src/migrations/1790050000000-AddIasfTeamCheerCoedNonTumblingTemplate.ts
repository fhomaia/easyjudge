import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Divisão Non-Tumbling do IASF, Coed — irmão de
// 1790040000000-AddIasfTeamCheerAllGirlNonTumblingTemplate.ts (mesmo
// raciocínio de transcrição, ver comentário lá). Único critério que
// difere da divisão All Girl NT é "Stunt Difficulty" (Coed também
// avalia Majority de single based/assisted single based skill, além
// do level appropriate skill) — idêntico ao mesmo critério do
// template Coed "com tumbling" (conferido contra o PDF, sem
// divergência). Deduções = as 9 padrão da IASF já usadas na
// plataforma (pedido do usuário).
export const IASF_TEAM_CHEER_COED_NT_TEMPLATE_ID =
  'd2e3f4a5-2222-4abc-9def-000000000001';
const TEMPLATE_ID = IASF_TEAM_CHEER_COED_NT_TEMPLATE_ID;

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

const GROUPS: GroupSeed[] = [
  {
    name: 'Stunt',
    children: [
      {
        name: 'Stunt Difficulty (Coed)',
        maxScore: 20,
        description:
          'Cumulative throughout the routine. Transitional skills will NOT count towards the Single Based or Assisted Single Based requirement. Considered when COMPARING teams: degree of difficulty of skills; percentage of team participation; minimal use of bases; variety of load-ins, dismounts, and transitions; pace, additional skills, and combination of skills (non-level appropriate included) may increase your score within range.',
        bands: [
          band(
            'No Skills / Below Majority',
            0,
            8,
            'No skills performed. Less than a Majority of the team performs a level appropriate skill. No single based or assisted single based skill performed.',
          ),
          band(
            'Majority Skill, No Single Base',
            8,
            16,
            'A Majority of the team performs a level appropriate skill. Less than a Majority of the team performs a single based or assisted single based skill.',
          ),
          band(
            'Majority Skill + Single Base',
            8,
            20,
            'A Majority of the team performs a level appropriate skill and a Majority of the team performs a single based or assisted single based skill.',
          ),
        ],
      },
      {
        name: 'Stunt Technique',
        maxScore: 20,
        description: 'Execution • Stability • Flexibility • Uniformity • Sync. A zero is issued when no skills are performed.',
        bands: tierBands([0, 8, 18, 20]),
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
        description: 'Execution • Stability • Flexibility • Uniformity • Sync. A zero is issued when no skills are performed.',
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
        description: 'Execution • Flexibility • Uniformity • Sync. Applies to Levels 2-7. A zero is issued when no skills are performed.',
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

const DEDUCTIONS = [
  { id: 'athlete_fall', label: 'Athlete Fall', value: -1.0, requiresCode: false },
  { id: 'major_athlete_fall', label: 'Major Athlete Fall', value: -2.0, requiresCode: false },
  { id: 'building_bobble', label: 'Building Bobble', value: -2.0, requiresCode: false },
  { id: 'building_fall', label: 'Building Fall', value: -3.0, requiresCode: false },
  { id: 'major_building_fall', label: 'Major Building Fall', value: -4.0, requiresCode: false },
  { id: 'legality_infractions', label: 'Legality Infractions', value: -4.0, requiresCode: true },
  { id: 'skill_out_of_level', label: 'Skill Performed Out of Level', value: -1.0, requiresCode: false },
  { id: 'time_limit_violations', label: 'Time Limit Violations', value: -1.0, requiresCode: false },
  { id: 'boundary_violations', label: 'Boundary Violations', value: -1.0, requiresCode: false },
];

export class AddIasfTeamCheerCoedNonTumblingTemplate1790050000000
  implements MigrationInterface
{
  name = 'AddIasfTeamCheerCoedNonTumblingTemplate1790050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore =
      GROUPS.reduce((sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0), 0) +
      STANDALONE.reduce((s, c) => s + c.maxScore, 0);

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year", "deductions") VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8::jsonb)`,
      [
        TEMPLATE_ID,
        'Team Cheer (Coed) — Non-Tumbling',
        'Official IASF scoring system for Team Cheer, Non-Tumbling divisions, Coed (2026 season). No tumbling allowed — exception: forward rolls, handstands, cartwheels and round offs are allowed for stunting purposes or formation changes, and must follow appropriate level inversion rules. Team Majority reference tables intentionally omitted (not a scored criterion).',
        targetScore,
        SYSTEM_SCORING_TEMPLATES_OWNER_ID,
        'International All Star Federation (IASF)',
        2026,
        JSON.stringify(DEDUCTIONS),
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
    const hasBands = item.bands.length > 0;
    await queryRunner.query(
      `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "description", "max_score", "order", "use_score_bands", "score_bands") VALUES ($1, $2, $3, 'score_item', $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        randomUUID(),
        TEMPLATE_ID,
        parentId,
        item.name,
        item.description,
        item.maxScore,
        order,
        hasBands,
        hasBands ? JSON.stringify(item.bands) : null,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "scoring_templates" WHERE "id" = $1`, [TEMPLATE_ID]);
  }
}
