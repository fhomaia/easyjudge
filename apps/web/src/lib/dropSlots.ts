import type { ScheduleEntry } from "@/api/client";
import type { ComputedEntryTime } from "@/lib/scheduleTime";

// Pontos onde é possível soltar um item numa fila (recurso): sempre ANTES
// ou DEPOIS de um item "de verdade" — apresentação, aquecimento ou evento
// especial. Nunca dentro de um grupo (as esperas e o intervalo entre
// apresentações são gerados em função da apresentação seguinte e ficam
// colados na frente dela) e nunca "em cima" de um item.
export interface DropSlot {
  // Índice pra mandar pra API: relativo à fila SEM o item que está sendo
  // movido (e sem as esperas/intervalos ligados a ele, quando é uma
  // apresentação) — é assim que o backend interpreta `order` ao mover.
  apiIndex: number;
  // Fronteira na linha do tempo (minuto do dia) — onde desenhar o ponto.
  minutes: number;
  // Itens reais logo depois / logo antes do ponto (null nas pontas).
  beforeEntryId: string | null;
  afterEntryId: string | null;
  // Ponto médio (minuto do dia) do item real logo depois do ponto — é o
  // que decide o ponto escolhido (ver pickSlot). null no ponto final.
  beforeMidMinutes: number | null;
}

// Esperas ("Aguardando aquecimento"/"Aguardando disponibilidade da
// equipe") e o "Intervalo entre apresentações" são breaks automáticos:
// os únicos com linkedEntryId entre os breaks.
export function isRealEntry(entry: ScheduleEntry): boolean {
  return !(entry.type === "break" && !!entry.linkedEntryId);
}

// Chave do "grupo" de um item real: as esperas/intervalos automáticos
// que vêm antes dele apontam (linkedEntryId) pra apresentação a que
// pertencem — o próprio id, se for a apresentação, ou o link dele, se
// for o aquecimento dessa apresentação.
function groupKey(entry: ScheduleEntry): string {
  return entry.type === "presentation"
    ? entry.id
    : (entry.linkedEntryId ?? entry.id);
}

function entryMid(
  times: Map<string, ComputedEntryTime>,
  entry: ScheduleEntry,
  fallback: number,
): number {
  const t = times.get(entry.id);
  return t ? (t.startMinutes + t.endMinutes) / 2 : fallback;
}

export function computeDropSlots(
  sortedEntries: ScheduleEntry[],
  times: Map<string, ComputedEntryTime>,
  dayStartMinutes: number,
  movedEntry?: ScheduleEntry,
): DropSlot[] {
  const removedIds = new Set<string>();
  if (movedEntry) {
    removedIds.add(movedEntry.id);
    if (movedEntry.type === "presentation") {
      for (const e of sortedEntries) {
        if (e.linkedEntryId === movedEntry.id) removedIds.add(e.id);
      }
    }
  }
  // removedBefore[i] = quantos itens removidos existem antes da posição i.
  const removedBefore: number[] = [0];
  for (let i = 0; i < sortedEntries.length; i++) {
    removedBefore.push(
      removedBefore[i] + (removedIds.has(sortedEntries[i].id) ? 1 : 0),
    );
  }

  const slots: DropSlot[] = [];
  let previousRealId: string | null = null;
  sortedEntries.forEach((entry, index) => {
    if (!isRealEntry(entry)) return;
    // Início do grupo: sobe por cima das esperas/intervalos dele.
    const key = groupKey(entry);
    let start = index;
    while (
      start > 0 &&
      sortedEntries[start - 1].type === "break" &&
      sortedEntries[start - 1].linkedEntryId === key
    ) {
      start--;
    }
    slots.push({
      apiIndex: start - removedBefore[start],
      minutes:
        times.get(sortedEntries[start].id)?.startMinutes ?? dayStartMinutes,
      beforeEntryId: entry.id,
      afterEntryId: previousRealId,
      beforeMidMinutes: entryMid(times, entry, dayStartMinutes),
    });
    previousRealId = entry.id;
  });

  const last = sortedEntries[sortedEntries.length - 1];
  slots.push({
    apiIndex: sortedEntries.length - removedBefore[sortedEntries.length],
    minutes: last
      ? (times.get(last.id)?.endMinutes ?? dayStartMinutes)
      : dayStartMinutes,
    beforeEntryId: null,
    afterEntryId: previousRealId,
    beforeMidMinutes: null,
  });
  return slots;
}

// Ponto de soltura pra um minuto do dia (onde o item arrastado começaria):
// antes do primeiro item real cujo meio ainda está à frente desse minuto,
// ou o ponto final se já passou de todos. É a mesma regra do "antes ou
// depois" ao soltar em cima de um item: metade da frente = antes, metade
// de trás = depois. Soltar sobre uma espera/intervalo (que pertencem ao
// grupo da apresentação seguinte) cai antes desse grupo.
export function pickSlot(slots: DropSlot[], minutes: number): DropSlot {
  for (const slot of slots) {
    if (slot.beforeMidMinutes !== null && minutes < slot.beforeMidMinutes)
      return slot;
  }
  return slots[slots.length - 1];
}

export function sameSlot(a: DropSlot | null, b: DropSlot | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.apiIndex === b.apiIndex &&
    a.beforeEntryId === b.beforeEntryId &&
    a.afterEntryId === b.afterEntryId
  );
}

// O que está sendo arrastado, pra decidir em quais recursos mostrar
// pontos de soltura: apresentação só cabe em pista (recurso que aceita
// apresentações); o resto vale em qualquer recurso.
export interface DragInfo {
  isPresentation: boolean;
  movedEntry?: ScheduleEntry;
}

// Ponto de soltura em destaque durante o arraste (recurso + ponto).
export interface DropPreview {
  resourceId: string;
  slot: DropSlot;
}

// "Início" e "fim" de uma fila para uma APRESENTAÇÃO, sobre a fila JÁ SEM
// o item movido: início = antes da primeira apresentação (colado no
// grupo dela, depois de eventos especiais de abertura); fim = depois da
// última apresentação (antes de eventos especiais de encerramento, como
// Premiação). Sem isso, "início da pista" caía antes da Abertura e "fim"
// depois da Premiação. Para eventos especiais o início/fim continuam
// sendo o índice 0 / o tamanho da fila (Abertura vai mesmo antes de tudo).
export function presentationStartIndex(entries: ScheduleEntry[]): number {
  const first = entries.findIndex((e) => e.type === "presentation");
  if (first === -1) return 0;
  let start = first;
  while (
    start > 0 &&
    entries[start - 1].type === "break" &&
    entries[start - 1].linkedEntryId === entries[first].id
  ) {
    start--;
  }
  return start;
}

export function presentationEndIndex(entries: ScheduleEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "presentation") return i + 1;
  }
  return entries.length;
}
