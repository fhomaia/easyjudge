import type { ScheduleDay, ScheduleEntry } from "@/api/client";
import { computeResourceTimes } from "./scheduleTime";

// 4 checagens puras a partir das entries + horários computados:
// apresentação sem aquecimento vinculado, aquecimento sem apresentação
// vinculada, aquecimento terminando depois do início da apresentação
// vinculada, e a mesma equipe em dois horários sobrepostos (em
// quaisquer recursos).
export function findScheduleConflicts(day: ScheduleDay): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();
  const times = computeResourceTimes(day.resources, day.startMinutes);
  const allEntries: ScheduleEntry[] = day.resources.flatMap((r) => r.entries);
  const entryById = new Map(allEntries.map((e) => [e.id, e]));
  const warmupByPresentationId = new Map(
    allEntries
      .filter((e) => e.type === "warmup" && e.linkedEntryId)
      .map((e) => [e.linkedEntryId as string, e]),
  );

  function addConflict(entryId: string, reason: string) {
    const list = conflicts.get(entryId) ?? [];
    list.push(reason);
    conflicts.set(entryId, list);
  }

  for (const entry of allEntries) {
    if (entry.type === "presentation") {
      const warmup = warmupByPresentationId.get(entry.id);
      if (!warmup) {
        addConflict(entry.id, "Apresentação sem aquecimento vinculado");
      } else {
        const warmupTime = times.get(warmup.id);
        const presentationTime = times.get(entry.id);
        if (warmupTime && presentationTime && warmupTime.endMinutes > presentationTime.startMinutes) {
          addConflict(entry.id, "Aquecimento termina depois do início da apresentação");
          addConflict(warmup.id, "Aquecimento termina depois do início da apresentação vinculada");
        }
      }
    }
    if (entry.type === "warmup" && (!entry.linkedEntryId || !entryById.has(entry.linkedEntryId))) {
      addConflict(entry.id, "Aquecimento sem apresentação vinculada");
    }
  }

  const byTeam = new Map<string, ScheduleEntry[]>();
  for (const entry of allEntries) {
    if (!entry.teamId) continue;
    const list = byTeam.get(entry.teamId) ?? [];
    list.push(entry);
    byTeam.set(entry.teamId, list);
  }
  for (const entries of byTeam.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.linkedEntryId === b.id || b.linkedEntryId === a.id) continue;
        const ta = times.get(a.id);
        const tb = times.get(b.id);
        if (!ta || !tb) continue;
        const overlap = ta.startMinutes < tb.endMinutes && tb.startMinutes < ta.endMinutes;
        if (overlap) {
          addConflict(a.id, "Equipe com horários sobrepostos");
          addConflict(b.id, "Equipe com horários sobrepostos");
        }
      }
    }
  }

  return conflicts;
}
