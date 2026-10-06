import type { CategoryFormat } from "@/api/client";

// Tempo padrão de apresentação: ver defaultPresentationTimeSeconds em
// lib/categoryCriteria.ts (depende dos critérios do evento).

// Só pré-preenche o campo (usuário ajusta antes de salvar). Diferente da
// duração de apresentação, só varia por formato — Team Cheer pede um
// preparo bem maior que uma passagem de stunt de 1min.
export function getDefaultWarmupMinutes(categoryFormat: CategoryFormat): number {
  return categoryFormat === "team_cheer" ? 10 : 5;
}

export function secondsToMinutesAndSeconds(totalSeconds: number): {
  minutes: number;
  seconds: number;
} {
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatMinutesSeconds(totalSeconds: number): string {
  const { minutes, seconds } = secondsToMinutesAndSeconds(totalSeconds);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
