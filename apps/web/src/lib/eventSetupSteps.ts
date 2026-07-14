import type { Event } from "@/api/client";

export type SetupStepKey = "categories" | "regulation" | "teams";
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

export function buildSetupSteps(event: Event): SetupStep[] {
  const categoriesCount = event.categoriesCount ?? 0;
  const teamsCount = event.teamsCount ?? 0;

  return [
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
      key: "regulation",
      title: "Regulamento e regras de pontuação",
      shortTitle: "Regulamento",
      description: "Defina as regras de competição e os critérios de pontuação do evento.",
      completed: false,
      detail: "Disponível em breve",
      updatedAt: null,
      actionLabel: "Iniciar cadastro",
    },
    {
      key: "teams",
      title: "Competidores",
      shortTitle: "Competidores",
      description: "Cadastre as equipes que vão participar do evento.",
      completed: teamsCount > 0,
      detail:
        teamsCount > 0
          ? `${teamsCount} ${teamsCount === 1 ? "equipe cadastrada" : "equipes cadastradas"}`
          : "Nenhuma equipe cadastrada",
      updatedAt: event.teamsUpdatedAt,
      actionLabel: teamsCount > 0 ? "Editar equipes" : "Iniciar cadastro",
    },
  ];
}

export function computeStepState(steps: SetupStep[], index: number): SetupStepState {
  if (steps[index].completed) return "completed";
  const firstIncompleteIndex = steps.findIndex((s) => !s.completed);
  return index === firstIncompleteIndex ? "in_progress" : "not_started";
}
