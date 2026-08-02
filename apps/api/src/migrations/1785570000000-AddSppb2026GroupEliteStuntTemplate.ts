import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_SCORING_TEMPLATES_OWNER_ID } from './1785560000000-AddSystemScoringTemplates';

// Primeiro modelo de sistema com conteúdo real (2026-08-02) — ver
// project_system_scoring_templates na memória: um modelo por
// migration, conteúdo passado pelo usuário, nunca inventado aqui.
// Fonte: Sistema de Produtores Privados Brasileiros (SPPB) 2026, pras
// categorias Group Stunt, Elite Stunt e Partner Stunt (mesma estrutura
// de pontuação serve pras três — um template só, reutilizável ao
// atribuir a categoria).
export const SPPB_2026_GROUP_ELITE_STUNT_TEMPLATE_ID =
  '4f6a6e2e-2b8e-4b7a-9e0a-000000000001';
const TEMPLATE_ID = SPPB_2026_GROUP_ELITE_STUNT_TEMPLATE_ID;

interface Band {
  name: string;
  description: string;
  color: string;
  min: number;
  max: number;
}

// Mesmas 4 faixas (min/max) em todo item de avaliação, texto de
// descrição muda por item — cores seguem a paleta VIBRANT_COLORS já
// usada pelo builder (ScoreBandsEditor), numa progressão ruim -> boa
// mais intuitiva que a ordem default do picker.
function bands(texts: [string, string, string, string]): Band[] {
  return [
    { name: 'Insuficiente', description: texts[0], color: '#ef4444', min: 0, max: 0 },
    { name: 'Abaixo do Esperado', description: texts[1], color: '#f97316', min: 0, max: 0 },
    { name: 'Bom/Muito Bom', description: texts[2], color: '#3b82f6', min: 0, max: 0 },
    { name: 'Excelente', description: texts[3], color: '#22c55e', min: 0, max: 0 },
  ];
}

// Aplica os limites min/max de cada faixa (iguais em vários itens, só
// o maxScore final muda) por cima do texto já montado em `bands`.
function withRange(list: Band[], edges: [number, number, number, number, number]): Band[] {
  return list.map((band, i) => ({ ...band, min: edges[i], max: edges[i + 1] }));
}

interface CriterionSeed {
  name: string;
  description: string;
  maxScore: number;
  bands: Band[];
}

interface GroupSeed {
  name: string;
  children: CriterionSeed[];
}

const GROUPS: GroupSeed[] = [
  {
    name: 'Construções',
    children: [
      {
        name: 'Dificuldade',
        description:
          'Dificuldade inerente da sequência. Variedade e combinações: utilização de famílias diferentes de habilidade ou combinações de famílias. Ritmo da sequência: fluidez de um elemento para o outro ou se possui muitas pausas.',
        maxScore: 20,
        bands: withRange(
          bands([
            'Não apresenta basket. Não apresenta desmontes. Não apresenta figuras. Menos de 3 dos elementos de dificuldade são compatíveis com o nível inscrito. Elementos principais fora do nível (acima ou abaixo) que descaracterizam a proposta.',
            'Não apresenta basket, ou apresenta basket abaixo do nível esperado ou basket do nível com altura muito abaixo do esperado. Apresenta pelo menos 1 desmonte. Figuras simples, com pouca variação. Apresenta pelo menos 4 elementos do nível, porém a maioria é básica/simples para o nível. Ritmo fraco, poucas combinações e pouca variedade de elementos para o nível.',
            'Apresenta basket com boa altura, com dificuldade dentro do esperado para o nível, ou apresenta boa dificuldade com altura apenas baixa/esperada. Apresenta pelo menos 5 elementos do nível. Apresenta 2 desmontes. Dificuldade esperada para o nível. Ritmo, combinações, variedade e fluidez dentro do esperado (ou levemente abaixo). Figuras simples combinadas com elementos de dificuldade, ou figuras mais complexas separadas dos elementos de dificuldade.',
            'Apresenta basket com dificuldade alta e excelente altura. Apresenta pelo menos 6 elementos do nível, incluindo 2 desmontes. Uso de figuras difíceis e complexas integradas aos elementos de dificuldade. Ritmo, combinações, variedade e fluidez acima do esperado para o nível.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
      {
        name: 'Execução da flyer',
        description:
          'Execução: controle corporal da flyer nos movimentos; posturas de pernas, tronco e braços. Estabilidade: sem movimentações excessivas; precisão nos elementos. Flexibilidade: demonstração de figuras com boa flexibilidade, postura correta e sem desvios de padrão.',
        maxScore: 20,
        bands: withRange(
          bands([
            'Controle corporal insuficiente; perda frequente de postura (pernas, tronco e/ou braços) durante os elementos, com perda de centralidade e instabilidade constante, comprometendo a apresentação dos movimentos e resultando em múltiplas quedas. Falta de precisão nos elementos (posições soltas, desalinhadas, com variações grandes durante a execução). Flexibilidade não demonstrada, ou figuras executadas sem postura adequada e com desvios claros de padrão.',
            'Controle corporal abaixo do esperado; postura varia ao longo dos elementos (pernas/torso/braços), mas sem colapsar o elemento por completo. Instabilidade presente (ajustes visíveis, tremores, movimentações), porém ainda permite concluir a maioria das posições. Precisão inconsistente; algumas posições bem definidas, outras com falta de alinhamento e finalização. Flexibilidade demonstrada de forma simples, porém com postura irregular ou desvios de padrão em parte das figuras. Limpeza geral abaixo do esperado para o nível, com pouca consistência entre os elementos.',
            'Bom controle corporal; posturas de pernas, tronco e braços majoritariamente corretas e bem sustentadas. Estabilidade dentro do esperado; pequenas movimentações podem ocorrer, mas sem excesso e sem comprometer a execução. Boa precisão nos elementos, com linhas mais consistentes e finalizações claras. Flexibilidade presente quando aplicada; figuras simples com boa postura na maior parte do tempo e desvios pequenos/ocasionalmente ou figuras complexas com execução abaixo do esperado. Execução consistente na maior parte da sequência, com limpeza adequada para o nível.',
            'Excelente controle corporal; posturas muito bem trabalhadas e sustentadas (pernas, tronco e braços) com consistência. Alta estabilidade; praticamente sem movimentações excessivas, com aparência sólida e controlada. Precisão e linhas muito claras; elementos bem definidos, limpos e com ótima finalização. Flexibilidade muito bem demonstrada; figuras com ótima amplitude, postura correta e sem desvios de padrão. Execução acima do esperado para o nível, com alto padrão de limpeza e consistência em toda a sequência.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
      {
        name: 'Execução das bases',
        description:
          'Execução: controle corporal das bases; posturas de pernas, tronco e braços. Precisão e firmeza: precisão na realização dos elementos, chegando na altura pretendida, sem necessidade de ajustes. Pés estacionários: sem movimentações laterais ou para frente e para trás para ajustar a estabilidade do stunt.',
        maxScore: 20,
        bands: withRange(
          bands([
            'Controle corporal insuficiente; postura de pernas, tronco e/ou braços compromete a execução do elemento. Falta de firmeza evidente; dificuldade para chegar na altura pretendida ou manter a posição. Ajustes constantes e grandes durante os elementos (reposicionamentos visíveis para salvar o stunt). Bases precisam mover os pés com frequência (lateral/para frente/para trás) para buscar estabilidade. Execução inconsistente e instável, abaixo do mínimo esperado para o nível.',
            'Controle corporal abaixo do esperado; posturas variam durante os elementos, com perda parcial de alinhamento. Precisão irregular; chega na altura pretendida em alguns elementos, mas em outros há queda de altura ou demora para estabilizar. Ajustes presentes (mãos, pegadas, base de apoio), porém menores que no Insuficiente. Pés estacionários inconsistentes; movimentações para ajustar estabilidade aparecem em parte da rotina. Firmeza geral abaixo do esperado para o nível, com pouca consistência entre os elementos.',
            'Bom controle corporal; posturas de pernas, tronco e braços majoritariamente corretas. Precisão dentro do esperado; chega na altura pretendida na maioria dos elementos, com poucos ajustes. Boa firmeza na sustentação; pequenas correções podem ocorrer, mas sem comprometer o elemento. Pés geralmente estacionários; movimentações são raras e discretas. Execução consistente na maior parte da sequência, com estabilidade adequada para o nível.',
            'Excelente controle corporal; posturas muito bem trabalhadas e consistentes (pernas, tronco e braços). Alta precisão e firmeza; chega na altura pretendida com facilidade e mantém o elemento sem ajustes. Pegadas e transições muito limpas, com estabilidade evidente em todos os elementos. Pés completamente estacionários; sem deslocamentos laterais ou para frente/para trás para estabilizar. Execução acima do esperado para o nível, com alto padrão de consistência, controle e segurança.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
    ],
  },
  {
    name: 'Overall/Performance Geral',
    children: [
      {
        name: 'Transições',
        description:
          'Ritmo e transições fluidas: avalia a fluidez da rotina, garantindo que os elementos se conectem de maneira natural, sem interrupções abruptas, otimizando a performance visual. Inovação e criatividade: capacidade da equipe de incorporar ideias inovadoras, visuais e criativas na composição da sequência e na entrada e saída dos stunts. Motions: precisão e execução clara e dinâmica dos motions, garantindo alinhamento com a estrutura da rotina e contribuindo para a estética e expressividade da apresentação.',
        maxScore: 10,
        bands: withRange(
          bands([
            'Transições travadas, com interrupções abruptas e perda frequente de ritmo entre elementos. Conexões pouco naturais; entradas e saídas de stunts quebradas, com pausas longas ou desorganização. Pouca ou nenhuma criatividade visível; sequência básica, repetitiva e com baixa variação. Motions imprecisos, sem clareza, desalinhados ou inconsistentes, prejudicando a estética da apresentação. Fluidez geral abaixo do mínimo esperado, com impacto direto na leitura visual da rotina.',
            'Ritmo irregular; transições com pausas perceptíveis ou pequenas quebras de continuidade. Entradas e saídas de stunts simples, com poucas conexões e pouca variação visual. Criatividade limitada; poucas ideias diferentes e baixo uso de recursos visuais. Motions com execução inconsistente; alguns claros, outros com falta de precisão e alinhamento. Fluidez abaixo do esperado para o nível, porém a sequência ainda se mantém compreensível.',
            'Ritmo dentro do esperado; transições majoritariamente fluidas, com poucas interrupções. Boas conexões entre elementos; entradas e saídas mais naturais e organizadas. Criatividade presente; algumas ideias visuais e variações na composição da sequência. Motions claros e bem executados na maior parte do tempo, com alinhamento e dinâmica adequados. Fluidez consistente na maior parte da rotina, contribuindo para uma boa leitura visual.',
            'Ritmo excelente; transições muito fluidas, sem quebras, com continuidade natural entre os elementos. Entradas e saídas de stunts muito bem conectadas, otimizando a performance visual e o impacto da sequência. Alto nível de inovação e criatividade; ideias visuais marcantes, variações e composição bem trabalhada. Motions muito precisos, claros, dinâmicos e alinhados com a estrutura da rotina, elevando a estética e a expressividade. Fluidez acima do esperado para o nível, com grande qualidade visual e consistência do início ao fim.',
          ]),
          [0, 1, 4, 7, 10],
        ),
      },
      {
        name: 'Composição de rotina',
        description:
          'Efeitos visuais: a capacidade do grupo de construir uma sequência de forma estratégica, com efeitos visuais inteligentes e com um impacto visual elevado. Complexidade e uso de código: a capacidade do grupo de utilizar o código de forma estratégica, incorporando ideias inovadoras, criativas e difíceis na composição da sequência, sem ilegalidades. Variedade: a capacidade do grupo de explorar as diferentes possibilidades para o nível.',
        maxScore: 10,
        bands: withRange(
          bands([
            'Composição fraca e pouco estratégica; baixo impacto visual e pouca intenção na construção da sequência. Múltiplas ilegalidades na rotina (repetidas ou em diferentes momentos), afetando diretamente a estrutura e a credibilidade do uso do código. Complexidade muito abaixo do esperado; escolhas básicas e pouco trabalhadas para o nível. Variedade mínima; repetição de padrões e poucas opções exploradas dentro do nível. Leitura visual desorganizada, com pouca coerência e pouco aproveitamento.',
            'Composição simples; efeitos visuais limitados e impacto visual apenas moderado ou inconsistente. Algumas ilegalidades presentes (mais de uma), o que mostra uso do código pouco controlado e reduz a qualidade da composição. Complexidade abaixo do esperado; poucas ideias inovadoras e pouco risco criativo. Variedade baixa; explora poucas possibilidades do nível e repete estruturas semelhantes. Estrutura compreensível, mas sem construção estratégica consistente ao longo da sequência.',
            'Composição dentro do esperado; bons efeitos visuais em alguns momentos e sequência bem organizada na maior parte do tempo. Pelo menos uma ilegalidade identificada, o que limita a nota máxima, mesmo que a composição seja bem construída. Complexidade adequada para o nível; inclui algumas ideias criativas e dificuldades coerentes com a proposta. Variedade presente; explora mais de uma possibilidade do nível, mesmo que ainda haja espaço para ampliar. Boa leitura visual e coerência geral, com construção relativamente estratégica.',
            'Composição excelente e muito estratégica; efeitos visuais inteligentes e impacto visual elevado ao longo de toda a sequência. Uso do código muito bem aplicado, com escolhas criativas, inovadoras e difíceis, sem ilegalidades. Alta complexidade com boa construção; sequência bem pensada, com recursos visuais consistentes e bem distribuídos. Variedade alta; explora diversas possibilidades do nível, evitando repetição e mantendo interesse visual. Rotina com excelente coerência e leitura visual, com início, desenvolvimento e final bem conectados e fortes.',
          ]),
          [0, 1, 4, 7, 10],
        ),
      },
      {
        name: 'Performance',
        description:
          'Perfeição: a capacidade do grupo de executar todos os elementos propostos com precisão e excelência, demonstrando controle absoluto e domínio técnico. Energia e entretenimento: a habilidade do grupo de performar com intensidade, entusiasmo e impacto, garantindo que a apresentação seja envolvente e cativante para o público. Confiança e showmanship: a capacidade do grupo de executar a rotina com maestria e atletismo, transmitindo expressividade, carisma e conexão visual com a torcida, elevando o impacto da performance.',
        maxScore: 20,
        bands: withRange(
          bands([
            'Execução sem consistência; falta de controle e de domínio técnico na maior parte da sequência. Energia baixa ou irregular; apresentação pouco envolvente e com pouca intenção de entretenimento. Pouca confiança em cena; expressividade limitada, pouca conexão visual e showmanship quase inexistente. Ritmo de performance instável, com quebras claras de presença e apagões durante a rotina. Impacto geral abaixo do mínimo esperado para o nível.',
            'Controle técnico abaixo do esperado; alguns momentos bons, mas sem consistência ao longo da sequência. Energia moderada, porém irregular; impacto limitado e pouca sustentação de intensidade. Confiança em cena varia; showmanship presente em alguns momentos, mas não se mantém. Expressividade e conexão visual inconsistentes; falta de unidade do grupo na apresentação. Performance abaixo do esperado para o nível, mas com potencial perceptível.',
            'Boa execução geral; controle e precisão dentro do esperado na maior parte dos elementos. Energia boa e mais constante; apresentação envolvente na maior parte do tempo. Confiança presente; showmanship e conexão visual aparecem com consistência, com pequenas oscilações. Expressividade e presença de palco adequadas para o nível, com bom impacto geral. Performance consistente e alinhada ao nível, com alguns pontos claros para elevar ao Excelente.',
            'Execução com alto padrão de precisão; excelente controle e domínio técnico em todos os elementos propostos. Energia alta e constante; apresentação intensa, empolgante e cativante do início ao fim. Confiança máxima; showmanship forte, carisma e expressividade bem trabalhados, com ótima conexão visual com a torcida. Presença de palco muito acima do esperado, elevando o impacto visual e emocional da rotina. Performance excelente, com identidade clara e consistência total durante toda a sequência.',
          ]),
          [0, 10, 13.5, 17, 20],
        ),
      },
    ],
  },
];

export class AddSppb2026GroupEliteStuntTemplate1785570000000
  implements MigrationInterface
{
  name = 'AddSppb2026GroupEliteStuntTemplate1785570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const targetScore = GROUPS.reduce(
      (sum, group) => sum + group.children.reduce((s, c) => s + c.maxScore, 0),
      0,
    );

    await queryRunner.query(
      `INSERT INTO "scoring_templates" ("id", "name", "description", "target_score", "created_by_id", "is_system_template", "source") VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [
        TEMPLATE_ID,
        'Group Stunt, Elite Stunt e Partner Stunt',
        'Modelo oficial para as categorias Group Stunt, Elite Stunt e Partner Stunt.',
        targetScore,
        SYSTEM_SCORING_TEMPLATES_OWNER_ID,
        'Sistema de Produtores Privados Brasileiros (SPPB)',
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
          `INSERT INTO "scoring_criteria" ("id", "template_id", "parent_id", "type", "name", "description", "max_score", "order", "use_score_bands", "score_bands") VALUES ($1, $2, $3, 'score_item', $4, $5, $6, $7, true, $8::jsonb)`,
          [
            randomUUID(),
            TEMPLATE_ID,
            groupId,
            child.name,
            child.description,
            child.maxScore,
            childOrder,
            JSON.stringify(child.bands),
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // scoring_criteria tem ON DELETE CASCADE em template_id — apagar o
    // template já leva os 8 critérios juntos.
    await queryRunner.query(`DELETE FROM "scoring_templates" WHERE "id" = $1`, [
      TEMPLATE_ID,
    ]);
  }
}
