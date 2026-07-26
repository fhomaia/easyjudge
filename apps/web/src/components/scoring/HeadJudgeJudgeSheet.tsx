import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, Send } from "lucide-react";
import { ScoringCriteriaGroups } from "@/components/scoring/ScoringCriteriaGroups";
import { LegalityDeductionsPanel } from "@/components/scoring/LegalityDeductionsPanel";
import { ScoringSummary } from "@/components/scoring/ScoringSummary";
import { useHeadJudgeSheet } from "@/lib/useHeadJudgeSheet";
import { sumCriteriaScores, sumDeductions, sumMaxScores } from "@/lib/scoringSummary";

// Drill-down "Todas as notas" de um jurado específico, dentro do
// Painel Head Judge — reusa os mesmos componentes de critérios/
// deduções da tela de lançar notas do próprio jurado (ver
// EventLiveScoringPage), só que os eventos emitidos aqui passam por
// useHeadJudgeSheet (endpoint de edição do Head Judge, marca quem
// editou pro log). Único componente pra desktop (aside) e mobile
// (tela cheia) — a casca em volta é que muda entre HeadJudgePanel e
// HeadJudgeMobileSheet. Sem comentário/rascunho aqui de propósito —
// são privados do jurado dono da folha (ver useHeadJudgeSheet). O
// Head Judge PODE lançar a súmula por cima ("Lançar notas" no rodapé),
// pra fechar o caso de um jurado que não consegue terminar sozinho.
interface HeadJudgeJudgeSheetProps {
  eventId: string;
  scheduleEntryId: string;
  judgeParticipationId: string;
  onBack: () => void;
}

export function HeadJudgeJudgeSheet({ eventId, scheduleEntryId, judgeParticipationId, onBack }: HeadJudgeJudgeSheetProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const {
    sheet,
    hydrated,
    scores,
    deductions,
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
  } = useHeadJudgeSheet(eventId, scheduleEntryId, judgeParticipationId);

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function isGroupComplete(criteriaIds: string[]): boolean {
    return criteriaIds.length > 0 && criteriaIds.every((id) => id in scores);
  }

  const missingCriteria = sheet ? sheet.groups.flatMap((g) => g.criteria).filter((c) => !(c.id in scores)) : [];
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

  // Em caso de sucesso, volta sozinho pra aba Avaliações do painel
  // depois de um instante — dá tempo do Head Judge ver a confirmação
  // antes da tela trocar. Em caso de erro, fica na própria folha (o
  // aviso já deixa claro que vai reenviar sozinho, sem precisar
  // reabrir o jurado depois).
  async function submitAndReturn() {
    const result = await handleSubmit();
    if (result === "success") {
      setTimeout(onBack, 900);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/70 hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="truncate text-sm font-semibold text-foreground">{sheet?.judge.name ?? "Jurado"}</p>
      </div>

      {!sheet || !hydrated ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto pb-4">
            <ScoringCriteriaGroups
              groups={sheet.groups}
              scores={scores}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              isGroupComplete={isGroupComplete}
              onAdjustScore={adjustScore}
              onSetScore={setScoreDirect}
              variant="mobile"
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
          </div>

          <div className="border-t border-border bg-card p-4">
            {submitResult === "success" && (
              <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-emerald-600">
                <CheckCircle2 className="size-4" />
                Notas lançadas com sucesso.
              </p>
            )}
            {submitResult === "error" && (
              <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-red-600">
                <AlertTriangle className="size-4" />
                Não foi possível enviar agora. Vamos tentar de novo automaticamente.
              </p>
            )}
            {submitResult === null && !sheetComplete && (
              <p className="mb-2 text-center text-xs font-medium text-amber-600">
                Faltam {missingParts.join(" e ")} pra lançar as notas.
              </p>
            )}
            <button
              type="button"
              onClick={() => void submitAndReturn()}
              disabled={submitting || !sheetComplete}
              title={sheetComplete ? undefined : "Preencha todos os critérios antes de lançar as notas."}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Send className="size-4" />
              {submitting ? "Enviando..." : "Lançar notas"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
