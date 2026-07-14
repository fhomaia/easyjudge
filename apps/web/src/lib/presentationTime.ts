import type { CategoryFormat, CategoryModality } from "@/api/client";

// Usado pra pré-preencher o campo (usuário pode ajustar antes de
// salvar) e recalculado sempre que formato/modalidade mudam no form —
// ver CreateCategoryDialog/EditCategoryDialog. Essa duração alimenta o
// cronograma do evento numa etapa futura.
export function getDefaultPresentationTimeSeconds(
  categoryFormat: CategoryFormat,
  modality: CategoryModality,
): number {
  if (categoryFormat === "team_cheer") {
    return modality === "school" || modality === "university" ? 165 : 150;
  }
  return 60;
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
