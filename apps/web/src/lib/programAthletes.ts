import { differenceInYears, parseISO } from "date-fns";
import type { ProgramAthlete, Team } from "@/api/client";

export function athleteName(a: Pick<ProgramAthlete, "firstName" | "lastName">): string {
  return a.lastName ? `${a.firstName} ${a.lastName}` : a.firstName;
}

export function athleteInitials(a: Pick<ProgramAthlete, "firstName" | "lastName">): string {
  return `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`.toUpperCase();
}

// null sem data de nascimento.
export function athleteAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  return differenceInYears(new Date(), parseISO(birthDate));
}

export function entryKey(teamId: string, categoryId: string): string {
  return `${teamId}:${categoryId}`;
}

// Situação da equipe, só informativa (atletas são opcionais e nada
// bloqueia publicar o evento).
export type TeamSituation = "no_category" | "no_athletes" | "complete";

export function teamSituation(team: Team): TeamSituation {
  if (team.categories.length === 0) return "no_category";
  if (team.categories.some((c) => (c.athletesCount ?? 0) === 0)) return "no_athletes";
  return "complete";
}

export const TEAM_SITUATION_LABELS: Record<TeamSituation, string> = {
  no_category: "Sem categoria",
  no_athletes: "Sem atletas",
  complete: "Completa",
};

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
