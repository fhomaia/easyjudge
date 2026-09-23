import { MigrationInterface, QueryRunner } from 'typeorm';
import { USS_NON_TUMBLING_COED_TEMPLATE_ID } from './1789960000000-AddUssNonTumblingCoedTemplate';

// Traduz as descrições (critério + faixas de pontuação) do template USS
// Non-Tumbling pro português — pedido do usuário (2026-09-23). Escopo
// deliberadamente restrito ao campo `description`: nomes de critério
// ("Stunt Difficulty", "Pyramid", "Execution"...), nomes de faixa
// ("4 Skills by Most"...) e rótulos de dedução continuam em inglês —
// são termos técnicos do esporte, mesmo raciocínio já usado nas
// migrations IASF ("conteúdo mantido em inglês, fiel ao documento
// original", ver comentário de AddIasf2526TeamCheerAllGirlTemplate).
// Guarda o texto em inglês original em `down()` pra reverter.
interface CriterionTranslation {
  name: string;
  descriptionEn: string;
  descriptionPt: string;
  // Presente só nos 4 critérios com faixas — mesma ordem/tamanho do
  // array `score_bands` já salvo (min crescente), só a descrição muda.
  bandDescriptionsEn?: string[];
  bandDescriptionsPt?: string[];
}

const TRANSLATIONS: CriterionTranslation[] = [
  {
    name: 'Stunt Difficulty',
    descriptionEn:
      'Cumulative throughout the routine. Stunt skills only receive full credit if they show control. L6 teams: at least 1 Stunt Degree of Difficulty skill must be Level 6. L7 teams: at least 1 must be Level 7. Coed Style bonus (top of range): group of 3 (Base/Top Person/Spotter), entry by Toss or Walk-In, base directly under the stunt, held 4 counts from intended level, must cradle or dismount to the performance surface for full credit.',
    descriptionPt:
      'Cumulativo ao longo da rotina. As habilidades de stunt só recebem crédito total se demonstrarem controle. Equipes L6: pelo menos 1 habilidade de Grau de Dificuldade do Stunt deve ser Nível 6. Equipes L7: pelo menos 1 deve ser Nível 7. Bônus de Coed Style (topo da faixa): grupo de 3 (Base/Top/Spotter), entrada por Toss ou Walk-In, base diretamente sob o stunt, mantido por 4 contagens a partir do nível pretendido, precisa terminar em cradle ou descer até o chão para crédito total.',
    bandDescriptionsEn: [
      'No skills performed / below the minimum requirement.',
      'Skills performed do not meet the 9.0 requirement.',
      '4 different level appropriate skills performed by MOST of the team.',
      '2 different level appropriate skills performed by MOST of the team at the same time rippled or synchronized without recycling athletes.',
      '3 different level appropriate skills performed by MOST of the team at the same time rippled or synchronized without recycling athletes.',
      '4 different level appropriate skills performed by MOST of the team at the same time rippled or synchronized without recycling athletes. Reaching 11.0 additionally requires a coed style stunt (L6: at least 1 Level 6 skill; L7: at least 2 Level 7 skills).',
    ],
    bandDescriptionsPt: [
      'Nenhuma habilidade realizada / abaixo do requisito mínimo.',
      'As habilidades realizadas não atendem ao requisito de 9,0.',
      '4 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe.',
      '2 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas.',
      '3 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas.',
      '4 habilidades diferentes apropriadas ao nível realizadas pela MAIORIA da equipe ao mesmo tempo, em ripple ou sincronizadas, sem reaproveitar atletas. Para chegar a 11,0 é necessário também um stunt de coed style (L6: pelo menos 1 habilidade Nível 6; L7: pelo menos 2 habilidades Nível 7).',
    ],
  },
  {
    name: 'Stunt Degree of Difficulty',
    descriptionEn:
      'Once a Stunt Difficulty score is set, each of up to 4 stunt skills plus 1 Coed Style skill is scored: 0.3 (Advanced Skill / Advanced Coed Style by MOST) or 0.5 (Elite Skill / Elite Coed Style by MOST, or a Level Skill by MAX), up to 2.5 total.',
    descriptionPt:
      'Depois que a nota de Stunt Difficulty é definida, cada uma de até 4 habilidades de stunt mais 1 habilidade de Coed Style é pontuada: 0,3 (Habilidade Avançada / Coed Style Avançado pela MAIORIA) ou 0,5 (Habilidade Elite / Coed Style Elite pela MAIORIA, ou uma Habilidade de Nível pelo MÁXIMO), até 2,5 no total.',
  },
  {
    name: 'Stunt Max Participation',
    descriptionEn:
      'Rippled or synchronized in the same section without recycling athletes. Level Skill by MAX or Advanced Skill by MOST = 0.5. Advanced Skill by MAX or Elite Skill by MOST = 1.0. Elite Skill by MAX = 1.5.',
    descriptionPt:
      'Em ripple ou sincronizado na mesma seção, sem reaproveitar atletas. Habilidade de Nível pelo MÁXIMO ou Habilidade Avançada pela MAIORIA = 0,5. Habilidade Avançada pelo MÁXIMO ou Habilidade Elite pela MAIORIA = 1,0. Habilidade Elite pelo MÁXIMO = 1,5.',
  },
  {
    name: 'Pyramid Difficulty',
    descriptionEn:
      "Cumulative throughout the routine. To receive credit for a structure, 2 or more stunts must be connected by 2 or more top persons. Degree of difficulty considers: number of groups performing each level appropriate transition, use of level appropriate stunts within structures/sequence, combination of level and non-level appropriate skills, pace and connection of skills. L6: all pyramid skills that are Level Appropriate in L5 are given Level Appropriate credit.",
    descriptionPt:
      'Cumulativo ao longo da rotina. Para receber crédito por uma estrutura, 2 ou mais stunts precisam estar conectados por 2 ou mais top persons. O grau de dificuldade considera: número de grupos realizando cada transição apropriada ao nível, uso de stunts apropriados ao nível dentro de estruturas/sequência, combinação de habilidades apropriadas e não apropriadas ao nível, ritmo e conexão das habilidades. L6: todas as habilidades de pirâmide que são apropriadas ao nível em L5 recebem crédito de apropriada ao nível.',
    bandDescriptionsEn: [
      'No skills/structures performed, below the minimum requirement.',
      'Skills performed do not meet the 11.0-12.0 range requirement.',
      '2 different level appropriate skills and 2 structures.',
      '3 different level appropriate skills and 2 structures performed by MOST of the team.',
      '4 different level appropriate skills and 2 structures performed by MOST of the team.',
      '5 different level appropriate skills and 2 structures performed by MOST of the team.',
    ],
    bandDescriptionsPt: [
      'Nenhuma habilidade/estrutura realizada, abaixo do requisito mínimo.',
      'As habilidades realizadas não atendem ao requisito da faixa 11,0-12,0.',
      '2 habilidades diferentes apropriadas ao nível e 2 estruturas.',
      '3 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
      '4 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
      '5 habilidades diferentes apropriadas ao nível e 2 estruturas realizadas pela MAIORIA da equipe.',
    ],
  },
  {
    name: 'Toss Difficulty',
    descriptionEn:
      'Cumulative throughout the routine. Considers degree of difficulty, percentage of team participation, variety and height of tosses.',
    descriptionPt:
      'Cumulativo ao longo da rotina. Considera o grau de dificuldade, o percentual de participação da equipe, a variedade e a altura dos tosses.',
    bandDescriptionsEn: [
      'No toss performed / below the minimum requirement.',
      'Less than a MAJORITY of the team performs a toss.',
      'MAJORITY of the team performs a level appropriate toss. Reaching 2.0 additionally requires the toss to be rippled or synchronized in the same section without recycling athletes.',
    ],
    bandDescriptionsPt: [
      'Nenhum toss realizado / abaixo do requisito mínimo.',
      'Menos que a MAIORIA da equipe realiza um toss.',
      'A MAIORIA da equipe realiza um toss apropriado ao nível. Para chegar a 2,0 é necessário também que o toss esteja em ripple ou sincronizado na mesma seção, sem reaproveitar atletas.',
    ],
  },
  {
    name: 'Jump Difficulty',
    descriptionEn:
      'Cumulative throughout the routine. Jumps must use a whip approach (continuous arm movement through the swing) to count as connected. Variety = at least 2 different jumps (the same jump with different legs does not count, e.g. left/right hurdler). Jumps must land on feet for difficulty credit. Basic Jumps: Spread Eagle, Tuck Jump. Advanced Jumps: Pike, Right/Left Hurdlers (front or side), Toe Touch, Double Nine.',
    descriptionPt:
      'Cumulativo ao longo da rotina. Os jumps precisam usar uma abordagem de whip (movimento contínuo dos braços durante o swing) para contar como conectados. Variedade = pelo menos 2 jumps diferentes (o mesmo jump com pernas diferentes não conta, ex. hurdler esquerdo/direito). Os jumps precisam aterrissar de pé para receber crédito de dificuldade. Jumps Básicos: Spread Eagle, Tuck Jump. Jumps Avançados: Pike, Hurdler Direito/Esquerdo (frontal ou lateral), Toe Touch, Double Nine.',
    bandDescriptionsEn: [
      'No jumps performed / below the minimum requirement.',
      'Skills performed do not meet the 1.0 requirement.',
      'MOST of the team performs 1 advanced jump.',
      'MOST of the team performs 2 connected advanced jumps (synchronized, with variety). Reaching 2.0 requires MAX of the team performing 3 connected advanced jumps, or 2 connected plus 1 additional advanced jump, synchronized with variety. Teams with fewer than 18 athletes: ALL athletes must meet the 3-jump (or 2+1) requirement.',
    ],
    bandDescriptionsPt: [
      'Nenhum jump realizado / abaixo do requisito mínimo.',
      'As habilidades realizadas não atendem ao requisito de 1,0.',
      'A MAIORIA da equipe realiza 1 jump avançado.',
      'A MAIORIA da equipe realiza 2 jumps avançados conectados (sincronizados, com variedade). Para chegar a 2,0 é necessário que o MÁXIMO da equipe realize 3 jumps avançados conectados, ou 2 conectados mais 1 jump avançado adicional, sincronizados e com variedade. Equipes com menos de 18 atletas: TODOS os atletas precisam cumprir o requisito de 3 jumps (ou 2+1).',
    ],
  },
  {
    name: 'Stunt Execution',
    descriptionEn:
      'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Top Person: body control, uniform flexibility, legs straight/locked, toes pointed. Bases/Spotters: stability, solid stance, feet stationary. Transitions: entries, dismounts, control skill to skill. Synchronization: timing (auto .3 off if fewer than 2 groups perform a level appropriate skill transition).',
    descriptionPt:
      'Começa em 4,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Diferenças de estilo não são consideradas. Drivers — Top Person: controle corporal, flexibilidade uniforme, pernas retas/travadas, pontas dos pés esticadas. Bases/Spotters: estabilidade, postura firme, pés parados. Transições: entradas, descidas, controle de habilidade a habilidade. Sincronização: timing (desconto automático de .3 se menos de 2 grupos realizarem uma transição de habilidade apropriada ao nível).',
  },
  {
    name: 'Pyramid Execution',
    descriptionEn:
      'Starts at 4.0; reduced .1 (minor), .2 (multiple) or .3 (widespread) technique issues per driver — no more than .3 off for a single driver. Stylistic differences do not factor in. Drivers — Top Person: body control, uniform flexibility, legs straight/locked, toes pointed. Bases/Spotters: stability, solid stance, feet stationary. Transitions: entries, dismounts, control skill to skill. Synchronization: timing (auto .3 off if fewer than 2 groups perform a level appropriate skill transition).',
    descriptionPt:
      'Começa em 4,0; reduzido .1 (problemas leves), .2 (múltiplos problemas) ou .3 (problemas generalizados) de técnica por driver — no máximo .3 de desconto por driver. Diferenças de estilo não são consideradas. Drivers — Top Person: controle corporal, flexibilidade uniforme, pernas retas/travadas, pontas dos pés esticadas. Bases/Spotters: estabilidade, postura firme, pés parados. Transições: entradas, descidas, controle de habilidade a habilidade. Sincronização: timing (desconto automático de .3 se menos de 2 grupos realizarem uma transição de habilidade apropriada ao nível).',
  },
  {
    name: 'Toss & Jump Execution',
    descriptionEn:
      "Starts at 2.0; same .1/.2/.3 reduction scale as above, no more than .3 off per driver. Teams that only perform 1 toss automatically receive .3 off for any driver that constitutes a reduction. Toss Drivers — Top Person: body control, consistent execution, legs straight/toes pointed, arm placement. Bases/Spotters: timing, solid stance, controlled, cradle. Height: distance between the top person's feet and the bases' hands (deduction capped at 0.1). Jump Drivers — Arm Placement, Leg Placement (straight legs, pointed toes, height, landings), Synchronization: timing (capped at 0.1).",
    descriptionPt:
      'Começa em 2,0; mesma escala de redução .1/.2/.3 de cima, no máximo .3 de desconto por driver. Equipes que realizam apenas 1 toss recebem automaticamente .3 de desconto em qualquer driver que gere redução. Drivers de Toss — Top Person: controle corporal, execução consistente, pernas retas/pontas dos pés esticadas, posicionamento dos braços. Bases/Spotters: timing, postura firme, controlado, cradle. Altura: distância entre os pés do top person e as mãos das bases (desconto limitado a 0,1). Drivers de Jump — Posicionamento dos Braços, Posicionamento das Pernas (pernas retas, pontas dos pés esticadas, altura, aterrissagens), Sincronização: timing (limitado a 0,1).',
  },
  {
    name: 'Formations & Transitions',
    descriptionEn:
      "Starts at 2.0; reduced 0.1 for EACH formation/transition that lacks precision. A team's ability to demonstrate precise spacing and uniform movement.",
    descriptionPt:
      'Começa em 2,0; reduzido 0,1 para CADA formação/transição que carece de precisão. Capacidade da equipe de demonstrar espaçamento preciso e movimento uniforme.',
  },
  {
    name: 'Routine Creativity',
    descriptionEn:
      'Average of 3 opinions (Building, Tumbling and Overall Judges) on the incorporation of innovative, visual and intricate ideas throughout the routine. Building Judge: Entries/Transitions/Dismounts of Building skills (level and non-level appropriate), pace/connection of skills. Tumbling Judge: clear visual tumbling patterns. Overall Judge: the routine as a whole, start to finish.',
    descriptionPt:
      'Média de 3 opiniões (jurados de Building, Tumbling e Overall) sobre a incorporação de ideias inovadoras, visuais e elaboradas ao longo da rotina. Jurado de Building: entradas/transições/descidas das habilidades de building (apropriadas e não apropriadas ao nível), ritmo/conexão das habilidades. Jurado de Tumbling: padrões visuais claros de tumbling. Jurado de Overall: a rotina como um todo, do início ao fim.',
  },
  {
    name: 'Dance — Difficulty Elements',
    descriptionEn:
      'Variety of difficulty elements, with strong execution: Visual Effects, Variety of Levels, Formation Changes, Footwork, Floor Work/Use of Floor, Partner Work, Pace.',
    descriptionPt:
      'Variedade de elementos de dificuldade, com execução forte: Efeitos Visuais, Variedade de Níveis, Mudanças de Formação, Trabalho de Pés, Trabalho no Chão/Uso do Chão, Trabalho em Dupla, Ritmo.',
  },
  {
    name: 'Dance — Execution',
    descriptionEn: 'Technique, Perfection, Motion Strength/Placement, Synchronization, Uniformity, Energy/Entertainment Value.',
    descriptionPt:
      'Técnica, Perfeição, Força/Posicionamento do Movimento, Sincronização, Uniformidade, Energia/Valor de Entretenimento.',
  },
  {
    name: 'Showmanship',
    descriptionEn:
      "Average of 3 scores (Building, Tumbling and Overall Judges) on the panel's impression of the entire performance: energy, genuine enthusiasm, confidence, eye contact, facial expression. Not skill-based, but takes into account appropriate athletic impression throughout the routine.",
    descriptionPt:
      'Média de 3 notas (jurados de Building, Tumbling e Overall) sobre a impressão da banca sobre a apresentação inteira: energia, entusiasmo genuíno, confiança, contato visual, expressão facial. Não é baseado em habilidades, mas considera a impressão atlética apropriada ao longo da rotina.',
  },
];

interface StoredBand {
  name: string;
  description: string | null;
  color: string;
  min: number;
  max: number;
}

export class TranslateUssNonTumblingDescriptions1789990000000
  implements MigrationInterface
{
  name = 'TranslateUssNonTumblingDescriptions1789990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 'descriptionPt', 'bandDescriptionsPt');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 'descriptionEn', 'bandDescriptionsEn');
  }

  private async apply(
    queryRunner: QueryRunner,
    descriptionKey: 'descriptionPt' | 'descriptionEn',
    bandsKey: 'bandDescriptionsPt' | 'bandDescriptionsEn',
  ): Promise<void> {
    for (const item of TRANSLATIONS) {
      await queryRunner.query(
        `UPDATE "scoring_criteria" SET "description" = $1 WHERE template_id = $2 AND name = $3`,
        [item[descriptionKey], USS_NON_TUMBLING_COED_TEMPLATE_ID, item.name],
      );

      const bandDescriptions = item[bandsKey];
      if (!bandDescriptions) continue;

      const [row] = await queryRunner.query(
        `SELECT score_bands FROM "scoring_criteria" WHERE template_id = $1 AND name = $2`,
        [USS_NON_TUMBLING_COED_TEMPLATE_ID, item.name],
      );
      const bands: StoredBand[] = row.score_bands;
      const updated = bands.map((band, i) => ({ ...band, description: bandDescriptions[i] }));
      await queryRunner.query(
        `UPDATE "scoring_criteria" SET score_bands = $1::jsonb WHERE template_id = $2 AND name = $3`,
        [JSON.stringify(updated), USS_NON_TUMBLING_COED_TEMPLATE_ID, item.name],
      );
    }
  }
}
