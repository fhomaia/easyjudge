import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { normalizeDecimalInput } from "@/lib/normalizeDecimalInput";

const INTEGER_LEVELS = [1, 2, 3, 4, 5, 6, 7];

interface CategoryLevelSelectorProps {
  selectedLevels: Set<number>;
  onToggleLevel: (level: number) => void;
  customLevels: string[];
  onCustomLevelsChange: (customLevels: string[]) => void;
}

export function CategoryLevelSelector({
  selectedLevels,
  onToggleLevel,
  customLevels,
  onCustomLevelsChange,
}: CategoryLevelSelectorProps) {
  function addCustomLevel() {
    onCustomLevelsChange([...customLevels, ""]);
  }

  function updateCustomLevel(index: number, value: string) {
    onCustomLevelsChange(
      customLevels.map((v, i) => (i === index ? normalizeDecimalInput(value) : v)),
    );
  }

  function removeCustomLevel(index: number) {
    onCustomLevelsChange(customLevels.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-3">
      <Label>Níveis (uma categoria é criada por nível selecionado)</Label>
      <div className="flex flex-wrap gap-2">
        {INTEGER_LEVELS.map((level) => {
          const active = selectedLevels.has(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => onToggleLevel(level)}
              className={cn(
                "flex size-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {level}
            </button>
          );
        })}
        <button
          type="button"
          onClick={addCustomLevel}
          aria-label="Adicionar nível customizado"
          title="Adicionar nível customizado"
          className="flex size-11 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {customLevels.length > 0 && (
        <div className="grid gap-2">
          {customLevels.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="Nível customizado (ex.: 3.5)"
                value={value}
                onChange={(e) => updateCustomLevel(index, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeCustomLevel(index)}
                aria-label="Remover nível customizado"
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
