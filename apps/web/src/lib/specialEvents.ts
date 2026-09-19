import type { SpecialEvent } from "@/api/client";

// Vai seguindo a cadeia de "antes/depois de" a partir de `refId`; se
// voltar pro próprio `id`, apontar pra ele criaria um ciclo (regra
// espelhada no backend, findSpecialEventsProblem).
export function wouldCreateCycle(
  events: SpecialEvent[],
  id: string,
  refId: string,
): boolean {
  const byId = new Map(events.map((e) => [e.id, e]));
  const visited = new Set<string>();
  let current = byId.get(refId);
  while (current) {
    if (current.id === id) return true;
    if (visited.has(current.id)) return true;
    visited.add(current.id);
    const relative = current.anchor === "before" || current.anchor === "after";
    current = relative && current.refId ? byId.get(current.refId) : undefined;
  }
  return false;
}

export function newSpecialEventId(): string {
  return crypto.randomUUID();
}

// Um problema que impede avançar/gerar (mensagem pro usuário), ou null.
export function findSpecialEventsFormProblem(
  events: SpecialEvent[],
): string | null {
  for (const e of events) {
    if (!e.label.trim()) return "Dê um nome a todos os eventos especiais.";
    if (!Number.isInteger(e.durationMinutes) || e.durationMinutes < 1) {
      return `Informe a duração de "${e.label}" (mínimo 1 minuto).`;
    }
    if (e.anchor === "time" && e.timeMinutes === undefined) {
      return `Informe o horário de "${e.label}".`;
    }
    if ((e.anchor === "before" || e.anchor === "after") && !e.refId) {
      return `Escolha o evento de referência de "${e.label}".`;
    }
  }
  return null;
}
