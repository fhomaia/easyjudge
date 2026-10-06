import type { CategoryFormat, CategoryStatus } from "@/api/client";

// Nomenclatura da plataforma x nomes no código:
// - "Modalidade" na tela = `categoryFormat` (FORMAT_LABELS: Team Cheer,
//   Group Stunt, Elite Stunt...);
// - os demais (Vínculo institucional, Regime, Faixa etária, Gênero,
//   Nível, Tamanho) são critérios de divisão configuráveis por evento,
//   ver lib/categoryCriteria.ts.
export const FORMAT_LABELS: Record<CategoryFormat, string> = {
  team_cheer: "Team Cheer",
  group_stunt: "Group Stunt",
  coed: "Elite Stunt",
  partner: "Partner Stunt",
  custom: "Custom",
};

export const STATUS_LABELS: Record<CategoryStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
};

// Group Stunt, Coed e Partner são sempre non-tumbling — o campo nem
// aparece no formulário pra esses formatos (decisão do usuário).
const ALWAYS_NON_TUMBLING_FORMATS: CategoryFormat[] = ["group_stunt", "coed", "partner"];

export function isAlwaysNonTumbling(categoryFormat: CategoryFormat): boolean {
  return ALWAYS_NON_TUMBLING_FORMATS.includes(categoryFormat);
}

// Rótulo do formato pra exibição — quando é "custom", usa o nome que o
// usuário digitou (customFormatLabel) no lugar do rótulo genérico "Custom".
export function formatLabelFor(
  categoryFormat: CategoryFormat,
  customFormatLabel?: string | null,
): string {
  if (categoryFormat === "custom" && customFormatLabel) return customFormatLabel;
  return FORMAT_LABELS[categoryFormat];
}
