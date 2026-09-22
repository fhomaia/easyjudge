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

// Mesmo raciocínio de getDefaultPresentationTimeSeconds acima: só
// pré-preenche o campo (usuário ajusta antes de salvar). Diferente da
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
