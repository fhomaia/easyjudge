import { EventDocumentsButton } from "@/components/EventDocumentsButton";
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, Play, RotateCcw, Send, ShieldCheck, Square } from "lucide-react";
import { ScoringCriteriaGroups } from "@/components/scoring/ScoringCriteriaGroups";
import { LegalityDeductionsPanel } from "@/components/scoring/LegalityDeductionsPanel";
import { RascunhoEditor } from "@/components/scoring/RascunhoEditor";
import { ScoringSummary } from "@/components/scoring/ScoringSummary";
import type { DeductionLogEntry } from "@/lib/scoreEventsReducer";
import { sumCriteriaScores, sumDeductions, sumMaxScores } from "@/lib/scoringSummary";
import { cn } from "@/lib/utils";
import type { DeductionType, ScoringSheet } from "@/api/client";

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

interface EventLiveScoringDesktopViewProps {
  sheet: ScoringSheet;
  scores: Record<string, number>;
  deductions: DeductionLogEntry[];
  comment: string;
  sketchDataUrl: string | null;
  sketchText: string | null;
  pendingCount: number;
  lastSyncedAt: Date | null;
  submitting: boolean;
  resolvingContestation: boolean;
  onResolveContestation: () => void;
  timerRunning: boolean;
  elapsedMs: number;
  nextTeam: { id: string; teamName: string; categoryName: string | null } | null;
  onBack: () => void;
  onGoToNextTeam: () => void;
  onStartOrRestartTimer: () => void;
  onResumeTimer: () => void;
  onStopTimer: () => void;
  isGroupComplete: (criteriaIds: string[]) => boolean;
  onAdjustScore: (criterionId: string, maxScore: number, allowDecimal: boolean, direction: 1 | -1) => void;
  onSetScore: (criterionId: string, maxScore: number, allowDecimal: boolean, rawValue: number) => void;
  onAddDeduction: (deductionType: DeductionType) => void;
  onUndoDeduction: (deductionId: string) => void;
  onClearAllDeductions: () => void;
  onEditDeductionTime: (deductionId: string, presentationElapsedMs: number) => void;
  onSetDeductionCode: (deductionId: string, code: string) => void;
  onCommentChange: (text: string) => void;
  onSketchChange: (dataUrl: string) => void;
  onSketchTextChange: (text: string) => void;
  onSubmit: () => void;
  onOpenSupervision: () => void;
  canWrite: boolean;
  practiceMode: boolean;
  onTogglePracticeMode: () => void;
}

export function EventLiveScoringDesktopView({
  sheet,
  scores,
  deductions,
  comment,
  sketchDataUrl,
  sketchText,
  pendingCount,
  lastSyncedAt,
  submitting,
  resolvingContestation,
  onResolveContestation,
  timerRunning,
  elapsedMs,
  nextTeam,
  onBack,
  onGoToNextTeam,
  onStartOrRestartTimer,
  onResumeTimer,
  onStopTimer,
  isGroupComplete,
  onAdjustScore,
  onSetScore,
  onAddDeduction,
  onUndoDeduction,
  onClearAllDeductions,
  onEditDeductionTime,
  onSetDeductionCode,
  onCommentChange,
  onSketchChange,
  onSketchTextChange,
  onSubmit,
  onOpenSupervision,
  canWrite,
  practiceMode,
  onTogglePracticeMode,
}: EventLiveScoringDesktopViewProps) {
  const interactionUnlocked = canWrite || practiceMode;
  const progress = sheet.presentation.presentationTimeSeconds
    ? Math.min(1, elapsedMs / 1000 / sheet.presentation.presentationTimeSeconds)
    : 0;
  const missingCriteria = sheet.groups.flatMap((g) => g.criteria).filter((c) => !(c.id in scores));
  const missingIllegalityCodes = deductions.filter((d) => d.deductionType === "legality_infractions" && !d.code);
  const sheetComplete = missingCriteria.length === 0 && missingIllegalityCodes.length === 0;
  const missingParts = [
    missingCriteria.length > 0 ? `${missingCriteria.length} critério${missingCriteria.length > 1 ? "s" : ""}` : null,
    missingIllegalityCodes.length > 0
      ? `${missingIllegalityCodes.length} código${missingIllegalityCodes.length > 1 ? "s" : ""} de ilegalidade`
      : null,
  ].filter((p): p is string => p !== null);

  const totalScore = sumCriteriaScores(sheet.groups, scores);
  const deductionsTotal = sumDeductions(deductions, sheet.deductions);
  const finalResult = totalScore + deductionsTotal;
  const maxScore = sumMaxScores(sheet.groups);

  // Cards com altura própria (`h-full flex flex-col`, textarea
  // `flex-1`) pra esticar até o fim do bloco disponível, casando com a
  // altura NATURAL da linha 1 do grid (a mais alta entre Rascunho/
  // Ilegalidade/Comentários — ver comentário na linha 1 mais abaixo).
  // `min-h-[160px]` (~5 linhas) é o piso pro caso "Comentários sozinho"
  // (linha 3, sem grid pra esticar a partir de — ver mais abaixo) E
  // pro caso comum de Ilegalidade natural ficar baixa (pedido do
  // usuário, 2026-09-19: campo de comentário pequeno demais).
  const comentariosBlock = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-bold tracking-wide text-foreground">COMENTÁRIOS</p>
      <textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value.slice(0, 1000))}
        placeholder="Digite seus comentários aqui..."
        className="mt-2 min-h-[160px] w-full flex-1 resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus-visible:border-primary"
      />
      <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length} / 1000</p>
    </div>
  );

  const rascunhoBlock = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-wide text-foreground">RASCUNHO</p>
        <p className="text-xs text-muted-foreground">Visível apenas para você.</p>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <RascunhoEditor
          drawValue={sketchDataUrl}
          onDrawChange={onSketchChange}
          textValue={sketchText}
          onTextChange={onSketchTextChange}
          variant="desktop"
        />
      </div>
    </div>
  );

  // Só existe quando a pista tem jurado de legalidade — nesse caso
  // ocupa a vaga ao lado do Rascunho na linha 1 (ver layout mais
  // abaixo); sem legalidade, Comentários ocupa essa vaga no lugar.
  const legalidadeBlock = sheet.isLegalityJudge && (
    <LegalityDeductionsPanel
      rules={sheet.deductions}
      deductions={deductions}
      onAddDeduction={onAddDeduction}
      onUndoDeduction={onUndoDeduction}
      onClearAllDeductions={onClearAllDeductions}
      onEditDeductionTime={onEditDeductionTime}
      onSetDeductionCode={onSetDeductionCode}
      variant="desktop"
    />
  );

  return (
    <div className="flex h-svh flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card px-8 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar"
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-foreground/70 hover:bg-muted"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground">{sheet.presentation.teamName}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {sheet.presentation.categoryName} · {sheet.presentation.resourceName}
              </p>
            </div>
            {sheet.isHeadJudge && (
              <button
                type="button"
                onClick={onOpenSupervision}
                className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <ShieldCheck className="size-3.5" />
                Painel Head Judge
              </button>
            )}
            <EventDocumentsButton className="ml-1" />
          </div>

          {sheet.isLegalityJudge && (
            <div className={cn("flex shrink-0 items-center gap-4", !interactionUnlocked && "pointer-events-none opacity-50")}>
              <div className="text-right">
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">TEMPO DE APRESENTAÇÃO</p>
                <span className="text-2xl font-bold tabular-nums text-foreground">{formatTimer(elapsedMs)}</span>
              </div>
              {timerRunning ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onStartOrRestartTimer}
                    className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground shadow-md transition-colors hover:bg-muted/80"
                  >
                    <RotateCcw className="size-4" />
                    Reiniciar
                  </button>
                  <button
                    type="button"
                    onClick={onStopTimer}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-red-700"
                  >
                    <Square className="size-4" />
                    Parar
                  </button>
                </div>
              ) : elapsedMs > 0 ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onResumeTimer}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
                  >
                    <Play className="size-4" />
                    Retomar
                  </button>
                  <button
                    type="button"
                    onClick={onStartOrRestartTimer}
                    className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground shadow-md transition-colors hover:bg-muted/80"
                  >
                    <RotateCcw className="size-4" />
                    Reiniciar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onStartOrRestartTimer}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
                >
                  <Play className="size-4" />
                  Iniciar
                </button>
              )}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-4">
            {/* min-w reserva o espaço do texto mais longo ("Salvo
                automaticamente às 23:59") — sem isso, a troca de texto
                muda a largura deste bloco e, por estar entre outros
                itens de `justify-between` no header, empurra
                visivelmente o bloco de cronômetro/"Iniciar" ao lado. */}
            <div className="min-w-[210px] text-right text-xs text-muted-foreground">
              {pendingCount > 0 ? (
                <span className="text-amber-600">Salvando...</span>
              ) : (
                <span className="flex items-center justify-end gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  Salvo automaticamente
                  {lastSyncedAt && ` às ${lastSyncedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              )}
            </div>
            {nextTeam && (
              <button
                type="button"
                onClick={onGoToNextTeam}
                className="rounded-lg bg-muted px-3 py-1.5 text-right hover:bg-muted/80"
              >
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">PRÓXIMA EQUIPE</p>
                <p className="truncate text-sm font-semibold text-foreground">{nextTeam.teamName}</p>
              </button>
            )}
          </div>
        </div>
        {sheet.isLegalityJudge && sheet.presentation.presentationTimeSeconds && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </header>

      <main className="relative flex flex-1 flex-col overflow-y-auto p-6">
        {sheet.contestationRequested && (
          <div
            className={cn(
              "mb-4 flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm font-medium",
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
                onClick={onResolveContestation}
                disabled={resolvingContestation}
                className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {resolvingContestation ? "Enviando..." : "Marcar como resolvida"}
              </button>
            )}
          </div>
        )}

        {!canWrite && !practiceMode && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-3 text-sm font-medium text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              O evento ainda não foi iniciado — aguarde o produtor pra lançar notas.
            </span>
            <button
              type="button"
              onClick={onTogglePracticeMode}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/60 bg-white/60 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-white dark:bg-transparent dark:text-amber-400"
            >
              <FlaskConical className="size-3.5" />
              Praticar
            </button>
          </div>
        )}

        {!canWrite && practiceMode && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-sky-300/50 bg-sky-500/10 p-3 text-sm font-medium text-sky-700 dark:text-sky-400">
            <span className="flex items-center gap-2">
              <FlaskConical className="size-4 shrink-0" />
              Modo teste — nada do que você fizer aqui será salvo.
            </span>
            <button
              type="button"
              onClick={onTogglePracticeMode}
              className="shrink-0 rounded-lg border border-sky-400/60 bg-white/60 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-white dark:bg-transparent dark:text-sky-400"
            >
              Sair
            </button>
          </div>
        )}

        <div className={cn("flex flex-1 flex-col", !interactionUnlocked && "pointer-events-none opacity-50")}>
        {/* Linha 1, sempre: Rascunho ao lado de Ilegalidade — ou,
            quando esta pista não tem jurado de legalidade, Comentários
            sobe pra ocupar o lugar que seria dela (pedido do usuário,
            2026-09-19: não deixar o espaço vazio do lado do rascunho).
            Altura NATURAL da linha (a do card mais alto — normalmente
            Ilegalidade, que varia com a quantidade de tipos de dedução
            do regulamento): Rascunho/Comentários esticam pra casar via
            `h-full` (não uma altura fixa — travar um valor fixo aqui
            cortava a grade de tipos de dedução em eventos com muitos
            tipos, ver LegalityDeductionsPanel pro teto+rolagem só da
            LISTA de deduções já lançadas, que é o que pode crescer sem
            limite). */}
        <div className="grid grid-cols-2 gap-4">
          {rascunhoBlock}
          {sheet.isLegalityJudge ? legalidadeBlock : comentariosBlock}
        </div>

        {/* Linha 2: faixas de pontuação (dentro de ScoringCriteriaGroups,
            showScoreBands) — só existe se a pista tiver critério
            atribuído; largura inteira, não mais dividindo espaço com
            Ilegalidade na mesma linha. */}
        {sheet.groups.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <ScoringCriteriaGroups
              groups={sheet.groups}
              scores={scores}
              isGroupComplete={isGroupComplete}
              onAdjustScore={onAdjustScore}
              onSetScore={onSetScore}
              variant="desktop"
              showScoreBands
            />
          </div>
        )}

        {/* Linha 3: Comentários — só quando ainda não subiu pra linha 1
            (jurado de legalidade preenche aquela vaga com Ilegalidade,
            então Comentários aparece aqui embaixo). */}
        {sheet.isLegalityJudge && <div className="mt-4">{comentariosBlock}</div>}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
        <button
          type="button"
          disabled
          title="Em breve"
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/60 opacity-60"
        >
          <ArrowLeft className="size-4" />
          Equipe anterior
        </button>

        {(sheet.groups.length > 0 || sheet.isLegalityJudge) && (
          <ScoringSummary
            totalScore={totalScore}
            hasCriteria={sheet.groups.length > 0}
            deductionsTotal={deductionsTotal}
            isLegalityJudge={sheet.isLegalityJudge}
            finalResult={finalResult}
            maxScore={maxScore}
            variant="compact"
          />
        )}

        <div className="flex items-center gap-3">
          {!sheetComplete && interactionUnlocked && (
            <p className="text-xs font-medium text-amber-600">Faltam {missingParts.join(" e ")} pra lançar as notas.</p>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !sheetComplete || !interactionUnlocked}
            title={
              !interactionUnlocked
                ? "O evento ainda não foi iniciado."
                : sheetComplete
                  ? undefined
                  : "Preencha todos os critérios antes de lançar as notas."
            }
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Send className="size-4" />
            {submitting ? "Enviando..." : !canWrite && practiceMode ? "Simular envio" : "Lançar notas"}
          </button>
        </div>
      </footer>
    </div>
  );
}
