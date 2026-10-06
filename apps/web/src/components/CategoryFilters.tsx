import { useMemo } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CRITERION_LABELS, isOptionCriterion } from "@/lib/categoryCriteria";
import {
  autoFormatKey,
  autoFormatKeyLabel,
  eventFormatKeysInDefaultOrder,
} from "@/lib/autoFormatKey";
import { cn } from "@/lib/utils";
import type { Category, CategoryCriterion, CategoryCriterionKey } from "@/api/client";

// Modalidade (`categoryFormat`) + um grupo por divisão usada nas
// categorias. Valores de critério = `criteriaLabels[].value` da categoria.
export interface CategoryFilterState {
  search: string;
  // Vazio = sem restrição naquele grupo. Grupos combinados com E.
  formats: string[];
  criteria: Partial<Record<CategoryCriterionKey, string[]>>;
}

export const EMPTY_CATEGORY_FILTER: CategoryFilterState = {
  search: "",
  formats: [],
  criteria: {},
};

function criterionValue(category: Category, key: CategoryCriterionKey): string | undefined {
  return category.criteriaLabels?.find((l) => l.key === key)?.value;
}

export function filterCategories(categories: Category[], f: CategoryFilterState): Category[] {
  const query = f.search.trim().toLowerCase();
  const criteriaFilters = Object.entries(f.criteria).filter(([, values]) => values.length > 0) as [
    CategoryCriterionKey,
    string[],
  ][];
  return categories.filter(
    (c) =>
      (!query || c.name.toLowerCase().includes(query)) &&
      (f.formats.length === 0 ||
        f.formats.includes(autoFormatKey(c.categoryFormat, c.customFormatLabel))) &&
      criteriaFilters.every(([key, values]) => values.includes(criterionValue(c, key) ?? "")),
  );
}

// Categorias agrupadas por modalidade (formato; cada Custom pelo nome) na
// ordem padrão, e cada grupo por nível (depois nome).
export function groupCategoriesByModality(
  categories: Category[],
): { key: string; label: string; categories: Category[] }[] {
  return eventFormatKeysInDefaultOrder(categories)
    .map((key) => ({
      key,
      label: autoFormatKeyLabel(key),
      categories: categories
        .filter((c) => autoFormatKey(c.categoryFormat, c.customFormatLabel) === key)
        .sort(
          (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, "pt-BR"),
        ),
    }))
    .filter((g) => g.categories.length > 0);
}

// Opções de cada critério que existem nas categorias, na ordem das
// opções do evento (Nível em ordem numérica).
function criterionFilterOptions(
  categories: Category[],
  criterion: CategoryCriterion,
): { value: string; label: string }[] {
  const found = new Map<string, string>();
  for (const category of categories) {
    const label = category.criteriaLabels?.find((l) => l.key === criterion.key);
    if (label) found.set(label.value, label.label.replace(/^Nível /, ""));
  }
  const list = [...found.entries()].map(([value, label]) => ({ value, label }));
  if (isOptionCriterion(criterion.key)) {
    const order = criterion.options.map((o) => o.id);
    return list.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
  }
  return list.sort((a, b) => parseFloat(a.value) - parseFloat(b.value) || a.value.localeCompare(b.value));
}

// Busca por nome + o botão "Filtros".
export function CategoryFilters({
  categories,
  criteria,
  value,
  onChange,
}: {
  categories: Category[];
  criteria: CategoryCriterion[];
  value: CategoryFilterState;
  onChange: (next: CategoryFilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Buscar categoria..."
          className="pl-9"
        />
      </div>
      <CategoryFiltersPopover
        categories={categories}
        criteria={criteria}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

// Botão "Filtros": modalidade e um grupo por divisão, só com as opções
// que existem nas categorias do evento.
export function CategoryFiltersPopover({
  categories,
  criteria,
  value,
  onChange,
  className,
}: {
  categories: Category[];
  criteria: CategoryCriterion[];
  value: CategoryFilterState;
  onChange: (next: CategoryFilterState) => void;
  className?: string;
}) {
  const formats = useMemo(() => eventFormatKeysInDefaultOrder(categories), [categories]);
  const groups = useMemo(
    () =>
      criteria
        .map((criterion) => ({
          key: criterion.key,
          options: criterionFilterOptions(categories, criterion),
        }))
        .filter((g) => g.options.length > 0),
    [categories, criteria],
  );
  const activeCount =
    value.formats.length +
    Object.values(value.criteria).reduce((sum, list) => sum + list.length, 0);

  function toggleFormat(key: string) {
    const list = value.formats;
    onChange({
      ...value,
      formats: list.includes(key) ? list.filter((i) => i !== key) : [...list, key],
    });
  }

  function toggleCriterion(key: CategoryCriterionKey, item: string) {
    const list = value.criteria[key] ?? [];
    onChange({
      ...value,
      criteria: {
        ...value.criteria,
        [key]: list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
      },
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
          activeCount > 0
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-foreground hover:bg-muted",
          className,
        )}
      >
        <ListFilter className="size-4" />
        Filtros
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="grid max-h-[70dvh] w-72 gap-4 overflow-y-auto p-4">
        <FilterGroup title="Modalidade">
          {formats.map((key) => (
            <FilterOption
              key={key}
              label={autoFormatKeyLabel(key)}
              checked={value.formats.includes(key)}
              onToggle={() => toggleFormat(key)}
            />
          ))}
        </FilterGroup>
        {groups.map((group) => (
          <FilterGroup key={group.key} title={CRITERION_LABELS[group.key]}>
            <div
              className={cn(
                group.key === "level" ? "flex flex-wrap gap-x-4 gap-y-2" : "grid gap-2",
              )}
            >
              {group.options.map((option) => (
                <FilterOption
                  key={option.value}
                  label={option.label}
                  checked={(value.criteria[group.key] ?? []).includes(option.value)}
                  onToggle={() => toggleCriterion(group.key, option.value)}
                />
              ))}
            </div>
          </FilterGroup>
        ))}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...value, formats: [], criteria: {} })}
            className="flex items-center gap-1 justify-self-start text-sm font-medium text-primary hover:underline"
          >
            <X className="size-3.5" />
            Limpar filtros
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function FilterOption({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {label}
    </label>
  );
}
