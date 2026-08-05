import { AlertTriangle, ArrowLeft, CheckCircle2, Play, RotateCcw, Send, ShieldCheck, Square } from "lucide-react";
import { SketchCanvas } from "@/components/SketchCanvas";
import { ScoringCriteriaGroups } from "@/components/scoring/ScoringCriteriaGroups";
import { LegalityDeductionsPanel } from "@/components/scoring/LegalityDeductionsPanel";
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
  onSubmit: () => void;
  onOpenSupervision: () => void;
  canWrite: boolean;
}

export function EventLiveScoringDesktopView({
  sheet,
  scores,
  deductions,
  comment,
  sketchDataUrl,
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
  onSubmit,
  onOpenSupervision,
  canWrite,
}: EventLiveScoringDesktopViewProps) {
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

  // Quando não há grupos de critério (jurado só de legalidade, ou sem
  // nenhuma atribuição), comentários/esboço sobem pra preencher o
  // espaço que ficaria vazio à esquerda — sem isso, "LEGALIDADE"
  // ficava confinada e esquisita num cantinho à direita, com a tela
  // toda vazia do lado (2026-07-24, a pedido do usuário). Os cards são
  // `h-full flex flex-col` e o textarea é `flex-1` (não mais
  // `rows` fixo) pra esticar até o fim do bloco disponível — só faz
  // diferença de verdade quando o pai tem altura real pra distribuir
  // (ver `flex-1` no grid que envolve isso mais abaixo).
  const commentsAndSketch = (
    <div className="grid h-full grid-cols-2 gap-4">
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-foreground">COMENTÁRIOS</p>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value.slice(0, 1000))}
          placeholder="Digite seus comentários aqui..."
          className="mt-2 min-h-[160px] w-full flex-1 resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus-visible:border-primary"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length} / 1000</p>
      </div>
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-bold tracking-wide text-foreground">RASCUNHO</p>
        <p className="mt-1 text-xs text-muted-foreground">Este rascunho é visível apenas para você.</p>
        <div className="mt-2 flex flex-1 flex-col">
          <SketchCanvas initialDataUrl={sketchDataUrl} onChange={onSketchChange} />
        </div>
      </div>
    </div>
  );

  // Extraído pra ser reusado tanto no layout "com grupos" (coluna da
  // direita, altura natural) quanto no layout "só legalidade" (linha
  // inteira esticada — ver mais abaixo), sem duplicar o JSX.
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
      className="col-span-1"
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
          </div>

          {sheet.isLegalityJudge && (
            <div className={cn("flex shrink-0 items-center gap-4", !canWrite && "pointer-events-none opacity-50")}>
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

      <main className="flex flex-1 flex-col overflow-y-auto p-6">
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

        {!canWrite && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-3 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            O evento ainda não foi iniciado — aguarde o produtor pra lançar notas.
          </div>
        )}

        <div className={cn("flex flex-1 flex-col", !canWrite && "pointer-events-none opacity-50")}>
        {sheet.groups.length === 0 ? (
          // Sem grupo de critério (só legalidade, ou nem isso) — a
          // linha ocupa o resto da página (2026-07-24, a pedido do
          // usuário: os blocos podiam esticar até o final da tela em
          // vez de ficar com altura curta e sobra vazia embaixo).
          <div className={cn("grid flex-1 gap-4", sheet.isLegalityJudge ? "grid-cols-3" : "grid-cols-1")}>
            <div className={sheet.isLegalityJudge ? "col-span-2" : "col-span-1"}>{commentsAndSketch}</div>
            {legalidadeBlock}
          </div>
        ) : sheet.isLegalityJudge ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-3">
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

              {legalidadeBlock}
            </div>

            <div className="mt-4">{commentsAndSketch}</div>
          </>
        ) : (
          <>
            {/* Sem jurado de legalidade nesta pista, os grupos ocupam a
                largura inteira (não sobra 1/3 vazio à direita) em 2
                colunas por linha, em vez de empilhados numa coluna só —
                a pedido do usuário, ao notar o espaço desperdiçado numa
                súmula sem legalidade. */}
            <div className="grid grid-cols-2 gap-4">
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

            <div className="mt-4">{commentsAndSketch}</div>
          </>
        )}
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
          {!sheetComplete && canWrite && (
            <p className="text-xs font-medium text-amber-600">Faltam {missingParts.join(" e ")} pra lançar as notas.</p>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !sheetComplete || !canWrite}
            title={
              !canWrite
                ? "O evento ainda não foi iniciado."
                : sheetComplete
                  ? undefined
                  : "Preencha todos os critérios antes de lançar as notas."
            }
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Send className="size-4" />
            {submitting ? "Enviando..." : "Lançar notas"}
          </button>
        </div>
      </footer>
    </div>
  );
}
