import type { Event } from "@/api/client";

export type SetupStepKey = "categories" | "regulation" | "programs" | "judgePanel" | "schedule";
export type SetupStepState = "completed" | "in_progress" | "not_started";

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  shortTitle: string;
  description: string;
  completed: boolean;
  // Verdadeiro quando a etapa já tem algum progresso real (não só
  // "primeira etapa incompleta da sequência", que é o que
  // computeStepState calcula pro stepper do topo) mas ainda não está
  // concluída — usado pelo card individual (SetupStepCard) pra mostrar
  // "Em andamento" em vez de "Não iniciado". Por enquanto só
  // calculado pra `judgePanel`; as demais etapas não têm essa
  // distinção ainda.
  inProgress?: boolean;
  detail: string;
  updatedAt?: string | null;
  actionLabel: string;
  // Só definido para etapas que já têm uma tela de cadastro construída
  // — as demais mostram o botão desabilitado ("disponível em breve").
  href?: string;
}

// Montado em EventSetupPage a partir de regulationApi.get(id) (docs) +
// eventScoringTemplatesApi.list(id) (2026-08-02: hasCompleteTemplate
// passou a exigir pelo menos um sistema de pontuação SELECIONADO pra
// este evento — ver ScoringTemplatesSummarySection — completo, não só
// existir em algum lugar da biblioteca do usuário) — ver RegulationPage.
export interface RegulationSummary {
  hasOfficialRegulation: boolean;
  hasSafetyRules: boolean;
  hasCompleteTemplate: boolean;
  updatedAt: string | null;
}

// Montado em EventSetupPage a partir de scheduleApi.listDays(id) (todas
// as entries de todos os dias) + scheduleApi.getUnscheduled(id, dayId)
// (pares equipe/categoria ainda sem apresentação marcada NAQUELE dia)
// — ver SchedulePage. Cada equipe/categoria precisa de uma
// apresentação em CADA dia do evento (não uma vez só no evento inteiro
// — ver ScheduleService), então `totalPairs`/`unscheduledCount` já vêm
// somados por todos os dias (tamanho do catálogo × número de dias).
// `hasScheduledComponent` conta só componentes "de verdade" (Almoço,
// Contestação de notas, Abertura, Premiação, intervalo personalizado —
// entries sem linkedEntryId), não os intervalos "Aguardando
// aquecimento"/"Aguardando disponibilidade da equipe" que o próprio
// agendamento de uma apresentação insere automaticamente (esses têm
// linkedEntryId apontando pra ela, ver ScheduleService).
export interface ScheduleSummary {
  totalPairs: number;
  unscheduledCount: number;
  hasScheduledPresentation: boolean;
  hasScheduledComponent: boolean;
  updatedAt: string | null;
}

// Montado em EventSetupPage a partir de programsApi.list(id) +
// teamsApi.listForEvent(id) (todas as equipes do evento, com
// `categories` já carregado — ver EventTeamsController). A etapa só
// conta como concluída com as 3 condições ao mesmo tempo (2026-08-05,
// a pedido do usuário — antes bastava `programsCount > 0`, o que
// deixava passar evento com programa/equipe "órfã", sem categoria
// nenhuma vinculada):
// 1. `hasAnyTeamInCategory` — pelo menos uma equipe, de algum
//    programa, já está vinculada a uma categoria (senão a etapa nem
//    começou de verdade).
// 2. `allProgramsHaveTeams` — nenhum programa cadastrado está sem
//    NENHUMA equipe.
// 3. `allTeamsInCategory` — nenhuma equipe cadastrada está sem
//    NENHUMA categoria vinculada.
// (1) fica redundante com (2)+(3) na prática (se todo programa tem
// equipe e toda equipe tem categoria, e há pelo menos um programa,
// então (1) já é verdade) — mantido explícito mesmo assim porque é
// exatamente a condição pedida, e protege contra o dia em que (2)/(3)
// mudarem de regra separadamente.
export interface ProgramsSummary {
  programsCount: number;
  teamsCount: number;
  hasAnyTeamInCategory: boolean;
  allProgramsHaveTeams: boolean;
  allTeamsInCategory: boolean;
  updatedAt: string | null;
}

// Escala de arbitragem só conta como concluída com as duas condições
// atendidas — mensagem precisa conforme o que ainda falta.
function judgePanelDetail(hasLegalityJudge: boolean, allTemplatesJudgingComplete: boolean): string {
  if (hasLegalityJudge && allTemplatesJudgingComplete) {
    return "Jurado de Legalidade definido e sistemas de pontuação 100% cobertos";
  }
  if (!hasLegalityJudge && !allTemplatesJudgingComplete) {
    return "Pendente: definir o Jurado de Legalidade e concluir os sistemas de pontuação";
  }
  if (!hasLegalityJudge) {
    return "Pendente: definir o Jurado de Legalidade";
  }
  return "Pendente: concluir todos os sistemas de pontuação";
}

function programsDetail(summary: ProgramsSummary, completed: boolean): string {
  if (summary.programsCount === 0) return "Nenhum programa cadastrado";
  if (completed) {
    const programWord = summary.programsCount === 1 ? "programa" : "programas";
    const teamWord = summary.teamsCount === 1 ? "equipe" : "equipes";
    return `${summary.programsCount} ${programWord} e ${summary.teamsCount} ${teamWord}, todos participando de alguma categoria`;
  }
  if (!summary.allProgramsHaveTeams) {
    return "Pendente: há programa cadastrado sem nenhuma equipe";
  }
  if (!summary.allTeamsInCategory) {
    return "Pendente: há equipe cadastrada sem categoria vinculada";
  }
  return "Pendente: vincule ao menos uma equipe a uma categoria";
}

function scheduleDetail(
  summary: ScheduleSummary,
  completed: boolean,
  inProgress: boolean,
): string {
  if (completed) return "Todas as apresentações já foram agendadas";
  if (inProgress) {
    return `${summary.unscheduledCount} de ${summary.totalPairs} apresentações ainda não agendadas`;
  }
  return "Monte a timeline de apresentações do evento";
}

export function buildSetupSteps(
  event: Event,
  regulation: RegulationSummary | null,
  hasLegalityJudge: boolean,
  allTemplatesJudgingComplete: boolean,
  hasAnyJudge: boolean,
  schedule: ScheduleSummary,
  programs: ProgramsSummary,
): SetupStep[] {
  const categoriesCount = event.categoriesCount ?? 0;
  const judgePanelCompleted = hasLegalityJudge && allTemplatesJudgingComplete;
  const programsCompleted =
    programs.hasAnyTeamInCategory && programs.allProgramsHaveTeams && programs.allTeamsInCategory;
  const regulationCompleted =
    !!regulation &&
    regulation.hasOfficialRegulation &&
    regulation.hasSafetyRules &&
    regulation.hasCompleteTemplate;
  const scheduleCompleted = schedule.totalPairs > 0 && schedule.unscheduledCount === 0;
  const scheduleInProgress =
    !scheduleCompleted && (schedule.hasScheduledPresentation || schedule.hasScheduledComponent);

  return [
    {
      key: "regulation",
      title: "Regulamentos",
      shortTitle: "Regulamento",
      description: "Defina as regras de competição, segurança e pontuação do evento.",
      completed: regulationCompleted,
      detail: regulationCompleted
        ? "Documentos e template de pontuação prontos"
        : "Pendente: documentos obrigatórios e um template completo",
      updatedAt: regulation?.updatedAt ?? null,
      actionLabel: regulationCompleted ? "Editar regulamento" : "Iniciar cadastro",
      href: `/events/${event.aliasId}/regulation`,
    },
    {
      key: "categories",
      title: "Categorias",
      shortTitle: "Categorias",
      description: "Cadastre todas as categorias que estarão presentes no seu evento.",
      completed: categoriesCount > 0,
      detail:
        categoriesCount > 0
          ? `${categoriesCount} ${categoriesCount === 1 ? "categoria cadastrada" : "categorias cadastradas"}`
          : "Nenhuma categoria cadastrada",
      updatedAt: event.categoriesUpdatedAt,
      actionLabel: categoriesCount > 0 ? "Editar categorias" : "Iniciar cadastro",
      href: `/events/${event.aliasId}/categories`,
    },
    {
      key: "programs",
      title: "Programas e equipes",
      shortTitle: "Programas e equipes",
      description: "Cadastre os programas e as equipes que vão participar do evento.",
      completed: programsCompleted,
      inProgress: !programsCompleted && programs.programsCount > 0,
      detail: programsDetail(programs, programsCompleted),
      updatedAt: programs.updatedAt,
      actionLabel: programs.programsCount > 0 ? "Editar programas" : "Iniciar cadastro",
      href: `/events/${event.aliasId}/programs`,
    },
    {
      // Cronograma vem antes de Painel de jurados nesta lista (pedido
      // explícito do usuário) — a ordem do array é o que
      // `firstIncomplete`/`computeStepState` usam pra decidir a etapa
      // "recomendada", e também o que define o número do card
      // (stepNumber = index+1 em EventSetupPage).
      key: "schedule",
      title: "Cronograma",
      shortTitle: "Cronograma",
      description: "Monte a ordem de apresentação das equipes durante o evento.",
      completed: scheduleCompleted,
      inProgress: scheduleInProgress,
      detail: scheduleDetail(schedule, scheduleCompleted, scheduleInProgress),
      updatedAt: schedule.updatedAt,
      actionLabel: scheduleCompleted || scheduleInProgress ? "Editar cronograma" : "Iniciar cadastro",
      href: `/events/${event.aliasId}/schedule`,
    },
    {
      key: "judgePanel",
      title: "Painel de jurados",
      shortTitle: "Painel de jurados",
      description: "Cadastre os jurados do evento e defina o que cada um irá julgar em cada sistema de pontuação.",
      completed: judgePanelCompleted,
      inProgress: !judgePanelCompleted && hasAnyJudge,
      detail: judgePanelDetail(hasLegalityJudge, allTemplatesJudgingComplete),
      updatedAt: null,
      actionLabel: judgePanelCompleted ? "Editar escala de arbitragem" : "Iniciar cadastro",
      href: `/events/${event.aliasId}/judging`,
    },
  ];
}

export function computeStepState(steps: SetupStep[], index: number): SetupStepState {
  if (steps[index].completed) return "completed";
  const firstIncompleteIndex = steps.findIndex((s) => !s.completed);
  return index === firstIncompleteIndex ? "in_progress" : "not_started";
}
