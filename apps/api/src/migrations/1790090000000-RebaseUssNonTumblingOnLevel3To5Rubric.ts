import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Rebaseia o modelo USS Non-Tumbling na régua do rubric "Level 3, 4 & 5
// Senior & Open Coed" (2025-2026, versão 10.15.25), pedido do usuário
// (2026-09-24). As notas máximas vêm de um clone que ele ajustou em
// produção (template 8b8a655e-...): Stunt Difficulty 11 -> 4.5, Stunt
// Degree of Difficulty 2.5 -> 0.8, Stunt Max Participation 1.5 -> 0.7,
// Pyramid Difficulty 15 -> 4, Toss/Jump Execution 4 -> 2; meta de 58
// pra 34. Stunt Difficulty, Stunt Max Participation e Toss/Jump
// Difficulty viram valores fixos (o PDF só
// aceita os valores nomeados da tabela, ver AddFixedValuesToScoringCriteria);
// Pyramid Difficulty continua com faixas (lá o PDF usa intervalos de
// verdade), com uma faixa "piso" de 0 até o primeiro valor nomeado,
// mesmo padrão das migrations anteriores. Estrutura, deduções e ids dos
// critérios não mudam, então a escala de jurados continua apontando
// pros mesmos critérios. Critérios achados por (pai, nome), já que
// "Execution"/"Difficulty" se repetem em grupos diferentes.
interface CriterionPatch {
  parent: string | null;
  name: string;
  maxScore?: number;
  description?: string | null;
  useScoreBands?: boolean;
  scoreBands?: unknown;
  useFixedValues?: boolean;
  fixedValues?: unknown;
}

const TEMPLATE_DESCRIPTION =
  'United Scoring System rubric for Level 3, 4 & 5 Senior & Open Coed (2025-2026, version 10.15.25), adapted for Non-Tumbling (no Standing/Running Tumbling).';
const OLD_TEMPLATE_DESCRIPTION =
  'Official United Scoring System rubric for Level 6 & 7 International Coed Non-Tumbling (International Open Coed NT & U18 Coed NT), 2026-2027 season.';

const NEW: CriterionPatch[] = [
  {
    parent: null,
    name: 'Building',
    maxScore: 22,
  },
  {
    parent: 'Building',
    name: 'Difficulty',
    maxScore: 12,
  },
  {
    parent: 'Building',
    name: 'Execution',
    maxScore: 10,
  },
  {
    parent: null,
    name: 'Jump',
    maxScore: 4,
  },
  {
    parent: 'Jump',
    name: 'Execution',
    maxScore: 2,
  },
  {
    parent: 'Difficulty',
    name: 'Stunt Difficulty',
    maxScore: 4.5,
    description:
      'Cumulativo ao longo da rotina. As habilidades de stunt só recebem crédito total se demonstrarem controle. Coed Style (necessário para 4,5): grupo de 3 (Base/Top/Spotter), entrada por Toss ou Walk-In, base diretamente sob o stunt, base e spotter não podem ficar peito a peito, mantido por 4 contagens a partir do nível pretendido, precisa terminar em cradle ou descer até o chão para crédito total. Stunts coed que viram pirâmide não recebem crédito coed. Equipes com 1 ou mais atletas masculinos: 1 stunt coed.',
    useScoreBands: false,
    scoreBands: null,
    useFixedValues: true,
    fixedValues: [
      {
        value: 0,
        name: 'No Skills Performed',
        description: 'Nenhuma habilidade de stunt realizada.',
      },
      {
        value: 2.5,
        name: 'Below 3.0 Requirement',
        description:
          'As habilidades realizadas não atendem ao requisito de 3,0.',
      },
      {
        value: 3.0,
        name: '4 Skills by Most',
        description:
          '4 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe.',
      },
      {
        value: 3.5,
        name: '2 Skills, Synchronized',
        description:
          '2 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas.',
      },
      {
        value: 4.0,
        name: '3 Skills, Synchronized',
        description:
          '3 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas.',
      },
      {
        value: 4.5,
        name: '3 Skills, Synchronized + Coed Style',
        description:
          '3 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas, mais um stunt de coed style.',
      },
    ],
  },
  {
    parent: 'Difficulty',
    name: 'Stunt Degree of Difficulty',
    maxScore: 0.8,
    description:
      'Depois que a nota de Stunt Difficulty é definida, cada uma de até 3 habilidades de stunt mais 1 habilidade de Coed Style é pontuada: 0,1 (Habilidade Avançada pela MAIORIA / Coed Style Avançado) ou 0,2 (Habilidade Elite pela MAIORIA / Coed Style Elite), até 0,8 no total.',
  },
  {
    parent: 'Difficulty',
    name: 'Stunt Max Participation',
    maxScore: 0.7,
    description:
      'Em ripple ou sincronizado na mesma seção, sem reaproveitar atletas. Habilidade de Nível pelo MÁXIMO ou Habilidade Avançada pela MAIORIA = 0,3. Habilidade Avançada pelo MÁXIMO ou Habilidade Elite pela MAIORIA = 0,5. Habilidade Elite pelo MÁXIMO = 0,7.',
    useScoreBands: false,
    scoreBands: null,
    useFixedValues: true,
    fixedValues: [
      {
        value: 0,
        name: 'No Max Participation',
        description:
          'Nenhum dos requisitos de participação máxima foi atingido.',
      },
      {
        value: 0.3,
        name: 'Level by Max / Advanced by Most',
        description:
          'Habilidade de Nível pelo MÁXIMO ou Habilidade Avançada pela MAIORIA.',
      },
      {
        value: 0.5,
        name: 'Advanced by Max / Elite by Most',
        description:
          'Habilidade Avançada pelo MÁXIMO ou Habilidade Elite pela MAIORIA.',
      },
      {
        value: 0.7,
        name: 'Elite by Max',
        description: 'Habilidade Elite pelo MÁXIMO.',
      },
    ],
  },
  {
    parent: 'Difficulty',
    name: 'Pyramid Difficulty',
    maxScore: 4,
    description:
      'Cumulativo ao longo da rotina. Para receber crédito por uma estrutura, 2 ou mais stunts precisam estar conectados por 2 ou mais top persons. O grau de dificuldade considera: número de grupos realizando cada transição apropriada ao nível, uso de stunts apropriados ao nível dentro de estruturas/sequência, combinação de habilidades apropriadas e não apropriadas ao nível, ritmo e conexão das habilidades.',
    useScoreBands: true,
    scoreBands: [
      {
        name: 'Below Minimum',
        description:
          'Nenhuma habilidade/estrutura realizada, abaixo do requisito mínimo.',
        color: '#94a3b8',
        min: 0,
        max: 2.0,
      },
      {
        name: 'Below',
        description:
          'As habilidades realizadas não atendem ao requisito da faixa Low.',
        color: '#94a3b8',
        min: 2.0,
        max: 2.5,
      },
      {
        name: 'Low',
        description:
          '2 habilidades diferentes apropriadas ao nível e 2 estruturas.',
        color: '#94a3b8',
        min: 2.5,
        max: 3.0,
      },
      {
        name: 'Mid',
        description:
          '3 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
        color: '#94a3b8',
        min: 3.0,
        max: 3.5,
      },
      {
        name: 'High',
        description:
          '4 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
        color: '#94a3b8',
        min: 3.5,
        max: 4.0,
      },
    ],
  },
  {
    parent: 'Difficulty',
    name: 'Toss Difficulty',
    useScoreBands: false,
    scoreBands: null,
    useFixedValues: true,
    fixedValues: [
      {
        value: 0,
        name: 'No Toss Performed',
        description: 'Nenhum toss realizado.',
      },
      {
        value: 1.0,
        name: 'Below Majority',
        description: 'Menos que a MAIORIA da equipe realiza um toss.',
      },
      {
        value: 1.5,
        name: 'Majority, Level-Appropriate',
        description: 'A MAIORIA da equipe realiza um toss apropriado ao nível.',
      },
      {
        value: 2.0,
        name: 'Majority, Synchronized',
        description:
          'A MAIORIA da equipe realiza um toss apropriado ao nível, em ripple ou sincronizado na mesma seção, sem reaproveitar atletas.',
      },
    ],
  },
  {
    parent: 'Difficulty',
    name: 'Jump Difficulty',
    useScoreBands: false,
    scoreBands: null,
    useFixedValues: true,
    fixedValues: [
      {
        value: 0,
        name: 'No Jumps Performed',
        description: 'Nenhum jump realizado.',
      },
      {
        value: 0.5,
        name: 'Below 1.0 Requirement',
        description:
          'As habilidades realizadas não atendem ao requisito de 1,0.',
      },
      {
        value: 1.0,
        name: '1 Advanced Jump (Most)',
        description: 'A MAIORIA da equipe realiza 1 jump avançado.',
      },
      {
        value: 1.5,
        name: '2 Connected Jumps (Most)',
        description:
          'A MAIORIA da equipe realiza 2 jumps avançados conectados, sincronizados e com variedade.',
      },
      {
        value: 2.0,
        name: '3 Connected Jumps (Max)',
        description:
          'O MÁXIMO da equipe realiza 3 jumps avançados conectados, ou 2 conectados mais 1 jump avançado adicional, sincronizados e com variedade. Equipes com menos de 10 atletas: TODOS os atletas precisam cumprir esse requisito.',
      },
    ],
  },
  {
    parent: 'Execution',
    name: 'Toss Execution',
    maxScore: 2,
    description:
      'Começa em 2,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Equipes que realizam apenas 1 toss recebem automaticamente .3 de desconto em qualquer driver que gere redução. Drivers — Top Person: controle corporal, execução consistente, pernas retas/pontas dos pés esticadas, posicionamento dos braços. Bases/Spotters: timing, postura firme, controlado, cradle. Altura: distância entre os pés do top person e as mãos das bases (desconto limitado a 0,1).',
  },
  {
    parent: 'Execution',
    name: 'Jump Execution',
    maxScore: 2,
    description:
      'Começa em 2,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Drivers — Posicionamento dos Braços, Posicionamento das Pernas (pernas retas, pontas dos pés esticadas, altura, aterrissagens), Sincronização: timing (limitado a 0,1).',
  },
];

const OLD: CriterionPatch[] = [
  {
    parent: null,
    name: 'Building',
    maxScore: 44,
  },
  {
    parent: 'Building',
    name: 'Difficulty',
    maxScore: 32,
  },
  {
    parent: 'Building',
    name: 'Execution',
    maxScore: 12,
  },
  {
    parent: null,
    name: 'Jump',
    maxScore: 6,
  },
  {
    parent: 'Jump',
    name: 'Execution',
    maxScore: 4,
  },
  {
    parent: 'Difficulty',
    name: 'Stunt Difficulty',
    maxScore: 11,
    description:
      'Cumulativo ao longo da rotina. As habilidades de stunt só recebem crédito total se demonstrarem controle. Equipes L6: pelo menos 1 habilidade de Grau de Dificuldade do Stunt deve ser Nível 6. Equipes L7: pelo menos 1 deve ser Nível 7. Bônus de Coed Style (topo da faixa): grupo de 3 (Base/Top/Spotter), entrada por Toss ou Walk-In, base diretamente sob o stunt, mantido por 4 contagens a partir do nível pretendido, precisa terminar em cradle ou descer até o chão para crédito total.',
    useScoreBands: true,
    scoreBands: [
      {
        max: 8.5,
        min: 0,
        name: 'No Skills Performed',
        color: '#94a3b8',
        description:
          'Nenhuma habilidade realizada / abaixo do requisito mínimo.',
      },
      {
        max: 9,
        min: 8.5,
        name: 'Below 9.0 Requirement',
        color: '#94a3b8',
        description:
          'As habilidades realizadas não atendem ao requisito de 9,0.',
      },
      {
        max: 9.5,
        min: 9,
        name: '4 Skills by Most',
        color: '#94a3b8',
        description:
          '4 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe.',
      },
      {
        max: 10,
        min: 9.5,
        name: '2 Skills, Synchronized',
        color: '#94a3b8',
        description:
          '2 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas.',
      },
      {
        max: 10.5,
        min: 10,
        name: '3 Skills, Synchronized',
        color: '#94a3b8',
        description:
          '3 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas.',
      },
      {
        max: 11,
        min: 10.5,
        name: '4 Skills, Synchronized (+ Coed Style)',
        color: '#94a3b8',
        description:
          '4 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas. Para chegar a 11,0 é necessário também um stunt de coed style (L6: pelo menos 1 habilidade Nível 6; L7: pelo menos 2 habilidades Nível 7).',
      },
    ],
    useFixedValues: false,
    fixedValues: null,
  },
  {
    parent: 'Difficulty',
    name: 'Stunt Degree of Difficulty',
    maxScore: 2.5,
    description:
      'Depois que a nota de Stunt Difficulty é definida, cada uma de até 4 habilidades de stunt mais 1 habilidade de Coed Style é pontuada: 0,3 (Habilidade Avançada / Coed Style Avançado pela MAIORIA) ou 0,5 (Habilidade Elite / Coed Style Elite pela MAIORIA, ou uma Habilidade de Nível pelo MÁXIMO), até 2,5 no total.',
  },
  {
    parent: 'Difficulty',
    name: 'Stunt Max Participation',
    maxScore: 1.5,
    description:
      'Em ripple ou sincronizado na mesma seção, sem reaproveitar atletas. Habilidade de Nível pelo MÁXIMO ou Habilidade Avançada pela MAIORIA = 0,5. Habilidade Avançada pelo MÁXIMO ou Habilidade Elite pela MAIORIA = 1,0. Habilidade Elite pelo MÁXIMO = 1,5.',
    useScoreBands: false,
    scoreBands: null,
    useFixedValues: false,
    fixedValues: null,
  },
  {
    parent: 'Difficulty',
    name: 'Pyramid Difficulty',
    maxScore: 15,
    description:
      'Cumulativo ao longo da rotina. Para receber crédito por uma estrutura, 2 ou mais stunts precisam estar conectados por 2 ou mais top persons. O grau de dificuldade considera: número de grupos realizando cada transição apropriada ao nível, uso de stunts apropriados ao nível dentro de estruturas/sequência, combinação de habilidades apropriadas e não apropriadas ao nível, ritmo e conexão das habilidades. L6: todas as habilidades de pirâmide que são apropriadas ao nível em L5 recebem crédito de apropriada ao nível.',
    useScoreBands: true,
    scoreBands: [
      {
        max: 10,
        min: 0,
        name: 'Below Minimum',
        color: '#94a3b8',
        description:
          'Nenhuma habilidade/estrutura realizada, abaixo do requisito mínimo.',
      },
      {
        max: 11,
        min: 10,
        name: 'Below 11-12 Range',
        color: '#94a3b8',
        description:
          'As habilidades realizadas não atendem ao requisito da faixa 11,0-12,0.',
      },
      {
        max: 12,
        min: 11,
        name: '2 Skills, 2 Structures',
        color: '#94a3b8',
        description:
          '2 habilidades diferentes apropriadas ao nível e 2 estruturas.',
      },
      {
        max: 13,
        min: 12,
        name: '3 Skills, 2 Structures (Most)',
        color: '#94a3b8',
        description:
          '3 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
      },
      {
        max: 14,
        min: 13,
        name: '4 Skills, 2 Structures (Most)',
        color: '#94a3b8',
        description:
          '4 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
      },
      {
        max: 15,
        min: 14,
        name: '5 Skills, 2 Structures (Most)',
        color: '#94a3b8',
        description:
          '5 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
      },
    ],
  },
  {
    parent: 'Difficulty',
    name: 'Toss Difficulty',
    useScoreBands: true,
    scoreBands: [
      {
        max: 1,
        min: 0,
        name: 'No Toss Performed',
        color: '#94a3b8',
        description: 'Nenhum toss realizado / abaixo do requisito mínimo.',
      },
      {
        max: 1.5,
        min: 1,
        name: 'Below Majority',
        color: '#94a3b8',
        description: 'Menos que a MAIORIA da equipe realiza um toss.',
      },
      {
        max: 2,
        min: 1.5,
        name: 'Majority, Level-Appropriate',
        color: '#94a3b8',
        description:
          'A MAIORIA da equipe realiza um toss apropriado ao nível. Para chegar a 2,0 é necessário também que o toss esteja em ripple ou sincronizado na mesma seção, sem reaproveitar atletas.',
      },
    ],
    useFixedValues: false,
    fixedValues: null,
  },
  {
    parent: 'Difficulty',
    name: 'Jump Difficulty',
    useScoreBands: true,
    scoreBands: [
      {
        max: 0.5,
        min: 0,
        name: 'No Jumps Performed',
        color: '#94a3b8',
        description: 'Nenhum jump realizado / abaixo do requisito mínimo.',
      },
      {
        max: 1,
        min: 0.5,
        name: 'Below 1.0 Requirement',
        color: '#94a3b8',
        description:
          'As habilidades realizadas não atendem ao requisito de 1,0.',
      },
      {
        max: 1.5,
        min: 1,
        name: '1 Advanced Jump (Most)',
        color: '#94a3b8',
        description: 'A MAIORIA da equipe realiza 1 jump avançado.',
      },
      {
        max: 2,
        min: 1.5,
        name: '2-3 Connected Jumps (Most/Max)',
        color: '#94a3b8',
        description:
          'A MAIORIA da equipe realiza 2 jumps avançados conectados (sincronizados, com variedade). Para chegar a 2,0 é necessário que o MÁXIMO da equipe realize 3 jumps avançados conectados, ou 2 conectados mais 1 jump avançado adicional, sincronizados e com variedade. Equipes com menos de 18 atletas: TODOS os atletas precisam cumprir o requisito de 3 jumps (ou 2+1).',
      },
    ],
    useFixedValues: false,
    fixedValues: null,
  },
  {
    parent: 'Execution',
    name: 'Toss Execution',
    maxScore: 4,
    description:
      'Começa em 4,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Equipes que realizam apenas 1 toss recebem automaticamente .3 de desconto em qualquer driver que gere redução. Drivers — Top Person: controle corporal, execução consistente, pernas retas/pontas dos pés esticadas, posicionamento dos braços. Bases/Spotters: timing, postura firme, controlado, cradle. Altura: distância entre os pés do top person e as mãos das bases (desconto limitado a 0,1).',
  },
  {
    parent: 'Execution',
    name: 'Jump Execution',
    maxScore: 4,
    description:
      'Começa em 4,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Drivers — Posicionamento dos Braços, Posicionamento das Pernas (pernas retas, pontas dos pés esticadas, altura, aterrissagens), Sincronização: timing (limitado a 0,1).',
  },
];

const COLUMNS: Array<[keyof CriterionPatch, string, 'jsonb' | null]> = [
  ['maxScore', 'max_score', null],
  ['description', 'description', null],
  ['useScoreBands', 'use_score_bands', null],
  ['scoreBands', 'score_bands', 'jsonb'],
  ['useFixedValues', 'use_fixed_values', null],
  ['fixedValues', 'fixed_values', 'jsonb'],
];

export class RebaseUssNonTumblingOnLevel3To5Rubric1790090000000 implements MigrationInterface {
  name = 'RebaseUssNonTumblingOnLevel3To5Rubric1790090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, NEW, 34, TEMPLATE_DESCRIPTION);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, OLD, 58, OLD_TEMPLATE_DESCRIPTION);
  }

  private async apply(
    queryRunner: QueryRunner,
    patches: CriterionPatch[],
    targetScore: number,
    description: string,
  ): Promise<void> {
    for (const patch of patches) {
      const rows: Array<{ id: string }> = await queryRunner.query(
        `SELECT c.id FROM "scoring_criteria" c
         LEFT JOIN "scoring_criteria" p ON p.id = c.parent_id
         WHERE c.template_id = $1 AND c.name = $2
           AND (($3::varchar IS NULL AND c.parent_id IS NULL) OR p.name = $3)`,
        [USS_NON_TUMBLING_COED_TEMPLATE_ID, patch.name, patch.parent],
      );
      if (rows.length !== 1) {
        throw new Error(
          `Critério "${patch.parent ?? '(raiz)'} > ${patch.name}" encontrado ${rows.length} vezes, esperado 1.`,
        );
      }
      const sets: string[] = [];
      const params: unknown[] = [rows[0].id];
      for (const [key, column, cast] of COLUMNS) {
        if (patch[key] === undefined) continue;
        const value = patch[key];
        params.push(
          cast === 'jsonb' && value !== null ? JSON.stringify(value) : value,
        );
        sets.push(`"${column}" = $${params.length}${cast ? '::jsonb' : ''}`);
      }
      await queryRunner.query(
        `UPDATE "scoring_criteria" SET ${sets.join(', ')} WHERE "id" = $1`,
        params,
      );
    }
    await queryRunner.query(
      `UPDATE "scoring_templates" SET "target_score" = $2, "description" = $3 WHERE "id" = $1`,
      [USS_NON_TUMBLING_COED_TEMPLATE_ID, targetScore, description],
    );
  }
}
