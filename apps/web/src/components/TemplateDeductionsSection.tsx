import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/FormError";
import { ApiError, type TemplateDeduction } from "@/api/client";

type DeductionListInput = { id?: string; label: string; value: number; requiresCode?: boolean }[];

interface TemplateDeductionsSectionProps {
  deductions: TemplateDeduction[];
  onChange: (list: DeductionListInput) => Promise<void>;
  readOnly: boolean;
}

const VALUE_DEBOUNCE_MS = 600;

// Deduzir = SUBTRAIR: o usuário informa só a magnitude. A API guarda o
// valor sempre negativo, então aqui se mostra o valor absoluto e se
// descarta qualquer "-" digitado (esquecer o sinal nunca soma pontos à
// apresentação) — mesmo padrão já usado no regulamento antes desta
// feature virar parte do template.
function toMagnitudeText(value: number): string {
  return String(Math.abs(value));
}

function stripSign(raw: string): string {
  return raw.replace(/-/g, "");
}

interface RowDraft {
  id: string;
  label: string;
  value: string;
  requiresCode: boolean;
}

function toRows(deductions: TemplateDeduction[]): RowDraft[] {
  return deductions.map((d) => ({
    id: d.id,
    label: d.label,
    value: toMagnitudeText(d.value),
    requiresCode: d.requiresCode,
  }));
}

export function TemplateDeductionsSection({
  deductions,
  onChange,
  readOnly,
}: TemplateDeductionsSectionProps) {
  const idsKey = deductions.map((d) => d.id).join(",");
  const [rows, setRows] = useState<RowDraft[]>(() => toRows(deductions));
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newRequiresCode, setNewRequiresCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Ressincroniza os drafts só quando a LISTA muda (adicionar/excluir, ou
  // o servidor devolveu ids novos), não a cada edição de campo.
  useEffect(() => {
    setRows(toRows(deductions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    }
  }

  // Lista COMPLETA a enviar, ou null se alguma linha estiver incompleta
  // (nome/valor vazio) — nunca se envia lista parcial, uma linha ausente
  // é tratada como exclusão pelo servidor.
  function buildList(input: RowDraft[]): DeductionListInput | null {
    const list: DeductionListInput = [];
    for (const r of input) {
      const parsed = Number(r.value);
      if (r.label.trim() === "" || r.value.trim() === "" || Number.isNaN(parsed)) return null;
      list.push({ id: r.id, label: r.label.trim(), value: parsed, requiresCode: r.requiresCode });
    }
    return list;
  }

  function handleRowChange(id: string, patch: Partial<RowDraft>) {
    const next = rows.map((r) =>
      r.id === id ? { ...r, ...patch, value: patch.value !== undefined ? stripSign(patch.value) : r.value } : r,
    );
    setRows(next);
    if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id]);
    debounceRefs.current[id] = setTimeout(() => {
      const list = buildList(next);
      if (list) void run(() => onChange(list));
    }, VALUE_DEBOUNCE_MS);
  }

  // Checkbox: salva na hora (não é texto sendo digitado, não precisa de
  // debounce — mesmo padrão de qualquer toggle no resto do app).
  function handleRequiresCodeChange(id: string, requiresCode: boolean) {
    const next = rows.map((r) => (r.id === id ? { ...r, requiresCode } : r));
    setRows(next);
    const list = buildList(next);
    if (list) void run(() => onChange(list));
  }

  function handleRowDelete(id: string) {
    const remaining = rows.filter((r) => r.id !== id);
    if (remaining.length === 0) {
      setError("Mantenha pelo menos uma regra de dedução.");
      return;
    }
    const list = buildList(remaining);
    if (!list) {
      setError("Complete o nome e o valor das outras deduções antes de excluir esta.");
      return;
    }
    void run(() => onChange(list));
  }

  function handleAdd() {
    const label = newLabel.trim();
    const parsed = Number(newValue);
    if (!label || newValue.trim() === "" || Number.isNaN(parsed)) {
      setError("Informe o nome e o valor (em pontos) da nova dedução.");
      return;
    }
    const current = buildList(rows);
    if (!current) {
      setError("Complete o nome e o valor das deduções existentes antes de adicionar outra.");
      return;
    }
    void run(async () => {
      await onChange([...current, { label, value: parsed, requiresCode: newRequiresCode }]);
      setNewLabel("");
      setNewValue("");
      setNewRequiresCode(false);
    });
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Deduções</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina as deduções que serão aplicadas durante as avaliações com este sistema de
          pontuação.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Informe só o número de pontos: cada dedução aplicada é sempre subtraída do total.
          Marque "Exige especificação" pra deduções que precisam de um detalhe extra (ex.: qual
          regra foi infringida) — o jurado de legalidade vê um campo de texto extra ao aplicá-las.
        </p>
      </div>

      <FormError message={error} />

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tipo de dedução</th>
              <th className="px-4 py-3 font-medium">Pontos deduzidos</th>
              <th className="px-4 py-3 font-medium">Exige especificação</th>
              {!readOnly && <th className="w-10 px-2 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5">
                  {readOnly ? (
                    <span className="text-foreground">{row.label}</span>
                  ) : (
                    <input
                      aria-label="Nome da dedução"
                      type="text"
                      maxLength={60}
                      value={row.label}
                      onChange={(e) => handleRowChange(row.id, { label: e.target.value })}
                      className="w-full min-w-32 rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none focus-visible:border-primary"
                    />
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {readOnly ? (
                    <span className="text-muted-foreground">{row.value} pts</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label={`Pontos deduzidos: ${row.label}`}
                        type="number"
                        min={0}
                        step={0.1}
                        value={row.value}
                        onChange={(e) => handleRowChange(row.id, { value: e.target.value })}
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-primary"
                      />
                      <span className="text-muted-foreground">pts</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Checkbox
                    checked={row.requiresCode}
                    disabled={readOnly}
                    onCheckedChange={(value) => handleRequiresCodeChange(row.id, value === true)}
                    aria-label={`Exige especificação: ${row.label}`}
                  />
                </td>
                {!readOnly && (
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleRowDelete(row.id)}
                      aria-label={`Excluir ${row.label}`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
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
            <label className="flex items-center gap-1.5 text-sm text-foreground">
              <Checkbox
                checked={newRequiresCode}
                onCheckedChange={(value) => setNewRequiresCode(value === true)}
              />
              Exige especificação
            </label>
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
