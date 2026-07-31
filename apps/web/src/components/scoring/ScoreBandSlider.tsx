import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { buildBandGradient, findMatchingBand } from "@/lib/scoreBands";
import type { ScoreBand } from "@/api/client";

interface ScoreBandSliderProps {
  bands: ScoreBand[];
  maxScore: number;
  allowDecimal: boolean;
  value: number;
  onValueChange: (value: number) => void;
}

// Slider próprio (não o `ui/slider.tsx` genérico) pra poder colorir o
// trilho pelas faixas de pontuação e o polegar pela faixa atual — o
// componente gerado pelo shadcn não expõe essas partes internas pra
// customização. Mesmo primitivo (Base UI), só com marcação própria.
// Um controla o outro: o valor vem/vai do mesmo estado que já alimenta
// o input numérico (`scores[criterion.id]`), sem estado local aqui.
export function ScoreBandSlider({ bands, maxScore, allowDecimal, value, onValueChange }: ScoreBandSliderProps) {
  const gradient = buildBandGradient(bands, maxScore);
  const currentBand = findMatchingBand(bands, value);
  const step = allowDecimal ? 0.1 : 1;

  return (
    <div className="mt-1 w-full">
      <SliderPrimitive.Root
        min={0}
        max={maxScore}
        step={step}
        value={value}
        onValueChange={(next) => onValueChange(Array.isArray(next) ? next[0] : next)}
      >
        <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none">
          <SliderPrimitive.Track
            className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted"
            style={gradient ? { background: gradient } : undefined}
          >
            <SliderPrimitive.Indicator className="hidden" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block size-5 shrink-0 rounded-full border-2 border-background shadow-md ring-1 ring-border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-110"
            style={{ backgroundColor: currentBand?.color ?? "var(--color-primary)" }}
          />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>

      <div className="relative mt-1.5 h-8 w-full">
        {bands.map((band, index) => {
          const centerPct = (Math.min(Math.max((band.min + band.max) / 2, 0), maxScore) / maxScore) * 100;
          return (
            <span
              key={index}
              style={{ left: `${centerPct}%`, color: band.color }}
              className="absolute top-0 -translate-x-1/2 text-center text-[11px] font-medium whitespace-nowrap"
            >
              {band.name}
            </span>
          );
        })}
      </div>

      {currentBand?.description && (
        <p className="mt-1 text-xs text-muted-foreground">{currentBand.description}</p>
      )}
    </div>
  );
}
