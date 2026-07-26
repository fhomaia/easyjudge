import type { DeductionType, ScoreEvent, ScoreEventInput } from "@/api/client";

export interface DeductionLogEntry {
  id: string;
  deductionType: DeductionType;
  presentationElapsedMs: number | null;
  clientCreatedAt: string;
  // Código da infração — só preenchido/relevante pra
  // deductionType === "legality_infractions" (ver
  // ScoreEventKind.DEDUCTION_CODE_SET). Editável a qualquer momento,
  // sem travar a tela no instante do registro da dedução.
  code: string | null;
}

export interface ReducedScoringState {
  // Chave = criterionId. A própria presença da chave (não o valor) é
  // o sinal de "esse critério já foi tocado" — usado pro ✓ de grupo
  // completo, ver EventLiveScoringPage.
  scores: Record<string, number>;
  // Mais recente primeiro (ordem de exibição em "ÚLTIMOS REGISTROS").
  deductions: DeductionLogEntry[];
  comment: string;
  sketchDataUrl: string | null;
  // Tempo TOTAL marcado pelo cronômetro na última vez que o Jurado de
  // Legalidade clicou "Parar" (ScoreEventKind.TIMER_STOPPED) — `null`
  // se o cronômetro nunca foi parado nesta apresentação. Permite
  // reabrir a tela mostrando o relógio já parado nesse valor, em vez
  // de reiniciar do zero.
  timerStoppedAtMs: number | null;
}

// Estado atual = reduzir a lista de eventos (event sourcing, nunca lido
// de uma coluna mutável) — mesma função usada tanto pra hidratar a
// tela ao abrir (eventos do servidor + pendentes do IndexedDB) quanto,
// em teoria, por uma futura apuração server-side. Pura, sem I/O.
export function reduceScoreEvents(
  events: Array<ScoreEvent | ScoreEventInput>,
): ReducedScoringState {
  const sorted = [...events].sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));

  const scores: Record<string, number> = {};
  const deductionAdds = new Map<string, Omit<DeductionLogEntry, "code">>();
  const undone = new Set<string>();
  const codesByDeductionId = new Map<string, string>();
  let comment = "";
  let sketchDataUrl: string | null = null;
  let timerStoppedAtMs: number | null = null;

  for (const e of sorted) {
    switch (e.kind) {
      case "score_set":
        if (e.criterionId && e.value !== undefined) scores[e.criterionId] = e.value;
        break;
      case "deduction_add":
        if (e.deductionType) {
          deductionAdds.set(e.id, {
            id: e.id,
            deductionType: e.deductionType,
            presentationElapsedMs: e.presentationElapsedMs ?? null,
            clientCreatedAt: e.clientCreatedAt,
          });
        }
        break;
      case "deduction_remove":
        if (e.undoesEventId) undone.add(e.undoesEventId);
        break;
      case "deduction_code_set":
        if (e.undoesEventId && e.text !== undefined) codesByDeductionId.set(e.undoesEventId, e.text ?? "");
        break;
      case "comment_set":
        comment = e.text ?? "";
        break;
      case "sketch_set":
        sketchDataUrl = e.text ?? null;
        break;
      case "timer_stopped":
        if (e.presentationElapsedMs !== undefined) timerStoppedAtMs = e.presentationElapsedMs ?? null;
        break;
    }
  }

  const deductions = Array.from(deductionAdds.values())
    .filter((d) => !undone.has(d.id))
    .map((d) => ({ ...d, code: codesByDeductionId.get(d.id) ?? null }))
    .sort((a, b) => b.clientCreatedAt.localeCompare(a.clientCreatedAt));

  return { scores, deductions, comment, sketchDataUrl, timerStoppedAtMs };
}
