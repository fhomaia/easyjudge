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
// scoringTemplatesApi.list() (template completo) — ver RegulationPage.
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
): SetupStep[] {
  const categoriesCount = event.categoriesCount ?? 0;
  const programsCount = event.programsCount ?? 0;
  const judgePanelCompleted = hasLegalityJudge && allTemplatesJudgingComplete;
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
      href: `/events/${event.id}/regulation`,
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
      href: `/events/${event.id}/categories`,
    },
    {
      key: "programs",
      title: "Programas e equipes",
      shortTitle: "Programas e equipes",
      description: "Cadastre os programas e as equipes que vão participar do evento.",
      completed: programsCount > 0,
      detail:
        programsCount > 0
          ? `${programsCount} ${programsCount === 1 ? "programa cadastrado" : "programas cadastrados"}`
          : "Nenhum programa cadastrado",
      updatedAt: event.programsUpdatedAt,
      actionLabel: programsCount > 0 ? "Editar programas" : "Iniciar cadastro",
      href: `/events/${event.id}/programs`,
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
      href: `/events/${event.id}/schedule`,
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
      href: `/events/${event.id}/judging`,
    },
  ];
}

export function computeStepState(steps: SetupStep[], index: number): SetupStepState {
  if (steps[index].completed) return "completed";
  const firstIncompleteIndex = steps.findIndex((s) => !s.completed);
  return index === firstIncompleteIndex ? "in_progress" : "not_started";
}
