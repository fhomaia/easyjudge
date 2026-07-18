import type { ScheduleResource } from "@/api/client";
import { isAutoWaitBreak } from "@/lib/scheduleEntryKind";

export interface ComputedEntryTime {
  startMinutes: number;
  endMinutes: number;
}

// Horário nunca é persistido no backend — sempre computado aqui
// andando a sequência (order ascendente) de cada recurso a partir do
// horário inicial do dia, somando durationMinutes das entries
// anteriores. Mantém o drag-and-drop instantâneo (sem round-trip pra
// recalcular e redesenhar).
export function computeResourceTimes(
  resources: ScheduleResource[],
  dayStartMinutes: number,
): Map<string, ComputedEntryTime> {
  const times = new Map<string, ComputedEntryTime>();
  for (const resource of resources) {
    let cursor = dayStartMinutes;
    const sorted = [...resource.entries].sort((a, b) => a.order - b.order);
    for (const entry of sorted) {
      const start = cursor;
      const end = start + entry.durationMinutes;
      times.set(entry.id, { startMinutes: start, endMinutes: end });
      cursor = end;
    }
  }
  return times;
}

// Linhas da visão em tabela (ScheduleTableView) — união de todo
// horário de início E FIM usado por qualquer entry "de verdade" (não
// os intervalos automáticos "Aguardando aquecimento"/"Aguardando
// disponibilidade da equipe", suprimidos na tabela — ver
// ScheduleTableView) de qualquer recurso do dia, ordenada. Recursos
// com blocos de duração diferente (ex: aquecimento de 10min ao lado de
// apresentações de 1min) não têm fronteiras alinhadas naturalmente; a
// tabela usa essa união como linhas e mescla (rowSpan) a célula de um
// recurso quando sua entry atravessa mais de uma linha.
//
// Incluir também o FIM (não só o início) evita uma linha "muda": sem
// isso, quando um recurso termina antes do próximo início de qualquer
// outro recurso (ex: aquecimento acaba às 08:20 mas só o próximo
// evento do dia, em OUTRO recurso, começa às 20:00), não existia
// nenhuma linha marcando esse fim — a tabela pulava direto de 08:10
// pra 20:00, dando a impressão de que o aquecimento também ia até lá.
export function getScheduleRowStarts(
  resources: ScheduleResource[],
  times: Map<string, ComputedEntryTime>,
): number[] {
  const starts = new Set<number>();
  for (const resource of resources) {
    for (const entry of resource.entries) {
      if (isAutoWaitBreak(entry)) continue;
      const t = times.get(entry.id);
      if (t) {
        starts.add(t.startMinutes);
        starts.add(t.endMinutes);
      }
    }
  }
  return Array.from(starts).sort((a, b) => a - b);
}

export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.floor(normalized % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// "10h 30min" (ou só "45min" quando não fecha hora cheia) — usado no
// resumo de duração total do dia no cabeçalho da timeline.
export function formatDurationHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
