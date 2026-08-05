import { cn } from "@/lib/utils";

// Resumo da súmula deste jurado — total (soma dos critérios que ele
// pontua), soma das deduções (só se for Jurado de Legalidade) e
// resultado final (total + deduções, já que os valores de dedução vêm
// negativos — ver lib/scoringSummary.ts). Reusado por
// EventLiveScoringPage (mobile) e EventLiveScoringDesktopView, mesmo
// padrão de variant já usado em ScoringCriteriaGroups/
// LegalityDeductionsPanel.
interface ScoringSummaryProps {
  totalScore: number;
  hasCriteria: boolean;
  deductionsTotal: number;
  isLegalityJudge: boolean;
  finalResult: number;
  maxScore: number;
  // "compact": versão de uma linha só, sem card próprio — pensada pra
  // caber dentro do rodapé de ação (entre "Equipe anterior" e o aviso
  // de critérios faltando), a pedido do usuário (o card grande de
  // antes ocupava espaço demais ali).
  variant?: "mobile" | "desktop" | "compact";
  className?: string;
}

export function ScoringSummary({
  totalScore,
  hasCriteria,
  deductionsTotal,
  isLegalityJudge,
  finalResult,
  maxScore,
  variant = "mobile",
  className,
}: ScoringSummaryProps) {
  if (!hasCriteria && !isLegalityJudge) return null;
  const isMobile = variant === "mobile";
  // % de aproveitamento — nota obtida (já com deduções aplicadas) sobre
  // a nota máxima possível. Só faz sentido com critérios pontuados de
  // verdade (maxScore > 0); sem eles (jurado só de legalidade) fica
  // sem base de comparação, não mostra.
  const utilizationPercent = hasCriteria && maxScore > 0 ? (finalResult / maxScore) * 100 : null;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-4 text-center", className)}>
        {hasCriteria && (
          <div>
            <p className="text-sm font-bold tabular-nums text-foreground">{totalScore.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        )}
        {isLegalityJudge && (
          <div>
            <p className="text-sm font-bold tabular-nums text-red-600">{deductionsTotal.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Deduções</p>
          </div>
        )}
        <div>
          <p className="text-sm font-bold tabular-nums text-primary">{finalResult.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">Resultado</p>
        </div>
        {utilizationPercent !== null && (
          <div>
            <p className="text-sm font-bold tabular-nums text-foreground">
              {utilizationPercent.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">Aproveitamento</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        isMobile && "mx-4 mt-3",
        className,
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">RESUMO</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-center">
        {hasCriteria && (
          <div>
            <p className="text-lg font-bold tabular-nums text-foreground">{totalScore.toFixed(1)}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
        )}
        {isLegalityJudge && (
          <div>
            <p className="text-lg font-bold tabular-nums text-red-600">{deductionsTotal.toFixed(1)}</p>
            <p className="text-[11px] text-muted-foreground">Deduções</p>
          </div>
        )}
        <div>
          <p className="text-lg font-bold tabular-nums text-primary">{finalResult.toFixed(1)}</p>
          <p className="text-[11px] text-muted-foreground">Resultado final</p>
        </div>
        {utilizationPercent !== null && (
          <div>
            <p className="text-lg font-bold tabular-nums text-foreground">{utilizationPercent.toFixed(1)}%</p>
            <p className="text-[11px] text-muted-foreground">Aproveitamento</p>
          </div>
        )}
      </div>
    </div>
  );
}
