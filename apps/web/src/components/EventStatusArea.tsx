import { addDays, endOfDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { cn } from "@/lib/utils";
import type { Event } from "@/api/client";

function isEventDay(event: Event): boolean {
  const start = startOfDay(parseISO(event.startDate));
  const end = endOfDay(addDays(start, event.competitionDays - 1));
  return isWithinInterval(new Date(), { start, end });
}

function BlinkingDot({ colorClassName }: { colorClassName: string }) {
  return (
    <span className="relative flex size-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          colorClassName,
        )}
      />
      <span className={cn("relative inline-flex size-2 rounded-full", colorClassName)} />
    </span>
  );
}

interface EventStatusAreaProps {
  event: Event;
  onStart: () => void;
  starting: boolean;
}

export function EventStatusArea({ event, onStart, starting }: EventStatusAreaProps) {
  if (event.status === "started") {
    return (
      <span className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
        <BlinkingDot colorClassName="bg-red-500" />
        Ao vivo
      </span>
    );
  }

  const canStart =
    event.currentUserRole === "admin" && event.status === "published" && isEventDay(event);

  if (canStart) {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <BlinkingDot colorClassName="bg-emerald-500" />
        {starting ? "Iniciando..." : "Iniciar evento"}
      </button>
    );
  }

  return <EventStatusBadge status={event.status} />;
}
