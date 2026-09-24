import type { ScheduleDay, ScheduleEntry } from "@/api/client";
import { computeResourceTimes } from "@/lib/scheduleTime";
import { filterRemovedFromSchedule } from "@/lib/scheduleWithdrawal";

export interface FullScheduleItem {
  entry: ScheduleEntry;
  resourceId: string;
  resourceName: string;
  dayId: string;
  dayDate: string; // "YYYY-MM-DD"
  dayIndex: number;
  start: number; // minutos desde meia-noite
  end: number;
}

// Lista COMPLETA do cronograma — ao contrário de
// `computeEventLiveSchedule` (que só mostra o que ainda está pendente e
// esconde aquecimentos/breaks automáticos, pro card "Próxima
// apresentação"), aqui entra tudo: toda apresentação, aquecimento,
// intervalo (inclusive os automáticos "Aguardando..."), abertura e
// premiação, de qualquer dia, sem filtro nenhum — a tela de "Cronograma
// completo" que consome isso é quem filtra (tipo/equipe/programa/busca).
export function computeFullSchedule(days: ScheduleDay[]): FullScheduleItem[] {
  const sortedDays = [...filterRemovedFromSchedule(days)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const items: FullScheduleItem[] = [];

  for (const day of sortedDays) {
    const times = computeResourceTimes(day.resources, day.startMinutes);
    for (const resource of day.resources) {
      for (const entry of resource.entries) {
        const t = times.get(entry.id);
        if (!t) continue;
        items.push({
          entry,
          resourceId: resource.id,
          resourceName: resource.name,
          dayId: day.id,
          dayDate: day.date,
          dayIndex: day.dayIndex,
          start: t.startMinutes,
          end: t.endMinutes,
        });
      }
    }
  }

  items.sort((a, b) => (a.dayDate === b.dayDate ? a.start - b.start : a.dayDate < b.dayDate ? -1 : 1));
  return items;
}

function matchesEntry(entry: ScheduleEntry, query: string): boolean {
  const haystack = [entry.teamName, entry.categoryName, entry.label]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

// Categorias dos chips de filtro do Cronograma ao vivo. "Eventos
// especiais" junta abertura, premiação e os intervalos SEM
// `linkedEntryId` (almoço, batalhas, contestação, personalizados — tudo
// que o produtor adiciona como evento especial). "Intervalos" fica só
// com as esperas automáticas, que são os únicos breaks ligados a uma
// apresentação (ver lib/dropSlots.ts). Antes o filtro era pelo tipo cru
// e esconder "Intervalos" escondia as batalhas junto (2026-09-24).
// Os rótulos automáticos também contam como "Intervalos" mesmo sem
// `linkedEntryId`: dado antigo e esperas que perderam o vínculo quando a
// apresentação foi apagada (a FK é SET NULL) existem no banco.
export type ScheduleFilterCategory = "presentation" | "warmup" | "special" | "break";

// Mesmos textos gravados por ScheduleService (backend).
const AUTOMATIC_BREAK_LABELS = new Set([
  "Aguardando aquecimento",
  "Aguardando disponibilidade da equipe",
  "Intervalo entre apresentações",
]);

export function scheduleFilterCategory(entry: ScheduleEntry): ScheduleFilterCategory {
  switch (entry.type) {
    case "presentation":
    case "warmup":
      return entry.type;
    case "break":
      return entry.linkedEntryId || AUTOMATIC_BREAK_LABELS.has(entry.label ?? "")
        ? "break"
        : "special";
    default:
      return "special";
  }
}

export interface FullScheduleFilters {
  categories: Set<ScheduleFilterCategory>;
  teamId: string | null;
  programId: string | null;
  search: string;
}

// `teamProgramMap` resolve o programa de uma entry pelo `teamId` — o
// ScheduleEntry não carrega `programId` (só `teamId`/`teamName`), então
// precisa vir de fora (ver teamsApi.listForEvent, que já traz
// team.program embutido).
export function filterFullSchedule(
  items: FullScheduleItem[],
  filters: FullScheduleFilters,
  teamProgramMap: Map<string, string>,
): FullScheduleItem[] {
  const query = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (!filters.categories.has(scheduleFilterCategory(item.entry))) return false;
    if (filters.teamId && item.entry.teamId !== filters.teamId) return false;
    if (filters.programId) {
      const programId = item.entry.teamId ? teamProgramMap.get(item.entry.teamId) : undefined;
      if (programId !== filters.programId) return false;
    }
    if (query && !matchesEntry(item.entry, query)) return false;
    return true;
  });
}
