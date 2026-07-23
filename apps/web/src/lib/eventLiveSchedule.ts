import type { ScheduleDay, ScheduleEntry, ScheduleEntryType } from "@/api/client";
import { computeResourceTimes } from "@/lib/scheduleTime";
import { isAutoWaitBreak } from "@/lib/scheduleEntryKind";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";

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

export interface NextCategoryChange {
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
  // Quando a categoria muda no meio da fila de apresentações pendentes
  // — ex. "Senior Coed Elite" acaba e "Senior Coed Premier" começa.
  nextCategoryChange: NextCategoryChange | null;
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
// Deliberadamente NÃO tenta dizer "isso está em andamento agora" — sem
// um status real por apresentação (não iniciada/em andamento/
// concluída, ainda não existe), comparar contra o relógio pra afirmar
// "em andamento" é enganoso (o evento pode estar atrasado/adiantado em
// relação ao plano). Por isso mostra só a próxima coisa pendente na
// ORDEM do cronograma, igual ao card "Próxima apresentação" já faz.
//
// Pistas são recriadas por dia (cada `ScheduleDay` tem seu próprio
// `ScheduleResource[]`), então não dá pra "somar" uma pista através de
// vários dias — a função sempre mostra as pistas do dia ATIVO do
// cronograma (o dia de `live.next`, ou o primeiro dia se não houver
// mais nada pendente), não do calendário real (`new Date()`).
export function computeResourceNextStatus(
  days: ScheduleDay[],
  live: EventLiveSchedule,
  isLive: boolean,
  isoToday: string,
  nowMinutes: number,
): ResourceNextStatus[] {
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const activeDayDate = live.next?.dayDate ?? sortedDays[0]?.date;
  const activeDay = activeDayDate ? sortedDays.find((d) => d.date === activeDayDate) : undefined;
  if (!activeDay) return [];

  const times = computeResourceTimes(activeDay.resources, activeDay.startMinutes);
  return activeDay.resources
    .filter((r) => r.supportsPresentations)
    .map((resource) => {
      let next: ResourceNextStatus["next"] = null;

      for (const entry of resource.entries) {
        if (entry.type === "warmup") continue;
        const t = times.get(entry.id);
        if (!t) continue;
        if (isItemDone({ dayDate: activeDay.date, end: t.endMinutes }, isLive, isoToday, nowMinutes)) continue;
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

// Um item só pode estar "concluído" se o evento já estiver em andamento
// — antes disso (`isLive` falso) nada aconteceu de verdade ainda, mesmo
// que a data do dia já tenha passado no calendário (cronograma pode ter
// sido montado com datas antigas/de teste). Com o evento ao vivo,
// compara contra "agora": dia anterior a hoje = feito, dia de hoje =
// compara o horário, dia futuro = ainda não chegou.
function isItemDone(
  item: { dayDate: string; end: number },
  isLive: boolean,
  isoToday: string,
  nowMinutes: number,
): boolean {
  if (!isLive) return false;
  if (item.dayDate < isoToday) return true;
  if (item.dayDate === isoToday) return item.end <= nowMinutes;
  return false;
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

// Horário nunca é persistido (ver scheduleTime.ts) — "agora" só pode ser
// comparado contra o horário CALCULADO a partir do plano, e só faz
// sentido comparar depois que o evento realmente começou (`isLive`).
// Antes disso, "próxima apresentação" é simplesmente o primeiro item do
// cronograma inteiro, na ordem do plano (dia, depois horário do dia) —
// sem tracking de atraso real no backend, isso assume que o evento
// anda no horário planejado uma vez iniciado.
export function computeEventLiveSchedule(
  days: ScheduleDay[],
  isLive: boolean,
  now: Date = new Date(),
): EventLiveSchedule {
  const isoToday = toIsoDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const allItems: LiveScheduleItem[] = [];
  const allWarmups: (NextWarmup & { dayDate: string })[] = [];

  for (const day of sortedDays) {
    const times = computeResourceTimes(day.resources, day.startMinutes);

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
        });
      }
    }
  }

  allWarmups.sort((a, b) => (a.dayDate === b.dayDate ? a.start - b.start : a.dayDate < b.dayDate ? -1 : 1));
  // Próximo aquecimento ainda não concluído, na ordem do cronograma —
  // mesmo raciocínio de "pending" usado pra `next`/`upcoming` abaixo,
  // não uma checagem de "contém o horário atual".
  const nextWarmup =
    allWarmups.find((w) => !isItemDone({ dayDate: w.dayDate, end: w.end }, isLive, isoToday, nowMinutes)) ?? null;

  allItems.sort((a, b) => (a.dayDate === b.dayDate ? a.start - b.start : a.dayDate < b.dayDate ? -1 : 1));

  // "Apresentações X/Y" só conta apresentações de verdade — os outros
  // componentes (intervalo, cerimônia, premiação) entram em "próxima"/
  // "depois disso", mas não nessa estatística.
  const presentations = allItems.filter((item) => item.entry.type === "presentation");
  const total = presentations.length;
  const completed = presentations.filter((item) => isItemDone(item, isLive, isoToday, nowMinutes)).length;

  const pending = allItems.filter((item) => !isItemDone(item, isLive, isoToday, nowMinutes));
  const [next, ...rest] = pending;

  const pendingPresentations = pending.filter((item) => item.entry.type === "presentation");
  let nextCategoryChange: NextCategoryChange | null = null;
  if (pendingPresentations.length > 0) {
    const currentCategory = pendingPresentations[0].entry.categoryName;
    const changed = pendingPresentations.find((item) => item.entry.categoryName !== currentCategory);
    if (changed) {
      nextCategoryChange = {
        categoryName: changed.entry.categoryName ?? "—",
        dayDate: changed.dayDate,
        start: changed.start,
      };
    }
  }

  return {
    next: next ?? null,
    upcoming: rest.slice(0, 12),
    completed,
    total,
    nextWarmup,
    nextCategoryChange,
  };
}
