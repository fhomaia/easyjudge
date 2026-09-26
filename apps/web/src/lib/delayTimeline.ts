import type { ScheduleDay, ScheduleEntry } from "@/api/client";
import { computeResourceTimes } from "@/lib/scheduleTime";

export interface DelayPoint {
  entryId: string;
  label: string;
  plannedMinutes: number; // minutos desde meia-noite, horário planejado
  actualMinutes: number; // minutos desde meia-noite, horário real (fuso local)
  delayMinutes: number; // real - planejado (negativo = adiantado)
}

export interface DelayDay {
  dayId: string;
  dayDate: string; // "YYYY-MM-DD"
  points: DelayPoint[]; // ordenados pelo horário real
}

function entryLabel(entry: ScheduleEntry): string {
  if (entry.type === "presentation") return entry.teamName ?? "Equipe";
  return entry.label ?? (entry.type === "award" ? "Premiação" : "Evento especial");
}

// Atraso de cada apresentação (e evento especial sinalizado) no momento em
// que começou de verdade — mesmo cálculo do card "Atraso atual" (início
// real, ver ScoringService.getPresentationStartTimes, menos o horário
// planejado do cronograma), só que guardando todos os pontos pra mostrar
// a evolução ao longo do dia (gargalos e recuperação).
export function computeDelayTimeline(
  days: ScheduleDay[],
  starts: Array<{ scheduleEntryId: string; startedAt: string }>,
): DelayDay[] {
  const startById = new Map(starts.map((s) => [s.scheduleEntryId, s.startedAt]));
  const result: DelayDay[] = [];
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const times = computeResourceTimes(day.resources, day.startMinutes);
    const points: DelayPoint[] = [];
    for (const resource of day.resources) {
      for (const entry of resource.entries) {
        const startedAt = startById.get(entry.id);
        const t = times.get(entry.id);
        if (!startedAt || !t) continue;
        const actual = new Date(startedAt);
        const planned = new Date(`${day.date}T00:00:00`);
        planned.setMinutes(planned.getMinutes() + t.startMinutes);
        points.push({
          entryId: entry.id,
          label: entryLabel(entry),
          plannedMinutes: t.startMinutes,
          actualMinutes: actual.getHours() * 60 + actual.getMinutes() + actual.getSeconds() / 60,
          delayMinutes: Math.round((actual.getTime() - planned.getTime()) / 60_000),
        });
      }
    }
    if (points.length === 0) continue;
    points.sort((a, b) => a.actualMinutes - b.actualMinutes);
    result.push({ dayId: day.id, dayDate: day.date, points });
  }
  return result;
}

// "+45 min", "+1h 05min", "No horário", "Adiantado 10 min".
export function formatDelayText(minutes: number): string {
  if (minutes === 0) return "No horário";
  const abs = Math.abs(minutes);
  const text =
    abs < 60
      ? `${abs} min`
      : abs % 60 === 0
        ? `${Math.floor(abs / 60)}h`
        : `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, "0")}min`;
  return minutes > 0 ? `+${text}` : `Adiantado ${text}`;
}
