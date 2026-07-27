import type { ScheduleDay } from "@/api/client";

// Aplicado no TOPO de computeFullSchedule/computeEventLiveSchedule (não
// no construtor, SchedulePage.tsx — ferramenta de planejamento
// pré-evento, fora do fluxo de desistência) — apresentação com
// `removedFromSchedule` (só admin/assessor pode ligar, ver
// WithdrawPresentationDialog) some da TIMELINE do cronograma, junto
// com qualquer entry vinculada a ela (aquecimento, "Aguardando...").
// A apresentação continua existindo no banco pras súmulas (que sempre
// mostram desistência, marcada — ver AdminNotesOverviewList), só a
// visão de cronograma é que fica "limpa". Como computeResourceTimes só
// soma sequencialmente o que recebe, filtrar antes já libera o horário
// pros itens seguintes sem precisar recalcular nada.
export function filterRemovedFromSchedule(days: ScheduleDay[]): ScheduleDay[] {
  return days.map((day) => {
    const removedPresentationIds = new Set(
      day.resources
        .flatMap((r) => r.entries)
        .filter((e) => e.removedFromSchedule)
        .map((e) => e.id),
    );
    if (removedPresentationIds.size === 0) return day;

    return {
      ...day,
      resources: day.resources.map((resource) => ({
        ...resource,
        entries: resource.entries.filter(
          (e) =>
            !e.removedFromSchedule &&
            !(e.linkedEntryId && removedPresentationIds.has(e.linkedEntryId)),
        ),
      })),
    };
  });
}
