import { findMatchingBand } from "@/lib/scoreBands";
import { CriterionInfoPopover } from "@/components/scoring/CriterionInfoPopover";
import type { ScoreBand } from "@/api/client";

interface CurrentBandBadgeProps {
  bands: ScoreBand[];
  score: number;
}

// Nome da faixa em que a nota atual se enquadra, na cor da própria
// faixa, com um ícone de informação pra descrição da faixa (diferente
// da descrição do critério) — mostrado embaixo de "Nota máxima" tanto
// no mobile quanto no desktop (o slider do desktop é um extra, não
// substitui esta linha).
export function CurrentBandBadge({ bands, score }: CurrentBandBadgeProps) {
  const band = findMatchingBand(bands, score);
  if (!band) return null;

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: band.color }} />
      <span className="text-xs font-medium" style={{ color: band.color }}>
        {band.name}
      </span>
      {band.description && (
        <CriterionInfoPopover description={band.description} label={`Descrição da faixa ${band.name}`} />
      )}
    </div>
  );
}
