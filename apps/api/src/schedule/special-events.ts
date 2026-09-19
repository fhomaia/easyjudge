import { SpecialEventAnchor } from './enums/auto-generate-order.enum';
import type { SpecialEventDto } from './dto/special-event.dto';

export type SpecialEvent = SpecialEventDto;

// Uma "raiz" (evento com âncora própria: horário fixo, início ou fim) e
// os eventos que dependem dela (antes/depois), já na ordem em que
// entram na fila.
export interface SpecialEventCluster {
  timeMinutes: number | null;
  items: SpecialEvent[];
}

export interface SpecialEventPlan {
  start: SpecialEventCluster[];
  time: SpecialEventCluster[];
  end: SpecialEventCluster[];
}

// Retorna a mensagem do primeiro problema encontrado, ou null.
export function findSpecialEventsProblem(events: SpecialEvent[]): string | null {
  const byId = new Map<string, SpecialEvent>();
  for (const e of events) {
    if (byId.has(e.id)) return 'Há eventos especiais com o mesmo identificador.';
    byId.set(e.id, e);
  }
  for (const e of events) {
    if (
      e.anchor !== SpecialEventAnchor.BEFORE &&
      e.anchor !== SpecialEventAnchor.AFTER
    ) {
      continue;
    }
    if (!e.refId || !byId.has(e.refId)) {
      return `O evento especial "${e.label}" se refere a outro evento que não existe.`;
    }
    // Segue a cadeia de referências: voltar a um já visitado é ciclo
    // (inclui o caso de referir a si mesmo).
    const visited = new Set<string>([e.id]);
    let current: SpecialEvent | undefined = byId.get(e.refId);
    while (current) {
      if (visited.has(current.id)) {
        return `O evento especial "${e.label}" forma uma referência circular.`;
      }
      visited.add(current.id);
      const isRelative =
        current.anchor === SpecialEventAnchor.BEFORE ||
        current.anchor === SpecialEventAnchor.AFTER;
      current = isRelative && current.refId ? byId.get(current.refId) : undefined;
    }
  }
  return null;
}

// Agrupa em raízes + dependentes. Eventos "antes de X" entram
// imediatamente antes de X e "depois de X" imediatamente depois, na
// ordem da lista; dependentes de dependentes seguem a mesma regra.
// Assume a lista já validada (sem ciclo).
export function planSpecialEvents(events: SpecialEvent[]): SpecialEventPlan {
  const befores = new Map<string, SpecialEvent[]>();
  const afters = new Map<string, SpecialEvent[]>();
  for (const e of events) {
    if (!e.refId) continue;
    const target =
      e.anchor === SpecialEventAnchor.BEFORE
        ? befores
        : e.anchor === SpecialEventAnchor.AFTER
          ? afters
          : null;
    if (!target) continue;
    const list = target.get(e.refId) ?? [];
    list.push(e);
    target.set(e.refId, list);
  }
  const expand = (e: SpecialEvent): SpecialEvent[] => [
    ...(befores.get(e.id) ?? []).flatMap(expand),
    e,
    ...(afters.get(e.id) ?? []).flatMap(expand),
  ];
  const cluster = (e: SpecialEvent): SpecialEventCluster => ({
    timeMinutes: e.anchor === SpecialEventAnchor.TIME ? (e.timeMinutes ?? 0) : null,
    items: expand(e),
  });
  return {
    start: events.filter((e) => e.anchor === SpecialEventAnchor.START).map(cluster),
    time: events
      .filter((e) => e.anchor === SpecialEventAnchor.TIME)
      .sort((a, b) => (a.timeMinutes ?? 0) - (b.timeMinutes ?? 0))
      .map(cluster),
    end: events.filter((e) => e.anchor === SpecialEventAnchor.END).map(cluster),
  };
}
