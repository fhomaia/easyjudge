import type { Event } from "@/api/client";

export type SetupStepKey = "categories" | "regulation" | "teams" | "judgePanel" | "schedule";
export type SetupStepState = "completed" | "in_progress" | "not_started";

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  shortTitle: string;
  description: string;
  completed: boolean;
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

export function buildSetupSteps(
  event: Event,
  regulation: RegulationSummary | null,
): SetupStep[] {
  const categoriesCount = event.categoriesCount ?? 0;
  const teamsCount = event.teamsCount ?? 0;
  const regulationCompleted =
    !!regulation &&
    regulation.hasOfficialRegulation &&
    regulation.hasSafetyRules &&
    regulation.hasCompleteTemplate;

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
      key: "teams",
      title: "Programas e equipes",
      shortTitle: "Programas e equipes",
      description: "Cadastre as equipes que vão participar do evento.",
      completed: teamsCount > 0,
      detail:
        teamsCount > 0
          ? `${teamsCount} ${teamsCount === 1 ? "equipe cadastrada" : "equipes cadastradas"}`
          : "Nenhuma equipe cadastrada",
      updatedAt: event.teamsUpdatedAt,
      actionLabel: teamsCount > 0 ? "Editar equipes" : "Iniciar cadastro",
    },
    {
      key: "judgePanel",
      title: "Painel de jurados",
      shortTitle: "Painel de jurados",
      description: "Cadastre os jurados do evento e defina o que cada um irá julgar em cada sistema de pontuação.",
      completed: false,
      detail: "Disponível em breve",
      updatedAt: null,
      actionLabel: "Iniciar cadastro",
    },
    {
      key: "schedule",
      title: "Cronograma",
      shortTitle: "Cronograma",
      description: "Monte a ordem de apresentação das equipes durante o evento.",
      completed: false,
      detail: "Disponível em breve",
      updatedAt: null,
      actionLabel: "Iniciar cadastro",
    },
  ];
}

export function computeStepState(steps: SetupStep[], index: number): SetupStepState {
  if (steps[index].completed) return "completed";
  const firstIncompleteIndex = steps.findIndex((s) => !s.completed);
  return index === firstIncompleteIndex ? "in_progress" : "not_started";
}
