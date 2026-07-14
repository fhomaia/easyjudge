import type {
  CategoryDivision,
  CategoryFormat,
  CategoryModality,
  CategoryStatus,
} from "@/api/client";

export const MODALITY_LABELS: Record<CategoryModality, string> = {
  all_star: "All Star",
  university: "Universitário",
  school: "Escolar",
};

export const DIVISION_LABELS: Record<CategoryDivision, string> = {
  coed: "COED",
  all_girl: "All Girl",
  all_boy: "All Boy",
};

export const FORMAT_LABELS: Record<CategoryFormat, string> = {
  team_cheer: "Team Cheer",
  group_stunt: "Group Stunt",
  coed: "Coed",
  partner: "Partner",
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

// Nome automático de uma categoria criada em lote (por nível): junção
// de formato, modalidade, divisão e nível, nessa ordem — decisão do
// usuário pra evitar nomes duplicados ao criar uma categoria por nível
// selecionado.
export function buildCategoryName(
  categoryFormat: CategoryFormat,
  modality: CategoryModality,
  division: CategoryDivision,
  level: number,
  customFormatLabel?: string | null,
): string {
  const formatLabel = formatLabelFor(categoryFormat, customFormatLabel);
  return `${formatLabel} ${MODALITY_LABELS[modality]} ${DIVISION_LABELS[division]} Nível ${level}`;
}
