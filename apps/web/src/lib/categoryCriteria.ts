import type {
  Category,
  CategoryCriterion,
  CategoryCriterionKey,
  CategoryCriterionOption,
  CategoryFormat,
} from "@/api/client";
import { formatLabelFor, isAlwaysNonTumbling } from "@/lib/categoryLabels";

// Critérios de divisão das categorias (2026-10-06). Espelha
// apps/api/src/categories/category-criteria.ts: manter em sincronia.
// Cada categoria usa os critérios que quiser (null = não usa); o evento
// só guarda as opções de cada critério e as regras delas.

export const CRITERION_LABELS: Record<CategoryCriterionKey, string> = {
  institution: "Vínculo institucional",
  regime: "Regime de competição",
  age_group: "Faixa etária",
  gender: "Gênero",
  level: "Nível",
  size: "Tamanho",
};

// Ordem fixa: monta o nome da categoria e as colunas da tabela.
export const CRITERION_ORDER: CategoryCriterionKey[] = [
  "institution",
  "regime",
  "age_group",
  "gender",
  "level",
  "size",
];

export type OptionCriterionKey = Exclude<CategoryCriterionKey, "level">;

// Campo da categoria que guarda o id da opção de cada critério.
export const OPTION_CRITERION_FIELDS = {
  institution: "institution",
  regime: "regime",
  age_group: "ageGroup",
  gender: "gender",
  size: "size",
} as const satisfies Record<OptionCriterionKey, keyof Category>;

export type OptionCriterionField = (typeof OPTION_CRITERION_FIELDS)[OptionCriterionKey];

export function isOptionCriterion(key: CategoryCriterionKey): key is OptionCriterionKey {
  return key !== "level";
}

// Valores dos critérios de uma categoria (formulário e nome).
export interface CategoryCriteriaValues {
  institution: string | null;
  regime: string | null;
  ageGroup: string | null;
  gender: string | null;
  size: string | null;
  level: number | null;
  nonTumbling: boolean;
}

// Tamanho só em modalidade de grupo: Team Cheer e Custom (ex.: Pom).
export function sizeAllowedFor(categoryFormat: CategoryFormat): boolean {
  return categoryFormat === "team_cheer" || categoryFormat === "custom";
}

export function criterionAppliesTo(
  key: CategoryCriterionKey,
  categoryFormat: CategoryFormat,
): boolean {
  return key !== "size" || sizeAllowedFor(categoryFormat);
}

// Nível: parte inteira = construção (1 a 7), casa decimal = tumbling (1 a
// 7) quando é diferente. "4" = os dois 4; "4.2" = construção 4,
// tumbling 2. Sem tumbling = nível inteiro.
export function levelProblem(level: number, nonTumbling: boolean): string | null {
  const build = Math.floor(level + 1e-9);
  const tumbling = Math.round((level - build) * 10);
  if (build < 1 || build > 7) return "O nível de construção vai de 1 a 7.";
  if (tumbling === 0) return null;
  if (nonTumbling) {
    return "Categoria sem tumbling usa só o nível de construção (sem casa decimal).";
  }
  if (tumbling > 7) return "O nível de tumbling vai de 1 a 7.";
  if (tumbling === build) {
    return `Quando construção e tumbling são do mesmo nível, use só ${build}.`;
  }
  return null;
}

// Stunts não têm tumbling: o "sem tumbling" deles não aparece.
export function effectiveNonTumbling(categoryFormat: CategoryFormat, nonTumbling: boolean) {
  return nonTumbling && !isAlwaysNonTumbling(categoryFormat);
}

// "4", "4.2" e "4.0" (sem tumbling: tumbling nível 0), sem o prefixo
// "Nível".
export function levelLabel(level: number, nonTumbling: boolean): string {
  return nonTumbling ? `${level}.0` : `${level}`;
}

// Explicação do nível escolhido (caixa de informação do card).
export function levelExplanation(level: number, nonTumbling: boolean): string {
  const build = Math.floor(level + 1e-9);
  const tumbling = Math.round((level - build) * 10);
  if (nonTumbling) {
    return `Nível ${build}.0: habilidades de construção de nível ${build}, sem tumbling.`;
  }
  if (tumbling === 0) {
    return `Nível ${build}: construção e tumbling de nível ${build}.`;
  }
  return `Nível ${level}: habilidades de construção de nível ${build} e tumbling de nível ${tumbling}.`;
}

export function findOption(
  criteria: CategoryCriterion[],
  key: OptionCriterionKey,
  id: string | null,
): CategoryCriterionOption | undefined {
  if (!id) return undefined;
  return criteria.find((c) => c.key === key)?.options.find((o) => o.id === id);
}

// Nome automático: modalidade + critérios usados, na ordem fixa,
// separados por " • ".
export function buildCategoryName(
  categoryFormat: CategoryFormat,
  customFormatLabel: string | null,
  values: CategoryCriteriaValues,
  criteria: CategoryCriterion[],
): string {
  const parts = [formatLabelFor(categoryFormat, customFormatLabel)];
  for (const key of CRITERION_ORDER) {
    if (!criterionAppliesTo(key, categoryFormat)) continue;
    if (isOptionCriterion(key)) {
      const option = findOption(criteria, key, values[OPTION_CRITERION_FIELDS[key]]);
      if (option) parts.push(option.label);
    } else if (values.level != null) {
      parts.push(
        `Nível ${levelLabel(values.level, effectiveNonTumbling(categoryFormat, values.nonTumbling))}`,
      );
    }
  }
  return parts.join(" • ");
}

// Tempo padrão de apresentação do Team Cheer por regime (só pré-preenche
// o campo da categoria; decisão do usuário, 2026-10-06).
const REGIME_PRESENTATION_SECONDS: Record<string, number> = {
  novice: 90,
  prep: 120,
  elite: 150,
};

// Tempo padrão de apresentação: Team Cheer Escolar/Universitário mantém
// 2:45; senão o do Regime padrão escolhido (Novice 1:30, Prep 2:00, Elite
// 2:30); senão 2:30. Demais modalidades: 1:00.
export function defaultPresentationTimeSeconds(
  categoryFormat: CategoryFormat,
  values: Pick<CategoryCriteriaValues, "institution" | "regime">,
): number {
  if (categoryFormat !== "team_cheer") return 60;
  if (values.institution === "school" || values.institution === "university") return 165;
  return (values.regime && REGIME_PRESENTATION_SECONDS[values.regime]) || 150;
}

// Valores padrão das opções de Faixa etária e Tamanho (espelha
// defaultCategoryCriteria da API): usados pelo "Restaurar padrão".
export const BUILT_IN_OPTION_DEFAULTS: Record<
  string,
  {
    label: string;
    minAge?: number | null;
    maxAge?: number | null;
    minAthletes?: number | null;
    maxAthletes?: number | null;
  }
> = {
  tiny: { label: "Tiny", minAge: 3, maxAge: 5 },
  mini: { label: "Mini", minAge: 6, maxAge: 8 },
  youth: { label: "Youth", minAge: 9, maxAge: 11 },
  junior: { label: "Junior", minAge: 12, maxAge: 14 },
  senior: { label: "Senior", minAge: 15, maxAge: 18 },
  open: { label: "Open", minAge: null, maxAge: null },
  xs: { label: "Extra Small", minAthletes: 5, maxAthletes: 15 },
  s: { label: "Small", minAthletes: 16, maxAthletes: 24 },
  m: { label: "Medium", minAthletes: 25, maxAthletes: 30 },
  l: { label: "Large", minAthletes: 31, maxAthletes: 38 },
  xl: { label: "Extra Large", minAthletes: null, maxAthletes: 38 },
};
