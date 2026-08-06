import { useEffect, useMemo, useState } from "react";
import { isAutoWaitBreak } from "@/lib/scheduleEntryDisplay";
import type { ScheduleDay, ScheduleEntry } from "@/api/client";

export type SchedulePositionType = "start" | "before" | "after" | "end";

// Estado + cálculo de posição compartilhados pelos popups que ADICIONAM
// um item novo ao cronograma clicando (em vez de arrastar) — hoje
// AddUnscheduledEntryDialog (equipe não agendada) e
// AddComponentEntryDialog (Almoço/Abertura/Premiação/etc.), extraído
// daqui pra não duplicar o cálculo de `order` (que tem um detalhe sutil:
// o índice é entre TODAS as entries da pista, não só as candidatas a
// âncora — ver `computeOrder`) entre os dois. Diferente de
// MovePresentationDialog (mover um item JÁ agendado), aqui não existe
// remoção prévia a descontar dos índices — é sempre inserção pura.
export function useSchedulePosition(day: ScheduleDay | null) {
  const [resourceId, setResourceId] = useState("");
  const [positionType, setPositionType] = useState<SchedulePositionType>("end");
  const [referenceEntryId, setReferenceEntryId] = useState("");

  const presentationResources = useMemo(
    () => (day?.resources ?? []).filter((r) => r.supportsPresentations),
    [day],
  );

  const targetResource = presentationResources.find((r) => r.id === resourceId) ?? null;

  const sortedSiblings = useMemo(() => {
    if (!targetResource) return [];
    return targetResource.entries.slice().sort((a, b) => a.order - b.order);
  }, [targetResource]);

  // Qualquer item do cronograma serve de referência (apresentação, ou
  // um componente do evento) — só exclui aquecimento e os breaks
  // automáticos ("Aguardando aquecimento"/"Aguardando disponibilidade
  // da equipe"), que são geridos pelo backend.
  const anchorEntries = useMemo(
    () =>
      sortedSiblings
        .map((entry: ScheduleEntry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.type !== "warmup" && !isAutoWaitBreak(entry)),
    [sortedSiblings],
  );

  const positionTypeOptions: SchedulePositionType[] = useMemo(
    () => (anchorEntries.length > 0 ? ["start", "before", "after", "end"] : ["start", "end"]),
    [anchorEntries],
  );

  // Se a pista mudar (ou o item escolhido como referência sumir da
  // lista) enquanto "Antes de"/"Depois de" está selecionado, cai pra
  // primeira opção disponível em vez de ficar com uma referência
  // inválida.
  useEffect(() => {
    if (positionType !== "before" && positionType !== "after") return;
    if (anchorEntries.some(({ entry }) => entry.id === referenceEntryId)) return;
    setReferenceEntryId(anchorEntries[0]?.entry.id ?? "");
  }, [positionType, anchorEntries, referenceEntryId]);

  function reset(defaultResourceId?: string) {
    setResourceId((prev) => defaultResourceId ?? (prev || (presentationResources[0]?.id ?? "")));
    setPositionType("end");
    setReferenceEntryId("");
  }

  function computeOrder(): number | null {
    if (positionType === "start") return 0;
    if (positionType === "end") return sortedSiblings.length;
    const anchor = anchorEntries.find(({ entry }) => entry.id === referenceEntryId);
    if (!anchor) return null;
    return positionType === "before" ? anchor.index : anchor.index + 1;
  }

  return {
    resourceId,
    setResourceId,
    positionType,
    setPositionType,
    referenceEntryId,
    setReferenceEntryId,
    presentationResources,
    anchorEntries,
    positionTypeOptions,
    computeOrder,
    reset,
  };
}
