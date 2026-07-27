import type { ScheduleDay, ScheduleEntry, ScheduleEntryType, ScheduleResource } from "@/api/client";
import { computeResourceTimes } from "@/lib/scheduleTime";
import { isAutoWaitBreak } from "@/lib/scheduleEntryKind";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";
import { filterRemovedFromSchedule } from "@/lib/scheduleWithdrawal";

// "Próxima apresentação"/"Depois disso"/cronograma do desktop mostram
// qualquer componente real do cronograma (apresentação, intervalo,
// cerimônia, premiação) — só "warmup" (sub-item de uma apresentação,
// mostrado dentro do card dela) e os breaks AUTO-gerados ("Aguardando
// aquecimento"/"Aguardando disponibilidade da equipe", ver
// isAutoWaitBreak) ficam de fora.
function isDisplayableEntry(entry: ScheduleEntry): boolean {
  if (entry.type === "warmup") return false;
  if (entry.type === "break" && isAutoWaitBreak(entry)) return false;
  return true;
}

export interface WarmupWindow {
  start: number;
  end: number;
}

export interface LiveScheduleItem {
  entry: ScheduleEntry;
  resourceName: string;
  dayDate: string; // "YYYY-MM-DD" — permite a UI mostrar a data quando o
  // item não é hoje (cronograma pode ter dias passados/futuros).
  start: number; // minutos desde meia-noite
  end: number;
  warmup: WarmupWindow | null; // só apresentações têm
}

export interface NextWarmup {
  teamName: string;
  categoryName: string | null;
  warmupResourceName: string;
  presentationResourceName: string | null;
  start: number;
  end: number;
}

export interface CurrentCategoryInfo {
  categoryName: string;
  dayDate: string;
  start: number;
}

export interface EventLiveSchedule {
  next: LiveScheduleItem | null;
  upcoming: LiveScheduleItem[];
  completed: number;
  total: number;
  // Próximo aquecimento pendente (pode ser de uma equipe DIFERENTE da
  // "próxima apresentação" — aquecimentos correm em paralelo às
  // apresentações). Não é necessariamente "em andamento agora" — ver
  // comentário em `computeEventLiveSchedule`.
  nextWarmup: NextWarmup | null;
  // Categoria da primeira apresentação ainda pendente — não é "a
  // próxima troca de categoria" (2026-07-26, a pedido do usuário: com
  // poucas apresentações pendentes, muitas vezes não HÁ uma próxima
  // troca dentro da fila, e o card sumia mesmo havendo uma categoria
  // rodando/na fila). Atualiza sozinha pra categoria seguinte assim
  // que todas as apresentações da categoria atual forem concluídas.
  currentCategory: CurrentCategoryInfo | null;
}

export interface ResourceNextStatus {
  resourceId: string;
  resourceName: string;
  // Próximo item pendente nessa pista (qualquer componente do
  // cronograma, inclusive os breaks AUTO-gerados "Aguardando
  // aquecimento"/"Aguardando disponibilidade da equipe" — aqui, ao
  // contrário da lista "próximas apresentações", eles SÃO a atividade
  // real da pista, não ruído a esconder). Não afirma que já começou de
  // verdade — ver comentário em `computeResourceNextStatus`.
  next: {
    type: ScheduleEntryType;
    // Distingue o break AUTO-gerado ("Aguardando aquecimento"/
    // "Aguardando disponibilidade da equipe") de um intervalo de
    // verdade (almoço etc.) — mesmo `type: "break"`, mas a UI usa um
    // ícone diferente pra deixar claro que é espera, não pausa.
    isAutoWait: boolean;
    title: string;
    subtitle: string | null;
    dayDate: string;
    start: number;
    end: number;
  } | null;
}

// Próximo item por pista, pro card "PRÓXIMO EM CADA PISTA" da visão ao
// vivo do desktop. Só olha pistas de verdade (`supportsPresentations`);
// pistas de aquecimento têm seu próprio card ("próximo aquecimento").
//
// Pistas são recriadas por dia (cada `ScheduleDay` tem seu próprio
// `ScheduleResource[]`), então não dá pra "somar" uma pista através de
// vários dias — a função sempre mostra as pistas do dia ATIVO do
// cronograma (o dia de `live.next`, ou o primeiro dia se não houver
// mais nada pendente).
export function computeResourceNextStatus(
  days: ScheduleDay[],
  live: EventLiveSchedule,
  completedEntryIds: Set<string> = new Set(),
): ResourceNextStatus[] {
  const sortedDays = [...filterRemovedFromSchedule(days)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const activeDayDate = live.next?.dayDate ?? sortedDays[0]?.date;
  const activeDay = activeDayDate ? sortedDays.find((d) => d.date === activeDayDate) : undefined;
  if (!activeDay) return [];

  const times = computeResourceTimes(activeDay.resources, activeDay.startMinutes);
  const doneEntryIds = computeDoneEntryIds(activeDay.resources, completedEntryIds);
  return activeDay.resources
    .filter((r) => r.supportsPresentations)
    .map((resource) => {
      let next: ResourceNextStatus["next"] = null;

      for (const entry of resource.entries) {
        if (entry.type === "warmup") continue;
        const t = times.get(entry.id);
        if (!t) continue;
        if (doneEntryIds.has(entry.id)) continue;
        if (next && t.startMinutes >= next.start) continue;
        const display = getScheduleEntryDisplay(entry, t.startMinutes, t.endMinutes, []);
        next = {
          type: entry.type,
          isAutoWait: isAutoWaitBreak(entry),
          title: display.title,
          subtitle: display.subtitle,
          dayDate: activeDay.date,
          start: t.startMinutes,
          end: t.endMinutes,
        };
      }

      return { resourceId: resource.id, resourceName: resource.name, next };
    });
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Quais entries de UMA pista já "passaram" — nunca compara contra o
// relógio (2026-07-26, a pedido do usuário: comparar contra a hora
// AGENDADA era enganoso quando os jurados terminam mais rápido ou mais
// devagar que a duração planejada), só a ORDEM do cronograma + o que
// já foi realmente pontuado.
//
// Apresentação: "feita" = está em `completedEntryIds` (sinal real —
// ver ScoringService.getCompletedPresentationIds). Qualquer outro tipo
// (intervalo/cerimônia/premiação — sem sinal próprio de conclusão) usa
// a posição na ordem: já passou se vem ANTES da primeira apresentação
// ainda pendente NESTA MESMA pista. Se todas as apresentações da pista
// já foram feitas, a pista inteira conta como feita (inclusive o que
// vier depois da última). Limitação conhecida: uma pista sem NENHUMA
// apresentação (só intervalo/cerimônia) nunca tem nada marcado como
// feito por esta regra — não existe hoje um sinal real pra esse caso
// sem recorrer ao relógio, e o pedido foi explicitamente não usar o
// relógio.
function computeDoneEntryIds(
  resources: ScheduleResource[],
  completedEntryIds: Set<string>,
): Set<string> {
  const done = new Set<string>();
  for (const resource of resources) {
    const sorted = [...resource.entries].sort((a, b) => a.order - b.order);
    let hasPresentations = false;
    let pointerOrder: number | null = null;
    for (const entry of sorted) {
      if (entry.type !== "presentation") continue;
      hasPresentations = true;
      if (!completedEntryIds.has(entry.id)) {
        pointerOrder = entry.order;
        break;
      }
    }
    const resourceFullyDone = hasPresentations && pointerOrder === null;
    for (const entry of sorted) {
      if (resourceFullyDone || (pointerOrder !== null && entry.order < pointerOrder)) {
        done.add(entry.id);
      }
    }
  }
  return done;
}

function findWarmupFor(
  presentationEntry: ScheduleEntry,
  day: ScheduleDay,
  times: Map<string, { startMinutes: number; endMinutes: number }>,
): WarmupWindow | null {
  for (const resource of day.resources) {
    const warmupEntry = resource.entries.find(
      (e) => e.type === "warmup" && e.linkedEntryId === presentationEntry.id,
    );
    if (warmupEntry) {
      const t = times.get(warmupEntry.id);
      return t ? { start: t.startMinutes, end: t.endMinutes } : null;
    }
  }
  return null;
}

// Horário nunca é persistido (ver scheduleTime.ts), e "próxima
// apresentação" nunca compara contra o relógio (ver
// computeDoneEntryIds) — só a ORDEM do plano (dia, depois horário do
// dia) + o que já foi realmente pontuado. Antes do evento começar (ou
// pra qualquer pista que ainda não teve nenhuma apresentação
// concluída), isso já cai naturalmente no primeiro item do cronograma
// na ordem do plano, sem precisar de um caso especial.
export function computeEventLiveSchedule(
  days: ScheduleDay[],
  completedEntryIds: Set<string> = new Set(),
): EventLiveSchedule {
  const sortedDays = [...filterRemovedFromSchedule(days)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const allItems: LiveScheduleItem[] = [];
  const allWarmups: (NextWarmup & { dayDate: string; linkedEntryId: string | null })[] = [];
  const allDoneEntryIds = new Set<string>();

  for (const day of sortedDays) {
    const times = computeResourceTimes(day.resources, day.startMinutes);
    for (const id of computeDoneEntryIds(day.resources, completedEntryIds)) allDoneEntryIds.add(id);

    for (const resource of day.resources) {
      for (const entry of resource.entries) {
        if (!isDisplayableEntry(entry)) continue;
        const t = times.get(entry.id);
        if (!t) continue;
        const warmup = entry.type === "presentation" ? findWarmupFor(entry, day, times) : null;
        allItems.push({
          entry,
          resourceName: resource.name,
          dayDate: day.date,
          start: t.startMinutes,
          end: t.endMinutes,
          warmup,
        });
      }

      // Aquecimentos não entram em `allItems` (ver isDisplayableEntry)
      // — coletados à parte pro "próximo aquecimento".
      for (const entry of resource.entries) {
        if (entry.type !== "warmup") continue;
        const t = times.get(entry.id);
        if (!t) continue;

        let presentationResourceName: string | null = null;
        let categoryName = entry.categoryName;
        if (entry.linkedEntryId) {
          for (const r2 of day.resources) {
            const p = r2.entries.find((e) => e.id === entry.linkedEntryId);
            if (p) {
              presentationResourceName = r2.name;
              categoryName = categoryName ?? p.categoryName;
              break;
            }
          }
        }

        allWarmups.push({
          dayDate: day.date,
          teamName: entry.teamName ?? "Equipe",
          categoryName,
          warmupResourceName: resource.name,
          presentationResourceName,
          start: t.startMinutes,
          end: t.endMinutes,
          linkedEntryId: entry.linkedEntryId ?? null,
        });
      }
    }
  }

  allWarmups.sort((a, b) => (a.dayDate === b.dayDate ? a.start - b.start : a.dayDate < b.dayDate ? -1 : 1));
  // Próximo aquecimento ainda não concluído — "concluído" aqui é o
  // sinal real da APRESENTAÇÃO que ele aquece (ver
  // ScoringService.getCompletedPresentationIds), não a ordem/relógio:
  // um aquecimento não tem conclusão própria, só faz sentido dizer que
  // passou quando a apresentação ligada a ele já foi pontuada.
  const nextWarmup =
    allWarmups.find((w) => !(w.linkedEntryId && completedEntryIds.has(w.linkedEntryId))) ?? null;

  allItems.sort((a, b) => (a.dayDate === b.dayDate ? a.start - b.start : a.dayDate < b.dayDate ? -1 : 1));

  // "Apresentações X/Y" só conta apresentações de verdade — os outros
  // componentes (intervalo, cerimônia, premiação) entram em "próxima"/
  // "depois disso", mas não nessa estatística.
  const presentations = allItems.filter((item) => item.entry.type === "presentation");
  const total = presentations.length;
  const completed = presentations.filter((item) => allDoneEntryIds.has(item.entry.id)).length;

  const pending = allItems.filter((item) => !allDoneEntryIds.has(item.entry.id));
  const [next, ...rest] = pending;

  const pendingPresentations = pending.filter((item) => item.entry.type === "presentation");
  const currentCategory: CurrentCategoryInfo | null =
    pendingPresentations.length > 0
      ? {
          categoryName: pendingPresentations[0].entry.categoryName ?? "—",
          dayDate: pendingPresentations[0].dayDate,
          start: pendingPresentations[0].start,
        }
      : null;

  return {
    next: next ?? null,
    upcoming: rest.slice(0, 12),
    completed,
    total,
    nextWarmup,
    currentCategory,
  };
}
