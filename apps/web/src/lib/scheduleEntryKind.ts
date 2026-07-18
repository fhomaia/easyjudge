import type { ScheduleEntry } from "@/api/client";

// "Aguardando aquecimento"/"Aguardando disponibilidade da equipe" — só
// esses breaks têm linkedEntryId (aponta pra apresentação que os
// originou, ver ScheduleService). Módulo à parte (sem depender de
// scheduleTime nem scheduleEntryDisplay) pra os dois poderem importar
// esta função sem criar import circular entre eles.
export function isAutoWaitBreak(entry: ScheduleEntry): boolean {
  return entry.type === "break" && !!entry.linkedEntryId;
}
