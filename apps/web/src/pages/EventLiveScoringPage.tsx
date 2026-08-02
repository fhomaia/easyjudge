import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, CheckCircle2, Play, RotateCcw, Send, ShieldCheck, Square } from "lucide-react";
import { EventLiveScoringDesktopView } from "@/components/EventLiveScoringDesktopView";
import { HeadJudgePanel } from "@/components/HeadJudgePanel";
import { HeadJudgeMobileSheet } from "@/components/HeadJudgeMobileSheet";
import { ScoringCriteriaGroups } from "@/components/scoring/ScoringCriteriaGroups";
import { LegalityDeductionsPanel } from "@/components/scoring/LegalityDeductionsPanel";
import { ScoringSummary } from "@/components/scoring/ScoringSummary";
import { SketchCanvas } from "@/components/SketchCanvas";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { enqueueEvent, flushQueue, getPendingEvents, startSyncLoop } from "@/lib/scoreEventsDb";
import { reduceScoreEvents, type DeductionLogEntry } from "@/lib/scoreEventsReducer";
import { sumCriteriaScores, sumDeductions, sumMaxScores } from "@/lib/scoringSummary";
import { cn } from "@/lib/utils";
import {
  eventsApi,
  scheduleApi,
  scoringApi,
  type DeductionType,
  type Event,
  type ScheduleDay,
  type ScoreEventInput,
  type ScoringSheet,
} from "@/api/client";

// Tela usada PELO JURADO DURANTE a apresentação — prioridade absoluta
// é velocidade/eficiência, não é uma tela de administração (ver
// plano). Sem menu lateral/nav do evento de propósito: é uma
// ferramenta focada, não uma página de navegação.

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function nextPresentationOnResource(
  days: ScheduleDay[] | null,
  resourceId: string,
  currentEntryId: string,
): { id: string; teamName: string; categoryName: string | null } | null {
  if (!days) return null;
  for (const day of days) {
    const resource = day.resources.find((r) => r.id === resourceId);
    if (!resource) continue;
    const current = resource.entries.find((e) => e.id === currentEntryId);
    if (!current) continue;
    const next = resource.entries
      .filter((e) => e.type === "presentation" && e.order > current.order)
      .sort((a, b) => a.order - b.order)[0];
    if (!next) return null;
    return { id: next.id, teamName: next.teamName ?? "Equipe", categoryName: next.categoryName };
  }
  return null;
}

export function EventLiveScoringPage() {
  const { id, entryId } = useParams<{ id: string; entryId: string }>();
  const navigate = useNavigate();

  useEventLiveGuard(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [sheet, setSheet] = useState<ScoringSheet | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [deductions, setDeductions] = useState<DeductionLogEntry[]>([]);
  const [comment, setComment] = useState("");
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"comments" | "sketch">("comments");
  const [supervisionOpen, setSupervisionOpen] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingContestation, setResolvingContestation] = useState(false);

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerStartRef = useRef<number | null>(null);
  const commentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    scheduleApi.listDays(id).then(setDays).catch(() => setDays([]));
  }, [id]);

  // Recarrega a folha do servidor periodicamente — necessário porque
  // notas/deduções não são só o que ESTE jurado lança: o Painel Head
  // Judge (Modo Supervisão) pode editar a mesma folha por cima a
  // qualquer momento, e sem isso a tela do jurado só refletiria a
  // edição depois de um F5 manual (sem WebSocket/realtime ainda, ver
  // CLAUDE.md). `comment`/`sketchDataUrl` só são aplicados na PRIMEIRA
  // hidratação (`hydratedRef`) — sobrescrever a cada poll enquanto o
  // jurado ainda está digitando um comentário (antes do debounce de
  // 800ms enfileirar o evento) apagaria o que ele acabou de escrever.
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!id || !entryId) return;
    let cancelled = false;

    async function refresh() {
      if (!id || !entryId) return;
      const data = await scoringApi.getSheet(id, entryId);
      if (cancelled) return;
      setSheet(data);
      const pending = await getPendingEvents(id, entryId);
      if (cancelled) return;
      const reduced = reduceScoreEvents([...data.events, ...pending]);
      setScores(reduced.scores);
      setDeductions(reduced.deductions);
      if (!hydratedRef.current) {
        setComment(reduced.comment);
        setSketchDataUrl(reduced.sketchDataUrl);
        // Cronômetro já parado antes (ex: o jurado saiu e voltou nesta
        // apresentação) — mostra o tempo TOTAL já marcado em vez de
        // reiniciar do zero (timerRunning fica false, então a tela já
        // renderiza só o botão "Reiniciar" ao lado do tempo).
        if (reduced.timerStoppedAtMs !== null) {
          setElapsedMs(reduced.timerStoppedAtMs);
        }
        hydratedRef.current = true;
        setHydrated(true);
        // Quem só tem a função de Head Judge (sem critério atribuído
        // e sem ser Jurado de Legalidade) não tem nada pra fazer em
        // Modo Julgamento — abre direto o Painel Head Judge em vez de
        // mostrar uma tela de pontuação vazia.
        if (data.isHeadJudge && !data.isLegalityJudge && data.groups.length === 0) {
          setSupervisionOpen(true);
        }
      }
    }

    refresh().catch(() => navigate(`/events/${id}/live/notes`, { replace: true }));
    const interval = setInterval(() => void refresh(), 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, entryId, navigate]);

  useEffect(() => {
    if (!id) return;
    const stop = startSyncLoop(id, (pending) => {
      setPendingCount(pending);
      if (pending === 0) setLastSyncedAt(new Date());
    });
    return stop;
  }, [id]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - (timerStartRef.current ?? Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Três estados: (a) nunca iniciado — só "Iniciar"; (b) rodando —
  // "Reiniciar" (zera e continua contando, falsa largada) + "Parar";
  // (c) parado com um tempo já marcado (por "Parar" nesta sessão ou ao
  // reabrir a apresentação depois — ver hidratação acima) — "Retomar"
  // (continua contando A PARTIR do tempo marcado) + "Reiniciar" (zera
  // e continua). "Iniciar" e "Reiniciar" são a mesma ação, só o rótulo
  // muda conforme o estado. Emite TIMER_STARTED em toda chamada
  // (inclusive "Reiniciar", uma falsa largada) — o cálculo de atraso do
  // evento (ver ScoringService.getStartedPresentations) usa sempre o
  // PRIMEIRO desses eventos por apresentação, então um reinício não
  // deturpa o horário real de início já registrado.
  function startOrRestartTimer() {
    timerStartRef.current = Date.now();
    setElapsedMs(0);
    setTimerRunning(true);
    void emitEvent({ kind: "timer_started" });
  }

  // Retoma de onde parou — desloca o "início" pro passado na medida do
  // tempo já marcado, então o próximo tick já soma a partir dele em vez
  // de do zero.
  function resumeTimer() {
    timerStartRef.current = Date.now() - elapsedMs;
    setTimerRunning(true);
  }

  // "Parar" só para o relógio — não marca mais o fim da apresentação
  // (isso agora é só o botão "Lançar notas" do rodapé). Persiste o
  // tempo total marcado (ScoreEventKind.TIMER_STOPPED) pra reabrir a
  // apresentação depois já mostrando esse valor (ver hidratação acima).
  function stopTimer() {
    setTimerRunning(false);
    void emitEvent({ kind: "timer_stopped", presentationElapsedMs: Math.round(elapsedMs / 1000) * 1000 });
  }

  // `id` opcional: normalmente gerado aqui, mas deduções precisam
  // saber o próprio id ANTES de enviar (pra "Remover" referenciar via
  // undoesEventId — ver addDeduction), então quem chama pode fixar.
  async function emitEvent(
    partial: Omit<ScoreEventInput, "id" | "clientCreatedAt" | "scheduleEntryId"> & { id?: string },
  ) {
    // Jurado só pode escrever na súmula depois que o produtor iniciar o
    // evento (ver ScoringService.assertEventStarted no backend, mesma
    // regra espelhada aqui pra não enfileirar um evento que o servidor
    // vai rejeitar pra sempre — ficaria preso na fila de retry). A UI
    // também desabilita os controles nesse estado (ver `canWrite`
    // abaixo), isto aqui é a rede de segurança.
    if (!id || !sheet || event?.status !== "started") return;
    const input: ScoreEventInput = {
      id: crypto.randomUUID(),
      scheduleEntryId: sheet.presentation.id,
      clientCreatedAt: new Date().toISOString(),
      ...partial,
    };
    await enqueueEvent(id, input);
    const { pendingAfter } = await flushQueue(id);
    setPendingCount(pendingAfter);
    if (pendingAfter === 0) setLastSyncedAt(new Date());
  }

  function adjustScore(criterionId: string, maxScore: number, allowDecimal: boolean, direction: 1 | -1) {
    const step = allowDecimal ? 0.1 : 1;
    const current = scores[criterionId] ?? 0;
    const next = Math.min(maxScore, Math.max(0, Math.round((current + direction * step) * 10) / 10));
    setScores((prev) => ({ ...prev, [criterionId]: next }));
    void emitEvent({ kind: "score_set", criterionId, value: next });
  }

  // Arrastar o slider dispara `onValueChange` a cada pixel (dezenas de
  // chamadas por segundo, confirmado em teste real: um único arraste
  // gerou 417 ScoreEvent pro mesmo critério) — gravar (`enqueueEvent`,
  // IndexedDB) continua acontecendo a cada tick, imediato e síncrono,
  // sem debounce (não abre mão do "notas nunca podem ser perdidas": o
  // valor já está durável no navegador antes de qualquer delay). Só o
  // ENVIO pro servidor (`flushQueue`) e a atualização do indicador
  // "Salvando.../Salvo automaticamente" são adiados — sem isso, o
  // indicador (e o cabeçalho inteiro, que reflow ao redor dele) pisca
  // a cada tick, deslocando visivelmente o botão "Iniciar" ao lado.
  // `scoreFlushTimerRef` é um único timer compartilhado (não por
  // critério) — propositalmente: arrastar sliders de critérios
  // diferentes em sequência rápida também não deve piscar o indicador,
  // só o `enqueueEvent` de cada evento precisa ser individual.
  const scoreFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function flushScoresNow() {
    if (!id) return;
    const { pendingAfter } = await flushQueue(id);
    setPendingCount(pendingAfter);
    if (pendingAfter === 0) setLastSyncedAt(new Date());
  }

  async function emitScoreEvent(criterionId: string, value: number) {
    if (!id || !sheet || event?.status !== "started") return;
    const input: ScoreEventInput = {
      id: crypto.randomUUID(),
      scheduleEntryId: sheet.presentation.id,
      clientCreatedAt: new Date().toISOString(),
      kind: "score_set",
      criterionId,
      value,
    };
    await enqueueEvent(id, input);
    setPendingCount((prev) => prev + 1);
    if (scoreFlushTimerRef.current) clearTimeout(scoreFlushTimerRef.current);
    scoreFlushTimerRef.current = setTimeout(() => {
      scoreFlushTimerRef.current = null;
      void flushScoresNow();
    }, 300);
  }

  // Digitar a nota direto (em vez de só +/-) — mesmo clamp/arredondamento
  // de adjustScore, só que a partir de um valor absoluto informado pelo
  // jurado em vez de um passo relativo ao valor atual. Usado tanto pelo
  // slider (arraste contínuo) quanto pelo input numérico (um commit só,
  // no blur) — o debounce de `emitScoreEvent` cobre os dois sem
  // distinguir a origem, 300ms é imperceptível num commit único.
  function setScoreDirect(criterionId: string, maxScore: number, allowDecimal: boolean, rawValue: number) {
    const rounded = allowDecimal ? Math.round(rawValue * 10) / 10 : Math.round(rawValue);
    const next = Math.min(maxScore, Math.max(0, rounded));
    setScores((prev) => ({ ...prev, [criterionId]: next }));
    void emitScoreEvent(criterionId, next);
  }

  function addDeduction(deductionType: DeductionType) {
    // Registrar uma ilegalidade sem o cronômetro nunca ter sido
    // iniciado não faz sentido (a dedução precisa de um tempo de
    // referência) — inicia automaticamente. Já rodando ou já parado
    // com um tempo marcado (ver hidratação), usa o valor atual e não
    // mexe no cronômetro.
    const hasStarted = timerRunning || elapsedMs > 0;
    if (!hasStarted) startOrRestartTimer();
    const presentationElapsedMs = hasStarted ? Math.round(elapsedMs / 1000) * 1000 : 0;
    const entry: DeductionLogEntry = {
      id: crypto.randomUUID(),
      deductionType,
      presentationElapsedMs,
      clientCreatedAt: new Date().toISOString(),
      code: null,
    };
    setDeductions((prev) => [entry, ...prev]);
    void emitEvent({
      id: entry.id,
      kind: "deduction_add",
      deductionType,
      presentationElapsedMs,
    });
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

  // Edita o horário de UMA dedução já registrada — desfaz o evento
  // antigo e adiciona um novo com o mesmo tipo e o tempo corrigido (o
  // registro original nunca é apagado/sobrescrito, só superado — mesmo
  // raciocínio de event sourcing já usado em toda a tela). O `id` local
  // muda pro do novo evento, senão um "Remover" seguinte apontaria pro
  // evento já desfeito.
  function editDeductionTime(deductionId: string, presentationElapsedMs: number) {
    // id/emitEvent ficam FORA do updater de setDeductions — updaters
    // precisam ser puros, React pode chamá-los mais de uma vez (ex:
    // StrictMode em dev), e gerar um id novo + disparar emitEvent a
    // cada chamada duplicava a dedução (dois DEDUCTION_ADD sobrevivendo
    // no servidor, só um refletido no estado local).
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

  // Código da infração (só "legality_infractions") — não substitui o
  // evento da dedução, só anota o código nele (`undoesEventId` reaponta
  // pro id do DEDUCTION_ADD, ver ScoreEventKind.DEDUCTION_CODE_SET).
  // Sem trava na hora do registro da dedução: o jurado preenche isso
  // depois, com calma.
  function setDeductionCode(deductionId: string, code: string) {
    setDeductions((prev) => prev.map((d) => (d.id === deductionId ? { ...d, code } : d)));
    void emitEvent({ kind: "deduction_code_set", undoesEventId: deductionId, text: code });
  }

  function handleCommentChange(text: string) {
    setComment(text);
    if (commentTimeoutRef.current) clearTimeout(commentTimeoutRef.current);
    commentTimeoutRef.current = setTimeout(() => void emitEvent({ kind: "comment_set", text }), 800);
  }

  function handleSketchChange(dataUrl: string) {
    setSketchDataUrl(dataUrl);
    void emitEvent({ kind: "sketch_set", text: dataUrl });
  }

  function isGroupComplete(criteriaIds: string[]): boolean {
    return criteriaIds.length > 0 && criteriaIds.every((id) => id in scores);
  }

  // Todo critério ATRIBUÍDO A ESTE jurado precisa ter nota antes de
  // lançar — sem grupos (jurado só de legalidade/head judge, sem
  // critério nenhum) é vacuamente completo, não bloqueia. Toda
  // ilegalidade registrada também precisa do código identificado antes
  // de lançar — não trava a tela no momento do registro (ver
  // addDeduction), só bloqueia o envio final.
  const missingCriteria = sheet
    ? sheet.groups.flatMap((g) => g.criteria).filter((c) => !(c.id in scores))
    : [];
  const missingIllegalityCodes = deductions.filter((d) => d.deductionType === "legality_infractions" && !d.code);
  const sheetComplete = missingCriteria.length === 0 && missingIllegalityCodes.length === 0;
  const missingParts = [
    missingCriteria.length > 0 ? `${missingCriteria.length} critério${missingCriteria.length > 1 ? "s" : ""}` : null,
    missingIllegalityCodes.length > 0
      ? `${missingIllegalityCodes.length} código${missingIllegalityCodes.length > 1 ? "s" : ""} de ilegalidade`
      : null,
  ].filter((p): p is string => p !== null);

  const totalScore = sheet ? sumCriteriaScores(sheet.groups, scores) : 0;
  const deductionsTotal = sheet ? sumDeductions(deductions, sheet.deductions) : 0;
  const finalResult = totalScore + deductionsTotal;
  const maxScore = sheet ? sumMaxScores(sheet.groups) : 0;

  const nextTeam = useMemo(
    () => (sheet && id ? nextPresentationOnResource(days, sheet.presentation.resourceId, entryId ?? "") : null),
    [days, sheet, id, entryId],
  );

  async function handleSubmit() {
    if (!id || !sheetComplete) return;
    setSubmitting(true);
    // Marca esta apresentação como enviada (badge "Concluída" na tela
    // de Notas — ver ScoringService.getMySubmittedEntryIds) — emitEvent
    // já esvazia a fila inteira (inclusive quaisquer notas/deduções
    // ainda pendentes) ao final, sem precisar de um flushQueue separado.
    await emitEvent({ kind: "sheet_submitted" });
    setSubmitting(false);
    // Segue direto pra súmula da próxima equipe nesta pista, quando
    // existir — evita o jurado ter que voltar pra tela de Notas e
    // reabrir a próxima apresentação manualmente entre uma equipe e
    // outra.
    navigate(nextTeam ? `/events/${id}/live/scoring/${nextTeam.id}` : `/events/${id}/live/notes`);
  }

  // Jurado marca a contestação desta apresentação como resolvida —
  // atualiza o estado local direto (sem esperar o próximo poll) pra
  // trocar o aviso vermelho por um de "resolvida" na hora.
  async function handleResolveContestation() {
    if (!id || !entryId) return;
    setResolvingContestation(true);
    await scoringApi.resolveContestation(id, entryId);
    setSheet((prev) => (prev ? { ...prev, contestationResolved: true } : prev));
    setResolvingContestation(false);
  }

  if (!event || !sheet || !hydrated) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  // Jurado só inicia apresentação/lança nota depois que o produtor
  // iniciar o evento — a tela em si continua aberta pra consulta (ver
  // decisão do usuário), só os controles de escrita ficam desabilitados.
  const canWrite = event.status === "started";

  const progress = sheet.presentation.presentationTimeSeconds
    ? Math.min(1, elapsedMs / 1000 / sheet.presentation.presentationTimeSeconds)
    : 0;

  return (
    <>
    <div className="flex h-svh flex-col bg-background lg:hidden">
      <header className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/events/${id}/live/notes`)}
            aria-label="Voltar"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/70 hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-foreground">{sheet.presentation.teamName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {sheet.presentation.categoryName} · {sheet.presentation.resourceName}
            </p>
          </div>
          {sheet.isHeadJudge && (
            <button
              type="button"
              onClick={() => setSupervisionOpen(true)}
              aria-label="Painel Head Judge"
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="size-4" />
            </button>
          )}
          <div className="flex shrink-0 items-center gap-1.5 text-xs">
            {pendingCount > 0 ? (
              <span className="text-amber-600">Salvando...</span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Salvo automaticamente
                {lastSyncedAt && ` às ${lastSyncedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-4">
        {sheet.contestationRequested && (
          <div
            className={cn(
              "m-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 text-sm font-medium",
              sheet.contestationResolved
                ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-red-300/50 bg-red-500/10 text-red-600",
            )}
          >
            <span className="flex items-center gap-2">
              {sheet.contestationResolved ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              {sheet.contestationResolved
                ? "Contestação resolvida."
                : "A equipe solicitou contestação desta apresentação."}
            </span>
            {!sheet.contestationResolved && (
              <button
                type="button"
                onClick={() => void handleResolveContestation()}
                disabled={resolvingContestation}
                className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {resolvingContestation ? "Enviando..." : "Marcar como resolvida"}
              </button>
            )}
          </div>
        )}

        {!canWrite && (
          <div className="m-4 flex items-center gap-2 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-3 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            O evento ainda não foi iniciado — aguarde o produtor pra lançar notas.
          </div>
        )}

        <div className={cn(!canWrite && "pointer-events-none opacity-50")}>
        {sheet.isLegalityJudge && (
          <div className="m-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">TEMPO DE APRESENTAÇÃO</p>
                <span className="text-4xl font-bold tabular-nums text-foreground">{formatTimer(elapsedMs)}</span>
              </div>
              {nextTeam && (
                <button
                  type="button"
                  onClick={() => navigate(`/events/${id}/live/scoring/${nextTeam.id}`)}
                  className="min-w-0 shrink-0 rounded-lg bg-muted px-3 py-1.5 text-right hover:bg-muted/80"
                >
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">PRÓXIMA EQUIPE</p>
                  <p className="truncate text-sm font-semibold text-foreground">{nextTeam.teamName}</p>
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {timerRunning ? (
                <>
                  <button
                    type="button"
                    onClick={startOrRestartTimer}
                    className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-base font-bold text-foreground shadow-md transition-colors hover:bg-muted/80"
                  >
                    <RotateCcw className="size-5" />
                    Reiniciar
                  </button>
                  <button
                    type="button"
                    onClick={stopTimer}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-red-700"
                  >
                    <Square className="size-5" />
                    Parar
                  </button>
                </>
              ) : elapsedMs > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={resumeTimer}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
                  >
                    <Play className="size-5" />
                    Retomar
                  </button>
                  <button
                    type="button"
                    onClick={startOrRestartTimer}
                    className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-base font-bold text-foreground shadow-md transition-colors hover:bg-muted/80"
                  >
                    <RotateCcw className="size-5" />
                    Reiniciar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startOrRestartTimer}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
                >
                  <Play className="size-5" />
                  Iniciar
                </button>
              )}
            </div>
            {sheet.presentation.presentationTimeSeconds && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <ScoringCriteriaGroups
          groups={sheet.groups}
          scores={scores}
          isGroupComplete={isGroupComplete}
          onAdjustScore={adjustScore}
          onSetScore={setScoreDirect}
          variant="mobile"
          showScoreBands
        />

        {sheet.isLegalityJudge && (
          <LegalityDeductionsPanel
            rules={sheet.deductions}
            deductions={deductions}
            onAddDeduction={addDeduction}
            onUndoDeduction={undoDeduction}
            onClearAllDeductions={clearAllDeductions}
            onEditDeductionTime={editDeductionTime}
            onSetDeductionCode={setDeductionCode}
            variant="mobile"
          />
        )}

        <ScoringSummary
          totalScore={totalScore}
          hasCriteria={sheet.groups.length > 0}
          deductionsTotal={deductionsTotal}
          isLegalityJudge={sheet.isLegalityJudge}
          finalResult={finalResult}
          maxScore={maxScore}
          variant="mobile"
        />

        <div className="mx-4 mt-3 rounded-2xl border border-border bg-card p-1">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActivePanel("comments")}
              className={cn(
                "flex-1 rounded-xl py-2 text-sm font-medium",
                activePanel === "comments" ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              Comentários
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("sketch")}
              className={cn(
                "flex-1 rounded-xl py-2 text-sm font-medium",
                activePanel === "sketch" ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              Rascunho
            </button>
          </div>
          <div className="p-2">
            {activePanel === "comments" ? (
              <div>
                <textarea
                  value={comment}
                  onChange={(e) => handleCommentChange(e.target.value.slice(0, 1000))}
                  placeholder="Digite seus comentários aqui..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus-visible:border-primary"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length} / 1000</p>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Este rascunho é visível apenas para você.</p>
                <SketchCanvas initialDataUrl={sketchDataUrl} onChange={handleSketchChange} />
              </div>
            )}
          </div>
        </div>
        </div>
      </main>

      <div className="border-t border-border bg-card p-4">
        {!sheetComplete && canWrite && (
          <p className="mb-2 text-center text-xs font-medium text-amber-600">
            Faltam {missingParts.join(" e ")} pra lançar as notas.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !sheetComplete || !canWrite}
          title={
            !canWrite
              ? "O evento ainda não foi iniciado."
              : sheetComplete
                ? undefined
                : "Preencha todos os critérios antes de lançar as notas."
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Send className="size-4" />
          {submitting ? "Enviando..." : "Lançar notas"}
        </button>
      </div>
    </div>

    <AnimatePresence>
      {supervisionOpen && id && entryId && (
        <HeadJudgeMobileSheet
          key="head-judge-mobile-sheet"
          eventId={id}
          scheduleEntryId={entryId}
          canWrite={canWrite}
          onClose={() => setSupervisionOpen(false)}
        />
      )}
    </AnimatePresence>

    <div className="hidden h-svh lg:flex">
      <EventLiveScoringDesktopView
        sheet={sheet}
        scores={scores}
        deductions={deductions}
        comment={comment}
        sketchDataUrl={sketchDataUrl}
        pendingCount={pendingCount}
        lastSyncedAt={lastSyncedAt}
        submitting={submitting}
        resolvingContestation={resolvingContestation}
        onResolveContestation={handleResolveContestation}
        timerRunning={timerRunning}
        elapsedMs={elapsedMs}
        nextTeam={nextTeam}
        onBack={() => navigate(`/events/${id}/live/notes`)}
        onGoToNextTeam={() => nextTeam && navigate(`/events/${id}/live/scoring/${nextTeam.id}`)}
        onStartOrRestartTimer={startOrRestartTimer}
        onResumeTimer={resumeTimer}
        onStopTimer={stopTimer}
        onEditDeductionTime={editDeductionTime}
        onSetDeductionCode={setDeductionCode}
        isGroupComplete={isGroupComplete}
        onAdjustScore={adjustScore}
        onSetScore={setScoreDirect}
        onAddDeduction={addDeduction}
        onUndoDeduction={undoDeduction}
        onClearAllDeductions={clearAllDeductions}
        onCommentChange={handleCommentChange}
        onSketchChange={handleSketchChange}
        onSubmit={handleSubmit}
        onOpenSupervision={() => setSupervisionOpen(true)}
        canWrite={canWrite}
      />
      <AnimatePresence>
        {supervisionOpen && id && entryId && (
          <HeadJudgePanel
            key="head-judge-panel"
            eventId={id}
            scheduleEntryId={entryId}
            canWrite={canWrite}
            onClose={() => setSupervisionOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
