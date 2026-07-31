import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResourceColorPicker } from "@/components/ResourceColorPicker";
import { VIBRANT_COLORS } from "@/lib/avatarColor";
import { validateScoreBands } from "@/lib/scoreBands";
import type { ScoreBand } from "@/api/client";

interface ScoreBandsEditorProps {
  bands: ScoreBand[];
  maxScore: number;
  onChange: (bands: ScoreBand[]) => void;
  disabled?: boolean;
}

export function ScoreBandsEditor({ bands, maxScore, onChange, disabled }: ScoreBandsEditorProps) {
  const error = validateScoreBands(bands, maxScore);

  function updateBand(index: number, patch: Partial<ScoreBand>) {
    onChange(bands.map((band, i) => (i === index ? { ...band, ...patch } : band)));
  }

  function removeBand(index: number) {
    onChange(bands.filter((_, i) => i !== index));
  }

  function addBand() {
    const previousMax = bands.length > 0 ? bands[bands.length - 1].max : 0;
    onChange([
      ...bands,
      {
        name: "",
        description: null,
        color: VIBRANT_COLORS[bands.length % VIBRANT_COLORS.length],
        min: previousMax,
        max: previousMax,
      },
    ]);
  }

  return (
    <div className="grid min-w-0 gap-3">
      {/* Faixas lado a lado com scroll horizontal próprio (não empilhadas
          verticalmente). `min-w-0` em cada nível da cadeia é necessário
          porque nem grid nem flex limitam a largura de um item pelo
          conteúdo por padrão — sem isso, a lista vaza visualmente e quem
          acaba rolando é a página inteira (`<main>`), não só esta lista. */}
      <div className="flex min-w-0 gap-3 overflow-x-auto pb-1">
        {bands.map((band, index) => (
          <div
            key={index}
            className="flex w-60 shrink-0 flex-col gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                value={band.name}
                disabled={disabled}
                placeholder="Nome da faixa (ex: Excelente)"
                onChange={(e) => updateBand(index, { name: e.target.value })}
                className="flex-1"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeBand(index)}
                  aria-label="Remover faixa"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step={0.01}
                value={band.min}
                disabled={disabled}
                onChange={(e) => updateBand(index, { min: Number(e.target.value) })}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="number"
                step={0.01}
                value={band.max}
                disabled={disabled}
                onChange={(e) => updateBand(index, { max: Number(e.target.value) })}
                className="w-20"
              />
            </div>
            <textarea
              value={band.description ?? ""}
              disabled={disabled}
              placeholder="Descrição da faixa (opcional)"
              rows={4}
              onChange={(e) => updateBand(index, { description: e.target.value || null })}
              className="w-full rounded-lg border border-transparent bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:bg-muted/70 focus-visible:border-primary focus-visible:bg-primary/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <ResourceColorPicker
              value={band.color}
              onChange={(color) => !disabled && updateBand(index, { color })}
            />
          </div>
        ))}
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addBand}>
          <Plus data-icon="inline-start" />
          Adicionar faixa
        </Button>
      )}

      {error && <p className="text-xs text-amber-600">{error}</p>}
    </div>
  );
}
