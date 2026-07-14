import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MODALITY_LABELS, STATUS_LABELS } from "@/lib/categoryLabels";
import type { CategoryModality, CategoryStatus } from "@/api/client";

export type CategoryStatusFilter = "all" | CategoryStatus;
export type CategoryModalityFilter = "all" | CategoryModality;
export type CategorySortOption = "recent" | "oldest" | "name";
export type CategoryViewMode = "list" | "grid";

const STATUS_FILTER_LABELS: Record<CategoryStatusFilter, string> = {
  all: "Todos os status",
  ...STATUS_LABELS,
};

const MODALITY_FILTER_LABELS: Record<CategoryModalityFilter, string> = {
  all: "Todas as modalidades",
  ...MODALITY_LABELS,
};

const SORT_LABELS: Record<CategorySortOption, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  name: "Nome (A-Z)",
};

interface CategoryFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: CategoryStatusFilter;
  onStatusFilterChange: (value: CategoryStatusFilter) => void;
  modalityFilter: CategoryModalityFilter;
  onModalityFilterChange: (value: CategoryModalityFilter) => void;
  sort: CategorySortOption;
  onSortChange: (value: CategorySortOption) => void;
  view: CategoryViewMode;
  onViewChange: (value: CategoryViewMode) => void;
}

export function CategoryFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  modalityFilter,
  onModalityFilterChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: CategoryFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar categorias..."
          className="pl-11"
        />
      </div>

      <Select
        value={statusFilter}
        onValueChange={(value) => onStatusFilterChange(value as CategoryStatusFilter)}
      >
        <SelectTrigger className="sm:w-48">
          <SelectValue>{(value: CategoryStatusFilter) => STATUS_FILTER_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(STATUS_FILTER_LABELS) as CategoryStatusFilter[]).map((key) => (
            <SelectItem key={key} value={key}>
              {STATUS_FILTER_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={modalityFilter}
        onValueChange={(value) => onModalityFilterChange(value as CategoryModalityFilter)}
      >
        <SelectTrigger className="sm:w-60">
          <SelectValue>
            {(value: CategoryModalityFilter) => MODALITY_FILTER_LABELS[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODALITY_FILTER_LABELS) as CategoryModalityFilter[]).map((key) => (
            <SelectItem key={key} value={key}>
              {MODALITY_FILTER_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(value) => onSortChange(value as CategorySortOption)}>
        <SelectTrigger className="sm:w-44">
          <SelectValue>{(value: CategorySortOption) => SORT_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as CategorySortOption[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => onViewChange("list")}
          aria-label="Ver como lista"
          className={cn(
            "flex size-9 items-center justify-center rounded-md transition-colors",
            view === "list"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          aria-label="Ver como grade"
          className={cn(
            "flex size-9 items-center justify-center rounded-md transition-colors",
            view === "grid"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" />
        </button>
      </div>
    </div>
  );
}
