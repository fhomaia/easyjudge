import { format, parseISO } from "date-fns";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleDay } from "@/api/client";

interface ScheduleDayTabsProps {
  days: ScheduleDay[];
  selectedDayId: string;
  onSelect: (dayId: string) => void;
  onAddDay: () => void;
  addingDay: boolean;
  onDeleteDay: (dayId: string) => void;
}

export function ScheduleDayTabs({
  days,
  selectedDayId,
  onSelect,
  onAddDay,
  addingDay,
  onDeleteDay,
}: ScheduleDayTabsProps) {
  // Sem botão de excluir quando só sobra um dia — o evento precisa de
  // pelo menos um (o backend também rejeita, ver ScheduleService).
  const canDelete = days.length > 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {days.map((day) => (
        <div key={day.id} className="group relative">
          <button
            type="button"
            onClick={() => onSelect(day.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              canDelete && "pr-7",
              day.id === selectedDayId
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {format(parseISO(day.date), "dd/MM")}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteDay(day.id);
              }}
              aria-label="Excluir dia"
              className={cn(
                "absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-full p-0.5 group-hover:block",
                day.id === selectedDayId
                  ? "hover:bg-primary-foreground/20"
                  : "hover:bg-black/10",
              )}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAddDay}
        disabled={addingDay}
        className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <Plus className="size-3.5" />
        Dia
      </button>
    </div>
  );
}
