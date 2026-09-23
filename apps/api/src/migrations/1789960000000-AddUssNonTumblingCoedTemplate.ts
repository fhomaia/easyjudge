import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Sétimo modelo de sistema com conteúdo real, nova fonte (United
// Scoring System, não IASF/SPPB). Fonte: "United Scoring System Non
// tumbling 2026.pdf" (Level 6 & 7 International Coed – Non-Tumbling,
// versão 07.20.26, aplica-se a International Open Coed NT e U18 Coed
// NT). Pedido pelo usuário (2026-09-23), arquivo fornecido por ele.
//
// Decisões de transcrição tomadas sem precisar perguntar (mesmo
// espírito das migrations IASF: mecânicas, não editoriais):
// - As páginas de "Execution" e "Overall" do PDF trazem uma data de
//   versão MAIS ANTIGA (03.17.26) que as de Building/Jump (07.20.26) —
//   são páginas padrão reaproveitadas em vários documentos da USS, não
//   exclusivas desta divisão. Transcritas fiéis ao PDF mesmo assim (a
//   nota "Straight ride tosses will ONLY affect a team's execution
//   score in level 2" foi omitida da descrição por não se aplicar a
//   L6/L7, o resto do texto de Toss Drivers foi mantido).
// - Tabelas só de referência (Building/Coed/Jump Quantity Charts —
//   contagem de atletas, não critério de nota) omitidas, mesmo
//   raciocínio das migrations IASF ("Team Majority" tables).
// - Todo item com tabela de valores nomeados (8.5/9.0/9.5.../11.0 etc)
//   virou faixa: cada valor nomeado é o PISO da faixa que ele
//   libera, até o próximo valor; uma faixa "piso" de 0 até o primeiro
//   valor nomeado foi adicionada (nenhuma tabela do documento chega a
//   0), mesmo padrão já usado nas migrations IASF. O par 10.5/11.0 de
//   Stunt Difficulty (a única linha com um requisito ADICIONAL — coed
//   style stunt — sobre a anterior, não um requisito totalmente novo)
//   virou uma faixa só, com a descrição explicando o bônus.
// - "Execution"/"Formations & Transitions"/"Routine Creativity"/
//   "Dance"/"Showmanship" não têm tabela de faixas no documento (é um
//   sistema de "começa no teto, subtrai X por problema" ou uma nota
//   holística com faixa mín-máx) — modelados como item numérico livre
//   (sem faixas), com a regra de subtração/composição na descrição,
//   diferente das migrations IASF (que usavam faixas genéricas
//   "Below/Average/Above" pra itens de Technique — lá o documento
//   original tinha piso/teto reais, aqui não há tabela nenhuma).
// - "Stunt Degree of Difficulty"/"Stunt Max Participation" são somas
//   de escolhas independentes (não uma escada de faixas única) —
//   também viraram item numérico livre com a régua de pontos por
//   escolha na descrição.
// - Deduções da USS SUBSTITUEM as 9 padrão da IASF (não são usadas
//   como base) — valores e nomes vêm do documento "United Scoring
//   Deduction System" (páginas 6-7), incluindo Division Violation (não
//   existe na IASF) e a Legalidade dividida em 5 tipos com valores
//   distintos (Image Policy x2, USASF Rules x3) em vez de um "Legality
//   Infractions" só — cada um marcado `requiresCode: true`. Ids
//   reaproveitados da IASF (athlete_fall, major_athlete_fall,
//   building_bobble, building_fall, major_building_fall,
//   boundary_violations, time_limit_violations) onde o conceito bate 1
//   pra 1, pra manter o mesmo ícone no frontend (ver
//   lib/deductionIcons.ts) — só o VALOR muda por template.
export const USS_NON_TUMBLING_COED_TEMPLATE_ID =
  'b1e2f3a4-9c5d-4abc-8def-000000000001';
const TEMPLATE_ID = USS_NON_TUMBLING_COED_TEMPLATE_ID;

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
    name: 'Building',
    children: [
      {
        name: 'Stunt Difficulty',
        maxScore: 11.0,
        description:
          'Cumulative throughout the routine. Stunt skills only receive full credit if they show control. L6 teams: at least 1 Stunt Degree of Difficulty skill must be Level 6. L7 teams: at least 1 must be Level 7. Coed Style bonus (top of range): group of 3 (Base/Top Person/Spotter), entry by Toss or Walk-In, base directly under the stunt, held 4 counts from intended level, must cradle or dismount to the performance surface for full credit.',
        bands: [
          band('No Skills Performed', 0, 8.5, 'No skills performed / below the minimum requirement.'),
          band('Below 9.0 Requirement', 8.5, 9.0, 'Skills performed do not meet the 9.0 requirement.'),
          band(
            '4 Skills by Most',
            9.0,
            9.5,
            '4 different level appropriate skills performed by MOST of the team.',
          ),
          band(
            '2 Skills, Synchronized',
            9.5,
            10.0,
            '2 different level appropriate skills performed by MOST of the team at the same time rippled or synchronized without recycling athletes.',
          ),
          band(
            '3 Skills, Synchronized',
            10.0,
            10.5,
            '3 different level appropriate skills performed by MOST of the team at the same time rippled or synchronized without recycling athletes.',
          ),
          band(
            '4 Skills, Synchronized (+ Coed Style)',
            10.5,
            11.0,
            '4 different level appropriate skills performed by MOST of the team at the same time rippled or synchronized without recycling athletes. Reaching 11.0 additionally requires a coed style stunt (L6: at least 1 Level 6 skill; L7: at least 2 Level 7 skills).',
          ),
        ],
      },
      {
        name: 'Stunt Degree of Difficulty',
        maxScore: 2.5,
        description:
          'Once a Stunt Difficulty score is set, each of up to 4 stunt skills plus 1 Coed Style skill is scored: 0.3 (Advanced Skill / Advanced Coed Style by MOST) or 0.5 (Elite Skill / Elite Coed Style by MOST, or a Level Skill by MAX), up to 2.5 total.',
        bands: [],
      },
      {
        name: 'Stunt Max Participation',
        maxScore: 1.5,
        description:
          'Rippled or synchronized in the same section without recycling athletes. Level Skill by MAX or Advanced Skill by MOST = 0.5. Advanced Skill by MAX or Elite Skill by MOST = 1.0. Elite Skill by MAX = 1.5.',
        bands: [],
      },
      {
        name: 'Pyramid Difficulty',
        maxScore: 15.0,
        description:
          "Cumulative throughout the routine. To receive credit for a structure, 2 or more stunts must be connected by 2 or more top persons. Degree of difficulty considers: number of groups performing each level appropriate transition, use of level appropriate stunts within structures/sequence, combination of level and non-level appropriate skills, pace and connection of skills. L6: all pyramid skills that are Level Appropriate in L5 are given Level Appropriate credit.",
        bands: [
          band('Below Minimum', 0, 10.0, 'No skills/structures performed, below the minimum requirement.'),
          band(
            'Below 11-12 Range',
            10.0,
            11.0,
            'Skills performed do not meet the 11.0-12.0 range requirement.',
          ),
          band('2 Skills, 2 Structures', 11.0, 12.0, '2 different level appropriate skills and 2 structures.'),
          band(
            '3 Skills, 2 Structures (Most)',
            12.0,
            13.0,
            '3 different level appropriate skills and 2 structures performed by MOST of the team.',
          ),
          band(
            '4 Skills, 2 Structures (Most)',
            13.0,
            14.0,
            '4 different level appropriate skills and 2 structures performed by MOST of the team.',
          ),
          band(
            '5 Skills, 2 Structures (Most)',
            14.0,
            15.0,
            '5 different level appropriate skills and 2 structures performed by MOST of the team.',
          ),
        ],
      },
      {
        name: 'Toss Difficulty',
        maxScore: 2.0,
        description:
          "Cumulative throughout the routine. Considers degree of difficulty, percentage of team participation, variety and height of tosses.",
        bands: [
          band('No Toss Performed', 0, 1.0, 'No toss performed / below the minimum requirement.'),
          band('Below Majority', 1.0, 1.5, 'Less than a MAJORITY of the team performs a toss.'),
          band(
            'Majority, Level-Appropriate',
            1.5,
            2.0,
            'MAJORITY of the team performs a level appropriate toss. Reaching 2.0 additionally requires the toss to be rippled or synchronized in the same section without recycling athletes.',
          ),
        ],
      },
    ],
  },
  {
    name: 'Jump',
    children: [
      {
        name: 'Jump Difficulty',
        maxScore: 2.0,
        description:
          'Cumulative throughout the routine. Jumps must use a whip approach (continuous arm movement through the swing) to count as connected. Variety = at least 2 different jumps (the same jump with different legs does not count, e.g. left/right hurdler). Jumps must land on feet for difficulty credit. Basic Jumps: Spread Eagle, Tuck Jump. Advanced Jumps: Pike, Right/Left Hurdlers (front or side), Toe Touch, Double Nine.',
        bands: [
          band('No Jumps Performed', 0, 0.5, 'No jumps performed / below the minimum requirement.'),
          band('Below 1.0 Requirement', 0.5, 1.0, 'Skills performed do not meet the 1.0 requirement.'),
          band('1 Advanced Jump (Most)', 1.0, 1.5, 'MOST of the team performs 1 advanced jump.'),
          band(
            '2-3 Connected Jumps (Most/Max)',
            1.5,
            2.0,
            'MOST of the team performs 2 connected advanced jumps (synchronized, with variety). Reaching 2.0 requires MAX of the team performing 3 connected advanced jumps, or 2 connected plus 1 additional advanced jump, synchronized with variety. Teams with fewer than 18 athletes: ALL athletes must meet the 3-jump (or 2+1) requirement.',
          ),
        ],
      },
    ],
  },
  {
    name: 'Execution',
    children: [
      {
        name: 'Stunt/Pyramid & Standing/Running Tumbling Execution',
        maxScore: 4.0,
        description:
          'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Top Person: body control, uniform flexibility, legs straight/locked, toes pointed. Bases/Spotters: stability, solid stance, feet stationary. Transitions: entries, dismounts, control skill to skill. Synchronization: timing (auto .3 off if fewer than 2 groups perform a level appropriate skill transition in Stunts/Pyramids). Standing/Running Tumbling — Approach, Body Control, Landings, Synchronization: timing (auto .3 off if no level appropriate pass is synchronized by 2 or more athletes).',
        bands: [],
      },
      {
        name: 'Toss & Jump Execution',
        maxScore: 2.0,
        description:
          "Starts at 2.0; same .1/.2/.3 reduction scale as above, no more than .3 off per driver. Teams that only perform 1 toss automatically receive .3 off for any driver that constitutes a reduction. Toss Drivers — Top Person: body control, consistent execution, legs straight/toes pointed, arm placement. Bases/Spotters: timing, solid stance, controlled, cradle. Height: distance between the top person's feet and the bases' hands (deduction capped at 0.1). Jump Drivers — Arm Placement, Leg Placement (straight legs, pointed toes, height, landings), Synchronization: timing (capped at 0.1).",
        bands: [],
      },
    ],
  },
  {
    name: 'Overall',
    children: [
      {
        name: 'Formations & Transitions',
        maxScore: 2.0,
        description:
          "Starts at 2.0; reduced 0.1 for EACH formation/transition that lacks precision. A team's ability to demonstrate precise spacing and uniform movement.",
        bands: [],
      },
      {
        name: 'Routine Creativity',
        maxScore: 2.0,
        description:
          'Average of 3 opinions (Building, Tumbling and Overall Judges) on the incorporation of innovative, visual and intricate ideas throughout the routine. Building Judge: Entries/Transitions/Dismounts of Building skills (level and non-level appropriate), pace/connection of skills. Tumbling Judge: clear visual tumbling patterns. Overall Judge: the routine as a whole, start to finish.',
        bands: [],
      },
      {
        name: 'Dance — Difficulty Elements',
        maxScore: 1.0,
        description:
          "Variety of difficulty elements, with strong execution: Visual Effects, Variety of Levels, Formation Changes, Footwork, Floor Work/Use of Floor, Partner Work, Pace.",
        bands: [],
      },
      {
        name: 'Dance — Execution',
        maxScore: 1.0,
        description: 'Technique, Perfection, Motion Strength/Placement, Synchronization, Uniformity, Energy/Entertainment Value.',
        bands: [],
      },
      {
        name: 'Showmanship',
        maxScore: 2.0,
        description:
          "Average of 3 scores (Building, Tumbling and Overall Judges) on the panel's impression of the entire performance: energy, genuine enthusiasm, confidence, eye contact, facial expression. Not skill-based, but takes into account appropriate athletic impression throughout the routine.",
        bands: [],
      },
    ],
  },
];

interface DeductionSeed {
  id: string;
  label: string;
  value: number;
  requiresCode: boolean;
}

// Substitui integralmente as 9 regras padrão da IASF (não semeadas
// como base) — ver comentário do topo do arquivo.
const DEDUCTIONS: DeductionSeed[] = [
  { id: 'athlete_fall', label: 'Athlete Fall', value: -0.15, requiresCode: false },
  { id: 'major_athlete_fall', label: 'Major Athlete Fall', value: -0.25, requiresCode: false },
  { id: 'building_bobble', label: 'Building Bobble', value: -0.25, requiresCode: false },
  { id: 'building_fall', label: 'Building Fall', value: -0.75, requiresCode: false },
  { id: 'major_building_fall', label: 'Major Building Fall', value: -1.25, requiresCode: false },
  { id: 'boundary_violations', label: 'Boundary Violations', value: -0.05, requiresCode: false },
  { id: 'time_limit_violations', label: 'Time Limit Violations', value: -0.05, requiresCode: false },
  { id: 'division_violation', label: 'Division Violation', value: -5.0, requiresCode: false },
  {
    id: 'legality_uniform_top',
    label: 'Legality: Uniform Top Guidelines (USASF)',
    value: -0.01,
    requiresCode: true,
  },
  {
    id: 'legality_aps',
    label: 'Legality: Athletic Performance Standards (APS)',
    value: -0.25,
    requiresCode: true,
  },
  {
    id: 'legality_general_rules',
    label: 'Legality: General Rules / Out of Level Tumbling',
    value: -0.05,
    requiresCode: true,
  },
  {
    id: 'legality_building_out_of_level',
    label: 'Legality: Building Out of Level',
    value: -0.1,
    requiresCode: true,
  },
  {
    id: 'legality_level_rules_restrictions',
    label: 'Legality: All Level Rules/Skill Restrictions by Division',
    value: -0.5,
    requiresCode: true,
  },
];

export class AddUssNonTumblingCoedTemplate1789960000000
  implements MigrationInterface
{
  name = 'AddUssNonTumblingCoedTemplate1789960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore = GROUPS.reduce(
      (sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0),
      0,
    );

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source", "year", "deductions") VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8::jsonb)`,
      [
        TEMPLATE_ID,
        'Team Cheer (Coed) — Non-Tumbling',
        'Official United Scoring System rubric for Level 6 & 7 International Coed Non-Tumbling (International Open Coed NT & U18 Coed NT), 2026-2027 season.',
        targetScore,
        SYSTEM_SCORING_TEMPLATES_OWNER_ID,
        'United Scoring System',
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
    await queryRunner.query(`DELETE FROM "scoring_templates" WHERE "id" = $1`, [
      TEMPLATE_ID,
    ]);
  }
}
