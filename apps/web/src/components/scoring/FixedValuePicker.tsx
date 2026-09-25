import { cn } from "@/lib/utils";
import { findFixedValue } from "@/lib/scoreBands";
import { CriterionInfoPopover } from "@/components/scoring/CriterionInfoPopover";
import type { FixedScoreValue } from "@/api/client";

interface FixedValuePickerProps {
  values: FixedScoreValue[];
  // Nota atual, ou null quando o jurado ainda não escolheu nada.
  score: number | null;
  onSelect: (value: number) => void;
  variant: "mobile" | "desktop";
  // Mesmo gate de ScoringCriteriaGroups.showScoreBands: descrição do
  // valor e marcação das outras equipes só na folha do próprio jurado.
  showDetails: boolean;
  teamScores?: { value: number; teamName: string }[];
}

// Item de avaliação com valores fixos (ex.: Stunt Difficulty só aceita
// 2.5/3.0/3.5/4.0/4.5): um botão por valor no lugar do campo +/- e do
// slider. Tocar num botão grava a nota pelo mesmo caminho de sempre
// (onSetScore -> ScoreEvent), então nada muda na gravação.
export function FixedValuePicker({
  values,
  score,
  onSelect,
  variant,
  showDetails,
  teamScores = [],
}: FixedValuePickerProps) {
  const isMobile = variant === "mobile";
  const selected = score === null ? null : findFixedValue(values, score);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {values.map((item) => {
          const isSelected = selected?.value === item.value;
          // Outras equipes da categoria que receberam este valor (mesma
          // ideia dos marcadores do ScoreBandSlider): só um ponto no
          // botão, com os nomes no title.
          const others = showDetails
            ? teamScores.filter((t) => Math.abs(t.value - item.value) < 1e-6).map((t) => t.teamName)
            : [];
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onSelect(item.value)}
              aria-pressed={isSelected}
              aria-label={`${item.value.toFixed(1)}: ${item.name}`}
              title={others.length > 0 ? `Também atribuído a: ${others.join(", ")}` : item.name}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border px-3 font-bold tabular-nums transition-colors",
                isMobile ? "min-w-14 py-2.5 text-base" : "min-w-16 py-1.5 text-sm",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {item.value.toFixed(1)}
              {!isMobile && (
                <span
                  className={cn(
                    "max-w-40 truncate text-[11px] font-medium",
                    isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                  )}
                >
                  {item.name}
                </span>
              )}
              {others.length > 0 && (
                <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-foreground/60 ring-2 ring-background" />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground">{selected.name}</span>
            {isMobile && showDetails && selected.description && (
              <CriterionInfoPopover description={selected.description} label={`Descrição de ${selected.name}`} />
            )}
          </div>
          {!isMobile && showDetails && selected.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
          )}
        </div>
      )}
      {/* Nota lançada antes do critério virar valores fixos (ou vinda
          de outro caminho) que não bate com nenhum botão. */}
      {score !== null && score > 0 && !selected && (
        <p className="mt-1.5 text-xs text-amber-600">
          A nota atual ({score.toFixed(1)}) não é um dos valores permitidos. Escolha um valor acima.
        </p>
      )}
    </div>
  );
}
