import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateFixedValues } from "@/lib/scoreBands";
import type { FixedScoreValue } from "@/api/client";

interface FixedValuesEditorProps {
  values: FixedScoreValue[];
  maxScore: number;
  onChange: (values: FixedScoreValue[]) => void;
  disabled?: boolean;
}

// Mesmo padrão de ScoreBandCard (ScoreBandsEditor): o valor fica num
// rascunho de texto próprio, pra deixar o campo vazio enquanto o
// usuário digita, e só sobe pro número de verdade quando é válido.
function FixedValueCard({
  item,
  disabled,
  onUpdate,
  onRemove,
}: {
  item: FixedScoreValue;
  disabled?: boolean;
  onUpdate: (patch: Partial<FixedScoreValue>) => void;
  onRemove: () => void;
}) {
  const [valueDraft, setValueDraft] = useState(() => String(item.value));

  useEffect(() => {
    const parsed = Number(valueDraft);
    if (valueDraft.trim() !== "" && !Number.isNaN(parsed) && parsed !== item.value) {
      setValueDraft(String(item.value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.value]);

  return (
    <div className="flex w-60 shrink-0 flex-col gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step={0.1}
          value={valueDraft}
          disabled={disabled}
          aria-label="Valor"
          onChange={(e) => {
            setValueDraft(e.target.value);
            const parsed = Number(e.target.value);
            if (e.target.value.trim() !== "" && !Number.isNaN(parsed)) onUpdate({ value: parsed });
          }}
          className="w-20"
        />
        <span className="flex-1 text-sm text-muted-foreground">pontos</span>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover valor"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Input
        value={item.name}
        disabled={disabled}
        placeholder="Nome (ex: 4 Skills by Most)"
        onChange={(e) => onUpdate({ name: e.target.value })}
      />
      <textarea
        value={item.description ?? ""}
        disabled={disabled}
        placeholder="Descrição (opcional)"
        rows={4}
        onChange={(e) => onUpdate({ description: e.target.value || null })}
        className="w-full rounded-lg border border-transparent bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:bg-muted/70 focus-visible:border-primary focus-visible:bg-primary/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

export function FixedValuesEditor({ values, maxScore, onChange, disabled }: FixedValuesEditorProps) {
  const error = validateFixedValues(values, maxScore);

  function updateValue(index: number, patch: Partial<FixedScoreValue>) {
    onChange(values.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeValue(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function addValue() {
    const last = values.length > 0 ? values[values.length - 1].value : 0;
    onChange([...values, { value: Math.min(maxScore, last), name: "", description: null }]);
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 gap-3 overflow-x-auto pb-1">
        {values.map((item, index) => (
          <FixedValueCard
            key={index}
            item={item}
            disabled={disabled}
            onUpdate={(patch) => updateValue(index, patch)}
            onRemove={() => removeValue(index)}
          />
        ))}
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addValue}>
          <Plus data-icon="inline-start" />
          Adicionar valor
        </Button>
      )}

      {error && <p className="text-xs text-amber-600">{error}</p>}
    </div>
  );
}
