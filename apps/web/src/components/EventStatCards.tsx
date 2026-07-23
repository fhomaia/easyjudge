import { Archive, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { addDays, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Event } from "@/api/client";

function isUpcoming(event: Event): boolean {
  if (event.status !== "published") return false;
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(event.startDate));
  return isWithinInterval(start, { start: today, end: addDays(today, 30) });
}

interface StatCardConfig {
  key: string;
  label: string;
  subtitle: string;
  icon: typeof CalendarDays;
  iconClassName: string;
  value: number;
}

export function EventStatCards({ events }: { events: Event[] }) {
  const stats: StatCardConfig[] = [
    {
      key: "total",
      label: "Total de eventos",
      subtitle: "Todos os seus eventos",
      icon: CalendarDays,
      iconClassName: "bg-primary/10 text-primary",
      value: events.length,
    },
    {
      key: "started",
      label: "Em andamento",
      subtitle: "Eventos ativos",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
      value: events.filter((e) => e.status === "started").length,
    },
    {
      key: "upcoming",
      label: "Próximos eventos",
      subtitle: "Nos próximos 30 dias",
      icon: Clock,
      iconClassName: "bg-amber-500/10 text-amber-600",
      value: events.filter(isUpcoming).length,
    },
    {
      key: "completed",
      label: "Finalizados",
      subtitle: "Eventos concluídos",
      icon: Archive,
      iconClassName: "bg-slate-500/10 text-slate-600",
      value: events.filter((e) => e.status === "completed").length,
    },
  ];

  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
      {stats.map(({ key, label, subtitle, icon: Icon, iconClassName, value }) => (
        <Card
          key={key}
          className="min-w-[70%] shrink-0 snap-start flex-row items-center gap-4 p-5 sm:min-w-0 sm:shrink"
        >
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              iconClassName,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
