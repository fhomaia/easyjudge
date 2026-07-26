import type { ScheduleEntry } from "@/api/client";

// Mesmo texto usado pelo backend em ScheduleService (createPresentationWithWarmup/
// autoGenerate) pro break "intervalo entre apresentações" — diferente
// de "Aguardando aquecimento"/"Aguardando disponibilidade da equipe",
// este é visível (não escondido de listas/exports) e removível direto
// pelo usuário (ver isAutoWaitBreak abaixo).
export const INTERVAL_BREAK_LABEL = "Intervalo entre apresentações";

// "Aguardando aquecimento"/"Aguardando disponibilidade da equipe" — só
// esses breaks têm linkedEntryId (aponta pra apresentação que os
// originou, ver ScheduleService) E não são o intervalo fixo entre
// apresentações (que também tem linkedEntryId, só pra ser excluído
// junto quando a apresentação é excluída — ver ScheduleService.
// removeEntry — mas ao contrário deles não é "gerado pra evitar
// conflito", é visível e removível como qualquer break normal).
// Módulo à parte (sem depender de scheduleTime nem
// scheduleEntryDisplay) pra os dois poderem importar esta função sem
// criar import circular entre eles.
export function isAutoWaitBreak(entry: ScheduleEntry): boolean {
  return (
    entry.type === "break" &&
    !!entry.linkedEntryId &&
    entry.label !== INTERVAL_BREAK_LABEL
  );
}
