import type { ScheduleDay, ScheduleEntry } from "@/api/client";

function sumDuration(entries: ScheduleEntry[]): number {
  return entries.reduce((acc, e) => acc + e.durationMinutes, 0);
}

interface ScheduleSummaryFooterProps {
  day: ScheduleDay;
}

export function ScheduleSummaryFooter({ day }: ScheduleSummaryFooterProps) {
  const allEntries = day.resources.flatMap((r) => r.entries);
  const presentations = allEntries.filter((e) => e.type === "presentation");
  const warmups = allEntries.filter((e) => e.type === "warmup");
  const others = allEntries.filter(
    (e) => e.type === "break" || e.type === "ceremony" || e.type === "award",
  );

  // "Preenchido" = quanto do dia já tem algo agendado — o recurso mais
  // cheio (soma das durações de todas as suas entries), não a soma de
  // todos os recursos juntos (eles correm em paralelo, então somar
  // todos contaria o mesmo intervalo de tempo várias vezes).
  const filledMinutes = Math.max(0, ...day.resources.map((r) => sumDuration(r.entries)));
  const totalMinutes = day.endMinutes - day.startMinutes;
  const filledPercent = totalMinutes > 0 ? Math.round((filledMinutes / totalMinutes) * 100) : 0;

  const stats = [
    { label: "Apresentações", value: `${presentations.length}` },
    { label: "Tempo de apresentações", value: `${sumDuration(presentations)} min` },
    { label: "Tempo de aquecimento", value: `${sumDuration(warmups)} min` },
    { label: "Intervalos e cerimônias", value: `${sumDuration(others)} min` },
    { label: "Total do dia preenchido", value: `${filledPercent}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-card p-4 sm:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-semibold text-foreground">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
