import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDirectChildren, hasEmptyGroup, sumMaxScore } from "@/lib/scoringTree";
import type { ScoringCriterion } from "@/api/client";

interface ScoringValidationBarProps {
  criteria: ScoringCriterion[];
  targetScore: number;
}

export function ScoringValidationBar({ criteria, targetScore }: ScoringValidationBarProps) {
  const rootCriteria = getDirectChildren(criteria, null);
  const distributed = sumMaxScore(rootCriteria);
  const sumValid = Math.abs(distributed - targetScore) < 0.001;
  const emptyGroup = hasEmptyGroup(criteria);
  const valid = sumValid && !emptyGroup;

  const message = !sumValid
    ? "A soma dos pontos não bate com a meta do template."
    : emptyGroup
      ? "Todo grupo precisa ter ao menos um item de avaliação vinculado."
      : "A soma dos pontos está correta!";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        valid
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        {valid ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
        {message}
      </span>
      <span className="font-medium text-foreground">
        Total distribuído: {distributed.toFixed(2)} / {targetScore.toFixed(2)} pts
      </span>
    </div>
  );
}
