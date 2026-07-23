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
import type { EventStatus } from "@/api/client";

export type EventStatusFilter = "all" | EventStatus;
export type EventSortOption = "recent" | "oldest" | "name";
export type EventViewMode = "list" | "grid";

const STATUS_FILTER_LABELS: Record<EventStatusFilter, string> = {
  all: "Todos os status",
  created: "Criado",
  published: "Publicado",
  started: "Iniciado",
  completed: "Concluído",
};

const SORT_LABELS: Record<EventSortOption, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  name: "Nome (A-Z)",
};

interface EventFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: EventStatusFilter;
  onStatusFilterChange: (value: EventStatusFilter) => void;
  sort: EventSortOption;
  onSortChange: (value: EventSortOption) => void;
  view: EventViewMode;
  onViewChange: (value: EventViewMode) => void;
}

export function EventFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: EventFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar eventos..."
          className="pl-11"
        />
      </div>

      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as EventStatusFilter)}
        >
          <SelectTrigger className="flex-1 sm:w-48 sm:flex-none">
            <SelectValue>{(value: EventStatusFilter) => STATUS_FILTER_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_FILTER_LABELS) as EventStatusFilter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATUS_FILTER_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => onSortChange(value as EventSortOption)}>
          <SelectTrigger className="flex-1 sm:w-44 sm:flex-none">
            <SelectValue>{(value: EventSortOption) => SORT_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as EventSortOption[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggle lista/grade: só no desktop — no mobile a visão é sempre
          em quadro (ver `effectiveView` na HomePage), então a opção de
          lista não existe ali. */}
      <div className="hidden items-center gap-1 rounded-lg bg-muted p-1 sm:flex">
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
