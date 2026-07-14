import { useEffect, useRef, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DEDUCTION_LABELS } from "@/lib/deductionLabels";
import type { DeductionRuleView, DeductionType, RegulationDeductionMode } from "@/api/client";

interface DeductionRulesSectionProps {
  deductionMode: RegulationDeductionMode;
  deductions: DeductionRuleView[];
  onModeChange: (mode: RegulationDeductionMode) => void;
  onValueChange: (type: DeductionType, value: number) => void;
}

const VALUE_DEBOUNCE_MS = 600;

export function DeductionRulesSection({
  deductionMode,
  deductions,
  onModeChange,
  onValueChange,
}: DeductionRulesSectionProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(deductions.map((d) => [d.type, String(d.value)])),
  );
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Ressincroniza os drafts só quando o modo muda (ex: IASF -> Personalizado
  // precisa mostrar os valores atuais) — não a cada save, pra não apagar o
  // que o usuário está digitando.
  useEffect(() => {
    setValues(Object.fromEntries(deductions.map((d) => [d.type, String(d.value)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deductionMode]);

  function handleValueChange(type: DeductionType, raw: string) {
    setValues((prev) => ({ ...prev, [type]: raw }));
    if (debounceRefs.current[type]) clearTimeout(debounceRefs.current[type]);
    debounceRefs.current[type] = setTimeout(() => {
      const parsed = Number(raw);
      if (raw.trim() !== "" && !Number.isNaN(parsed)) onValueChange(type, parsed);
    }, VALUE_DEBOUNCE_MS);
  }

  const isCustom = deductionMode === "custom";

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">2. Deduções</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina as deduções que serão aplicadas durante as avaliações.
        </p>
      </div>

      <RadioGroup
        value={deductionMode}
        onValueChange={(value) => onModeChange(value as RegulationDeductionMode)}
        className="gap-3"
      >
        <label className="flex items-center gap-2 text-sm text-foreground">
          <RadioGroupItem value="iasf" />
          Usar template IASF (padrão)
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <RadioGroupItem value="custom" />
          Personalizado
        </label>
      </RadioGroup>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tipo de dedução</th>
              <th className="px-4 py-3 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {deductions.map((deduction) => (
              <tr
                key={deduction.type}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-4 py-2.5 text-foreground">
                  {DEDUCTION_LABELS[deduction.type]}
                </td>
                <td className="px-4 py-2.5">
                  {isCustom ? (
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`deduction-${deduction.type}`} className="sr-only">
                        {DEDUCTION_LABELS[deduction.type]}
                      </Label>
                      <input
                        id={`deduction-${deduction.type}`}
                        type="number"
                        step={0.1}
                        value={values[deduction.type] ?? ""}
                        onChange={(e) => handleValueChange(deduction.type, e.target.value)}
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-primary"
                      />
                      <span className="text-muted-foreground">pts</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{deduction.defaultValue} pts</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
