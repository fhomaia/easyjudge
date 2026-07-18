import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatarColor";
import { Checkbox } from "@/components/ui/checkbox";
import type { UnscheduledPair } from "@/api/client";

function UnscheduledItem({ pair }: { pair: UnscheduledPair }) {
  const id = `unscheduled:${pair.teamId}:${pair.categoryId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
          : undefined
      }
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-sm active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <span
        style={{ backgroundColor: getAvatarColor(pair.teamId) }}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      >
        {pair.teamName.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{pair.teamName}</p>
        <p className="truncate text-xs text-muted-foreground">{pair.categoryName}</p>
      </div>
    </div>
  );
}

interface UnscheduledTeamsPanelProps {
  pairs: UnscheduledPair[];
  ignoreUnscheduled: boolean;
  onToggleIgnoreUnscheduled: (value: boolean) => void;
}

export function UnscheduledTeamsPanel({
  pairs,
  ignoreUnscheduled,
  onToggleIgnoreUnscheduled,
}: UnscheduledTeamsPanelProps) {
  const [query, setQuery] = useState("");
  const filtered = pairs.filter((p) =>
    `${p.teamName} ${p.categoryName}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Equipes não agendadas neste dia</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {pairs.length}
        </span>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={ignoreUnscheduled}
          onCheckedChange={(value) => onToggleIgnoreUnscheduled(value === true)}
          className="mt-0.5"
        />
        <span>Ignorar apresentações não agendadas</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar equipe..."
          className="w-full rounded-md border border-border/60 bg-background py-1.5 pl-8 pr-2 text-sm text-foreground outline-none focus-visible:border-primary"
        />
      </div>
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {pairs.length === 0
              ? "Todas as apresentações deste dia já foram agendadas."
              : "Nenhuma equipe encontrada."}
          </p>
        )}
        {filtered.map((pair) => (
          <UnscheduledItem key={`${pair.teamId}:${pair.categoryId}`} pair={pair} />
        ))}
      </div>
    </div>
  );
}
