import { useEffect, useRef, useState } from "react";
import { enqueueEvent, flushQueue, getPendingEvents } from "@/lib/scoreEventsDb";
import { reduceScoreEvents, type DeductionLogEntry } from "@/lib/scoreEventsReducer";
import { scoringApi, type DeductionType, type HeadJudgeSheet, type ScoreEventInput } from "@/api/client";

// Painel Head Judge, drill-down "Todas as notas" de OUTRO jurado —
// espelha a lógica de estado/eventos de EventLiveScoringPage, mas os
// eventos são enviados via scoringApi.headJudge (marcam
// enteredByJudgeParticipationId no backend) e ficam numa fila separada
// do IndexedDB (ver onBehalfOfJudgeParticipationId em scoreEventsDb.ts)
// da folha do próprio Head Judge, caso ele também esteja pontuando
// algo nesta mesma apresentação. Sem comentário/rascunho aqui de
// propósito — são privados do jurado dono da folha, nem o Head Judge
// enxerga (o backend já filtra esses eventos em getSheetForJudge).
export function useHeadJudgeSheet(
  eventId: string | undefined,
  scheduleEntryId: string | undefined,
  judgeParticipationId: string | undefined,
  canWrite: boolean,
) {
  const [sheet, setSheet] = useState<HeadJudgeSheet | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [deductions, setDeductions] = useState<DeductionLogEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"success" | "error" | null>(null);
  const submitResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!eventId || !scheduleEntryId || !judgeParticipationId) return;
    let cancelled = false;
    setHydrated(false);

    async function refresh() {
      if (!eventId || !scheduleEntryId || !judgeParticipationId) return;
      const data = await scoringApi.headJudge.getSheet(eventId, scheduleEntryId, judgeParticipationId);
      if (cancelled) return;
      setSheet(data);
      const pending = await getPendingEvents(eventId, scheduleEntryId, judgeParticipationId);
      if (cancelled) return;
      const reduced = reduceScoreEvents([...data.events, ...pending]);
      setScores(reduced.scores);
      setDeductions(reduced.deductions);
      setPendingCount(pending.length);
      setHydrated(true);
    }

    void refresh();
    // Recarrega periodicamente — o jurado-alvo pode estar pontuando ao
    // vivo enquanto o Head Judge está com essa folha aberta (ver
    // mesmo raciocínio em EventLiveScoringPage).
    const interval = setInterval(() => void refresh(), 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventId, scheduleEntryId, judgeParticipationId]);

  async function emitEvent(
    partial: Omit<ScoreEventInput, "id" | "clientCreatedAt" | "scheduleEntryId"> & { id?: string },
  ) {
    // Mesma regra de EventLiveScoringPage.emitEvent — Head Judge também
    // só escreve depois que o evento for iniciado (ver
    // ScoringService.assertEventStarted, aplicado a submitEventsAsHeadJudge
    // também).
    if (!eventId || !scheduleEntryId || !judgeParticipationId || !canWrite) return;
    const input: ScoreEventInput = {
      id: crypto.randomUUID(),
      scheduleEntryId,
      clientCreatedAt: new Date().toISOString(),
      ...partial,
    };
    await enqueueEvent(eventId, input, judgeParticipationId);
    const { pendingAfter } = await flushQueue(eventId);
    setPendingCount(pendingAfter);
  }

  function adjustScore(criterionId: string, maxScore: number, allowDecimal: boolean, direction: 1 | -1) {
    const step = allowDecimal ? 0.1 : 1;
    const current = scores[criterionId] ?? 0;
    const next = Math.min(maxScore, Math.max(0, Math.round((current + direction * step) * 10) / 10));
    setScores((prev) => ({ ...prev, [criterionId]: next }));
    void emitEvent({ kind: "score_set", criterionId, value: next });
  }

  function setScoreDirect(criterionId: string, maxScore: number, allowDecimal: boolean, rawValue: number) {
    const rounded = allowDecimal ? Math.round(rawValue * 10) / 10 : Math.round(rawValue);
    const next = Math.min(maxScore, Math.max(0, rounded));
    setScores((prev) => ({ ...prev, [criterionId]: next }));
    void emitEvent({ kind: "score_set", criterionId, value: next });
  }

  function addDeduction(deductionType: DeductionType) {
    const entry: DeductionLogEntry = {
      id: crypto.randomUUID(),
      deductionType,
      presentationElapsedMs: null,
      clientCreatedAt: new Date().toISOString(),
      code: null,
    };
    setDeductions((prev) => [entry, ...prev]);
    void emitEvent({ id: entry.id, kind: "deduction_add", deductionType });
  }

  function undoDeduction(deductionId: string) {
    setDeductions((prev) => prev.filter((d) => d.id !== deductionId));
    void emitEvent({ kind: "deduction_remove", undoesEventId: deductionId });
  }

  function clearAllDeductions() {
    const toRemove = deductions;
    setDeductions([]);
    for (const d of toRemove) void emitEvent({ kind: "deduction_remove", undoesEventId: d.id });
  }

  // Mesmo raciocínio de EventLiveScoringPage — corrige o horário
  // desfazendo o evento antigo e adicionando um novo com o tempo certo.
  // id/emitEvent ficam FORA do updater de setDeductions — updaters
  // precisam ser puros, React pode chamá-los mais de uma vez, e gerar
  // um id novo + disparar emitEvent a cada chamada duplicava a
  // dedução (ver mesmo fix em EventLiveScoringPage).
  function editDeductionTime(deductionId: string, presentationElapsedMs: number) {
    const target = deductions.find((d) => d.id === deductionId);
    if (!target) return;
    const replacement: DeductionLogEntry = { ...target, id: crypto.randomUUID(), presentationElapsedMs };
    setDeductions((prev) => prev.map((d) => (d.id === deductionId ? replacement : d)));
    void emitEvent({ kind: "deduction_remove", undoesEventId: deductionId });
    void emitEvent({
      id: replacement.id,
      kind: "deduction_add",
      deductionType: replacement.deductionType,
      presentationElapsedMs,
    });
  }

  function setDeductionCode(deductionId: string, code: string) {
    setDeductions((prev) => prev.map((d) => (d.id === deductionId ? { ...d, code } : d)));
    void emitEvent({ kind: "deduction_code_set", undoesEventId: deductionId, text: code });
  }

  // Head Judge lançando a súmula por cima — mesmo `sheet_submitted` que
  // o próprio jurado emitiria, só que via scoringApi.headJudge (marca
  // enteredByJudgeParticipationId). Não navega/fecha nada aqui —
  // decisão de quem chama (ex: voltar pro roster depois). `flushQueue`
  // nunca lança (falha de rede só deixa o evento na fila pro próximo
  // tick — ver scoreEventsDb.ts), então o único jeito confiável de
  // saber se deu certo é conferir se a fila DESTA folha específica
  // ainda tem algo pendente logo depois de tentar enviar.
  async function handleSubmit(): Promise<"success" | "error" | undefined> {
    if (!eventId || !scheduleEntryId || !judgeParticipationId) return undefined;
    if (submitResultTimeoutRef.current) clearTimeout(submitResultTimeoutRef.current);
    setSubmitting(true);
    setSubmitResult(null);
    await emitEvent({ kind: "sheet_submitted" });
    const stillPending = await getPendingEvents(eventId, scheduleEntryId, judgeParticipationId);
    setSubmitting(false);
    const result = stillPending.length === 0 ? "success" : "error";
    setSubmitResult(result);
    submitResultTimeoutRef.current = setTimeout(() => setSubmitResult(null), 4000);
    return result;
  }

  useEffect(() => {
    return () => {
      if (submitResultTimeoutRef.current) clearTimeout(submitResultTimeoutRef.current);
    };
  }, []);

  return {
    sheet,
    hydrated,
    scores,
    deductions,
    pendingCount,
    submitting,
    submitResult,
    adjustScore,
    setScoreDirect,
    addDeduction,
    undoDeduction,
    clearAllDeductions,
    editDeductionTime,
    setDeductionCode,
    handleSubmit,
  };
}
