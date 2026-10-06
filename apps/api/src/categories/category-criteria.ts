import { CategoryCriterionKey } from './enums/category-criterion-key.enum';
import { CategoryFormat } from './enums/category-format.enum';

// Uma opção de um critério (ex.: "Senior" em Faixa etária). As regras
// usadas dependem do critério: idade na Faixa etária, quantidade de
// atletas no Tamanho. Opção criada pelo
// produtor segue as mesmas regras das padrão.
export interface CategoryCriterionOption {
  id: string;
  label: string;
  // Opção padrão da plataforma: não pode ser excluída (só as criadas
  // pelo produtor). Calculado na leitura, não é gravado.
  builtIn?: boolean;
  // Nível: construção.tumbling (4.2) e "sem tumbling". O rótulo é
  // montado a partir deles.
  level?: number | null;
  nonTumbling?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
  minAthletes?: number | null;
  maxAthletes?: number | null;
}

// Opções de um critério no evento. Cada categoria escolhe quais
// critérios usa (null = não usa); o evento só guarda as opções e regras.
export interface CategoryCriterion {
  key: CategoryCriterionKey;
  // No Nível, é a paleta mostrada na tela (1 a 7 + níveis como 4.2): a
  // categoria guarda o próprio número, sem id.
  options: CategoryCriterionOption[];
  // Só na Faixa etária: data em que a idade do atleta é conferida
  // (ex.: idade completada até 31/03/2026). YYYY-MM-DD. Sem valor salvo,
  // vale a data de início do evento (ver CategoryCriteriaService).
  ageCutoffDate?: string | null;
}

// Nome mostrado na tela e nas mensagens de erro.
export const CRITERION_LABELS: Record<CategoryCriterionKey, string> = {
  [CategoryCriterionKey.INSTITUTION]: 'Vínculo institucional',
  [CategoryCriterionKey.REGIME]: 'Regime de competição',
  [CategoryCriterionKey.AGE_GROUP]: 'Faixa etária',
  [CategoryCriterionKey.GENDER]: 'Gênero',
  [CategoryCriterionKey.LEVEL]: 'Nível',
  [CategoryCriterionKey.SIZE]: 'Tamanho',
};

// Critérios com lista de opções e a propriedade da categoria que guarda
// o id da opção escolhida (o Nível fica em `level`/`nonTumbling`).
export type OptionCriterionKey = Exclude<
  CategoryCriterionKey,
  CategoryCriterionKey.LEVEL
>;

export const OPTION_CRITERION_FIELDS = {
  [CategoryCriterionKey.INSTITUTION]: 'institution',
  [CategoryCriterionKey.REGIME]: 'regime',
  [CategoryCriterionKey.AGE_GROUP]: 'ageGroup',
  [CategoryCriterionKey.GENDER]: 'gender',
  [CategoryCriterionKey.SIZE]: 'size',
} as const satisfies Record<OptionCriterionKey, string>;

export type OptionCriterionField =
  (typeof OPTION_CRITERION_FIELDS)[OptionCriterionKey];

export function isOptionCriterion(
  key: CategoryCriterionKey,
): key is OptionCriterionKey {
  return key !== CategoryCriterionKey.LEVEL;
}

// Ordem fixa dos critérios (monta o nome da categoria e as colunas).
export const CRITERION_ORDER: CategoryCriterionKey[] = [
  CategoryCriterionKey.INSTITUTION,
  CategoryCriterionKey.REGIME,
  CategoryCriterionKey.AGE_GROUP,
  CategoryCriterionKey.GENDER,
  CategoryCriterionKey.LEVEL,
  CategoryCriterionKey.SIZE,
];

// Ids das opções padrão iguais aos valores antigos dos enums de
// modality/division: as categorias que já existiam continuam válidas
// sem converter nada.
export function defaultCategoryCriteria(): CategoryCriterion[] {
  return [
    {
      key: CategoryCriterionKey.INSTITUTION,
      options: [
        { id: 'all_star', label: 'All Star' },
        { id: 'university', label: 'Universitário' },
        { id: 'school', label: 'Escolar' },
      ],
    },
    {
      key: CategoryCriterionKey.REGIME,
      options: [
        // O tempo padrão de apresentação de cada regime (Novice 1:30,
        // Prep 2:00, Elite 2:30) fica no front: só pré-preenche o campo
        // da categoria (defaultPresentationTimeSeconds).
        { id: 'novice', label: 'Novice' },
        { id: 'prep', label: 'Prep' },
        { id: 'elite', label: 'Elite' },
      ],
    },
    {
      key: CategoryCriterionKey.AGE_GROUP,
      ageCutoffDate: null,
      options: [
        // Faixas usuais (decisão do usuário, 2026-10-06); variam por
        // federação, o produtor ajusta. Open não tem limite.
        { id: 'tiny', label: 'Tiny', minAge: 3, maxAge: 5 },
        { id: 'mini', label: 'Mini', minAge: 6, maxAge: 8 },
        { id: 'youth', label: 'Youth', minAge: 9, maxAge: 11 },
        { id: 'junior', label: 'Junior', minAge: 12, maxAge: 14 },
        { id: 'senior', label: 'Senior', minAge: 15, maxAge: 18 },
        { id: 'open', label: 'Open', minAge: null, maxAge: null },
      ],
    },
    {
      key: CategoryCriterionKey.GENDER,
      options: [
        { id: 'coed', label: 'COED' },
        { id: 'all_girl', label: 'All Girl' },
        { id: 'all_boy', label: 'All Boy' },
      ],
    },
    {
      key: CategoryCriterionKey.LEVEL,
      options: [1, 2, 3, 4, 5, 6, 7].map((level) => ({
        id: `level_${level}`,
        label: levelLabel(level, false),
        level,
        nonTumbling: false,
      })),
    },
    {
      key: CategoryCriterionKey.SIZE,
      options: [
        { id: 'xs', label: 'Extra Small', minAthletes: 5, maxAthletes: 15 },
        { id: 's', label: 'Small', minAthletes: 16, maxAthletes: 24 },
        { id: 'm', label: 'Medium', minAthletes: 25, maxAthletes: 30 },
        { id: 'l', label: 'Large', minAthletes: 31, maxAthletes: 38 },
        { id: 'xl', label: 'Extra Large', minAthletes: null, maxAthletes: 38 },
      ],
    },
  ];
}

// Tamanho só faz sentido em modalidade de grupo: Team Cheer, e Custom
// (pode ser de grupo, ex.: Pom). Stunts nunca.
export function sizeAllowedFor(categoryFormat: CategoryFormat): boolean {
  return (
    categoryFormat === CategoryFormat.TEAM_CHEER ||
    categoryFormat === CategoryFormat.CUSTOM
  );
}

// Group Stunt, Elite Stunt e Partner Stunt não têm tumbling (o campo nem
// aparece na tela pra eles).
export function isAlwaysNonTumbling(categoryFormat: CategoryFormat): boolean {
  return [
    CategoryFormat.GROUP_STUNT,
    CategoryFormat.COED,
    CategoryFormat.PARTNER,
  ].includes(categoryFormat);
}

// Nível: a parte inteira é a construção (1 a 7) e a casa decimal, o
// tumbling (1 a 7). "4" = construção e tumbling 4; "4.2" = construção 4,
// tumbling 2. Sem tumbling = nível inteiro + nonTumbling.
export function levelProblem(
  level: number,
  nonTumbling: boolean,
): string | null {
  const build = Math.floor(level + 1e-9);
  const tumbling = Math.round((level - build) * 10);
  if (build < 1 || build > 7) {
    return 'O nível de construção vai de 1 a 7.';
  }
  if (tumbling === 0) return null;
  if (nonTumbling) {
    return 'Categoria sem tumbling usa só o nível de construção (sem casa decimal).';
  }
  if (tumbling > 7) return 'O nível de tumbling vai de 1 a 7.';
  if (tumbling === build) {
    return `Quando construção e tumbling são do mesmo nível, use só ${build}.`;
  }
  return null;
}

// "4", "4.2" e "4.0" (sem tumbling: tumbling nível 0), sem o prefixo
// "Nível".
export function levelLabel(level: number, nonTumbling: boolean): string {
  return nonTumbling ? `${level}.0` : `${level}`;
}

// Stunts não têm tumbling: o "sem tumbling" deles não aparece no rótulo
// nem conta como diferença.
export function effectiveNonTumbling(
  categoryFormat: CategoryFormat,
  nonTumbling: boolean,
): boolean {
  return nonTumbling && !isAlwaysNonTumbling(categoryFormat);
}

// Ids das opções padrão de cada critério (não podem ser excluídas).
export function builtInOptionIds(key: CategoryCriterionKey): Set<string> {
  const criterion = defaultCategoryCriteria().find((c) => c.key === key);
  return new Set(criterion?.options.map((o) => o.id) ?? []);
}
