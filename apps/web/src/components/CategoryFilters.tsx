import { useMemo } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DIVISION_LABELS, MODALITY_LABELS } from "@/lib/categoryLabels";
import {
  autoFormatKey,
  autoFormatKeyLabel,
  eventFormatKeysInDefaultOrder,
} from "@/lib/autoFormatKey";
import { cn } from "@/lib/utils";
import type { Category, CategoryDivision, CategoryModality } from "@/api/client";

// Nomenclatura da tela (ver lib/categoryLabels.ts): Modalidade =
// `categoryFormat`, Divisão = `modality`, Gênero = `division`.
export interface CategoryFilterState {
  search: string;
  // Vazio = sem restrição naquele grupo. Grupos combinados com E.
  formats: string[];
  levels: number[];
  divisions: CategoryModality[];
  genders: CategoryDivision[];
}

export const EMPTY_CATEGORY_FILTER: CategoryFilterState = {
  search: "",
  formats: [],
  levels: [],
  divisions: [],
  genders: [],
};

const DIVISION_ORDER: CategoryModality[] = ["all_star", "university", "school"];
const GENDER_ORDER: CategoryDivision[] = ["coed", "all_girl", "all_boy"];

export function filterCategories(categories: Category[], f: CategoryFilterState): Category[] {
  const query = f.search.trim().toLowerCase();
  return categories.filter(
    (c) =>
      (!query || c.name.toLowerCase().includes(query)) &&
      (f.formats.length === 0 || f.formats.includes(autoFormatKey(c.categoryFormat, c.customFormatLabel))) &&
      (f.levels.length === 0 || f.levels.includes(c.level)) &&
      (f.divisions.length === 0 || f.divisions.includes(c.modality)) &&
      (f.genders.length === 0 || f.genders.includes(c.division)),
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
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR")),
    }))
    .filter((g) => g.categories.length > 0);
}

// Busca por nome + um botão "Filtros" com modalidade, nível, divisão e
// gênero (só as opções que existem nas categorias do evento).
export function CategoryFilters({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: CategoryFilterState;
  onChange: (next: CategoryFilterState) => void;
}) {
  const formats = useMemo(() => eventFormatKeysInDefaultOrder(categories), [categories]);
  const levels = useMemo(
    () => [...new Set(categories.map((c) => c.level))].sort((a, b) => a - b),
    [categories],
  );
  const divisions = useMemo(
    () => DIVISION_ORDER.filter((d) => categories.some((c) => c.modality === d)),
    [categories],
  );
  const genders = useMemo(
    () => GENDER_ORDER.filter((g) => categories.some((c) => c.division === g)),
    [categories],
  );
  const activeCount =
    value.formats.length + value.levels.length + value.divisions.length + value.genders.length;

  function toggle<K extends "formats" | "levels" | "divisions" | "genders">(
    key: K,
    item: CategoryFilterState[K][number],
  ) {
    const list = value[key] as (typeof item)[];
    onChange({
      ...value,
      [key]: list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
    });
  }

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
      <Popover>
        <PopoverTrigger
          type="button"
          className={cn(
            "flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
            activeCount > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-foreground hover:bg-muted",
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
                onToggle={() => toggle("formats", key)}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="Nível">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {levels.map((level) => (
                <FilterOption
                  key={level}
                  label={String(level)}
                  checked={value.levels.includes(level)}
                  onToggle={() => toggle("levels", level)}
                />
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Divisão">
            {divisions.map((division) => (
              <FilterOption
                key={division}
                label={MODALITY_LABELS[division]}
                checked={value.divisions.includes(division)}
                onToggle={() => toggle("divisions", division)}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="Gênero">
            {genders.map((gender) => (
              <FilterOption
                key={gender}
                label={DIVISION_LABELS[gender]}
                checked={value.genders.includes(gender)}
                onToggle={() => toggle("genders", gender)}
              />
            ))}
          </FilterGroup>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, formats: [], levels: [], divisions: [], genders: [] })
              }
              className="flex items-center gap-1 justify-self-start text-sm font-medium text-primary hover:underline"
            >
              <X className="size-3.5" />
              Limpar filtros
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
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
