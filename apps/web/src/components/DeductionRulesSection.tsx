import { useEffect, useRef, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import {
  ApiError,
  type CustomDeductionInput,
  type DeductionRuleView,
  type DeductionType,
  type RegulationDeductionMode,
} from "@/api/client";

interface DeductionRulesSectionProps {
  deductionMode: RegulationDeductionMode;
  deductions: DeductionRuleView[];
  // Tipos padrão removidos neste evento (modo custom).
  hiddenDeductions: DeductionRuleView[];
  onModeChange: (mode: RegulationDeductionMode) => Promise<void>;
  onValueChange: (type: DeductionType, value: number) => Promise<void>;
  // Recebe a lista COMPLETA dos tipos personalizados.
  onCustomDeductionsChange: (list: CustomDeductionInput[]) => Promise<void>;
  // Recebe a lista COMPLETA dos tipos padrão removidos.
  onHiddenDeductionsChange: (list: DeductionType[]) => Promise<void>;
}

const VALUE_DEBOUNCE_MS = 600;

// Deduzir = SUBTRAIR: o organizador informa só a magnitude. A API
// guarda o valor sempre negativo, então aqui se mostra o valor absoluto
// e se descarta qualquer "-" digitado (esquecer o sinal nunca soma
// pontos à apresentação).
function toMagnitudeText(value: number): string {
  return String(Math.abs(value));
}

function stripSign(raw: string): string {
  return raw.replace(/-/g, "");
}

interface CustomRowDraft {
  id: string;
  label: string;
  value: string;
}

function toCustomRows(deductions: DeductionRuleView[]): CustomRowDraft[] {
  return deductions
    .filter((d) => d.isCustom)
    .map((d) => ({ id: d.type, label: d.label, value: toMagnitudeText(d.value) }));
}

export function DeductionRulesSection({
  deductionMode,
  deductions,
  hiddenDeductions,
  onModeChange,
  onValueChange,
  onCustomDeductionsChange,
  onHiddenDeductionsChange,
}: DeductionRulesSectionProps) {
  const builtIns = deductions.filter((d) => !d.isCustom);
  const customIdsKey = deductions.filter((d) => d.isCustom).map((d) => d.type).join(",");

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(builtIns.map((d) => [d.type, toMagnitudeText(d.value)])),
  );
  const [customRows, setCustomRows] = useState<CustomRowDraft[]>(() => toCustomRows(deductions));
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Ressincroniza os drafts só quando o modo muda (ex: IASF -> Personalizado
  // precisa mostrar os valores atuais) — não a cada save, pra não apagar o
  // que o usuário está digitando.
  useEffect(() => {
    setValues(Object.fromEntries(builtIns.map((d) => [d.type, toMagnitudeText(d.value)])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deductionMode]);

  // Tipos personalizados: ressincroniza quando a LISTA muda (adicionar/
  // excluir, ou o servidor devolveu ids novos), não a cada edição.
  useEffect(() => {
    setCustomRows(toCustomRows(deductions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customIdsKey, deductionMode]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    }
  }

  function handleValueChange(type: DeductionType, raw: string) {
    const cleaned = stripSign(raw);
    setValues((prev) => ({ ...prev, [type]: cleaned }));
    if (debounceRefs.current[type]) clearTimeout(debounceRefs.current[type]);
    debounceRefs.current[type] = setTimeout(() => {
      const parsed = Number(cleaned);
      if (cleaned.trim() !== "" && !Number.isNaN(parsed)) void run(() => onValueChange(type, parsed));
    }, VALUE_DEBOUNCE_MS);
  }

  // Lista COMPLETA a enviar, ou null se alguma linha estiver incompleta
  // (nome/valor vazio). Nunca se envia lista parcial: o servidor trata
  // uma linha ausente como EXCLUSÃO do tipo, então apagar o nome pra
  // digitar outro não pode virar um "excluir" no meio do caminho.
  function buildList(rows: CustomRowDraft[]): CustomDeductionInput[] | null {
    const list: CustomDeductionInput[] = [];
    for (const r of rows) {
      const parsed = Number(r.value);
      if (r.label.trim() === "" || r.value.trim() === "" || Number.isNaN(parsed)) return null;
      list.push({ id: r.id, label: r.label.trim(), value: parsed });
    }
    return list;
  }

  // Edição de nome/valor de um tipo personalizado existente (autosave).
  function handleCustomRowChange(id: string, patch: Partial<CustomRowDraft>) {
    const next = customRows.map((r) =>
      r.id === id ? { ...r, ...patch, value: patch.value !== undefined ? stripSign(patch.value) : r.value } : r,
    );
    setCustomRows(next);
    const key = `custom:${id}`;
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    debounceRefs.current[key] = setTimeout(() => {
      const list = buildList(next);
      if (list) void run(() => onCustomDeductionsChange(list));
    }, VALUE_DEBOUNCE_MS);
  }

  function handleCustomRowDelete(id: string) {
    const list = buildList(customRows.filter((r) => r.id !== id));
    if (!list) {
      setError("Complete o nome e o valor das outras deduções antes de excluir esta.");
      return;
    }
    void run(() => onCustomDeductionsChange(list));
  }

  // Remover/restaurar um tipo PADRÃO (só oculta neste evento; o servidor
  // recusa se já foi usado numa nota lançada).
  function handleHideBuiltIn(type: DeductionType) {
    const hidden = [...hiddenDeductions.map((d) => d.type), type];
    void run(() => onHiddenDeductionsChange(hidden));
  }

  function handleRestoreBuiltIn(type: DeductionType) {
    const hidden = hiddenDeductions.map((d) => d.type).filter((t) => t !== type);
    void run(() => onHiddenDeductionsChange(hidden));
  }

  function handleAdd() {
    const label = newLabel.trim();
    const parsed = Number(newValue);
    if (!label || newValue.trim() === "" || Number.isNaN(parsed)) {
      setError("Informe o nome e o valor (em pontos) da nova dedução.");
      return;
    }
    const current = buildList(customRows);
    if (!current) {
      setError("Complete o nome e o valor das deduções existentes antes de adicionar outra.");
      return;
    }
    void run(async () => {
      await onCustomDeductionsChange([...current, { label, value: parsed }]);
      setNewLabel("");
      setNewValue("");
    });
  }

  const isCustom = deductionMode === "custom";

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">2. Deduções</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina as deduções que serão aplicadas durante as avaliações.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Informe só o número de pontos: cada dedução aplicada é sempre subtraída do total.
        </p>
      </div>

      <RadioGroup
        value={deductionMode}
        onValueChange={(value) => void run(() => onModeChange(value as RegulationDeductionMode))}
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

      <FormError message={error} />

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tipo de dedução</th>
              <th className="px-4 py-3 font-medium">Pontos deduzidos</th>
              {isCustom && <th className="w-10 px-2 py-3" />}
            </tr>
          </thead>
          <tbody>
            {builtIns.map((deduction) => (
              <tr key={deduction.type} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 text-foreground">{deduction.label}</td>
                <td className="px-4 py-2.5">
                  {isCustom ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label={`Pontos deduzidos: ${deduction.label}`}
                        type="number"
                        min={0}
                        step={0.1}
                        value={values[deduction.type] ?? ""}
                        onChange={(e) => handleValueChange(deduction.type, e.target.value)}
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-primary"
                      />
                      <span className="text-muted-foreground">pts</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{toMagnitudeText(deduction.value)} pts</span>
                  )}
                </td>
                {isCustom && (
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleHideBuiltIn(deduction.type)}
                      aria-label={`Excluir ${deduction.label}`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {isCustom &&
              customRows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <input
                      aria-label="Nome da dedução"
                      type="text"
                      maxLength={60}
                      value={row.label}
                      onChange={(e) => handleCustomRowChange(row.id, { label: e.target.value })}
                      className="w-full min-w-32 rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label={`Pontos deduzidos: ${row.label}`}
                        type="number"
                        min={0}
                        step={0.1}
                        value={row.value}
                        onChange={(e) => handleCustomRowChange(row.id, { value: e.target.value })}
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-primary"
                      />
                      <span className="text-muted-foreground">pts</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleCustomRowDelete(row.id)}
                      aria-label={`Excluir ${row.label}`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isCustom && hiddenDeductions.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Tipos padrão removidos</p>
          <div className="flex flex-wrap gap-2">
            {hiddenDeductions.map((d) => (
              <button
                key={d.type}
                type="button"
                onClick={() => handleRestoreBuiltIn(d.type)}
                aria-label={`Restaurar ${d.label}`}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.05]"
              >
                <RotateCcw className="size-3 text-primary" />
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isCustom && (
        <div className="grid gap-2 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">Adicionar tipo de dedução</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Nome do novo tipo de dedução"
              type="text"
              maxLength={60}
              placeholder="Nome (ex.: Uniforme fora do padrão)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="min-w-48 flex-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-primary"
            />
            <input
              aria-label="Pontos deduzidos do novo tipo"
              type="number"
              min={0}
              step={0.1}
              placeholder="Pontos"
              value={newValue}
              onChange={(e) => setNewValue(stripSign(e.target.value))}
              className="w-24 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-primary"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
              <Plus data-icon="inline-start" />
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
