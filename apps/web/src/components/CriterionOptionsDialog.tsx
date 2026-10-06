import { useEffect, useRef, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/DatePicker";
import { FormError } from "@/components/FormError";
import {
  BUILT_IN_OPTION_DEFAULTS,
  CRITERION_LABELS,
  levelLabel,
  levelProblem,
} from "@/lib/categoryCriteria";
import {
  ApiError,
  categoryCriteriaApi,
  type CategoryCriterion,
  type CategoryCriterionKey,
  type CategoryCriterionOption,
} from "@/api/client";

// O que cada regra significa, no topo do popup.
const DESCRIPTIONS: Record<CategoryCriterionKey, string> = {
  institution: "Opções de vínculo institucional deste evento.",
  regime: "Opções de regime de competição deste evento.",
  age_group:
    "Opções de faixa etária deste evento. A idade dos atletas é conferida pela data de nascimento no envio da inscrição.",
  gender: "Opções de gênero deste evento.",
  level: "Níveis oferecidos nas categorias deste evento.",
  size: "Opções de tamanho deste evento. O mínimo e o máximo de atletas são conferidos no envio da inscrição.",
};

// Campos numéricos guardados como texto enquanto se digita (ver gotcha
// de input number controlado no CLAUDE.md).
interface DraftOption {
  rowKey: string;
  id: string | null;
  builtIn: boolean;
  label: string;
  minAge: string;
  maxAge: string;
  minAthletes: string;
  maxAthletes: string;
  // Nível
  build: string;
  tumbling: string; // "same" | "1".."7" | "none"
}

// Valores padrão da opção (só opções padrão de Faixa etária/Tamanho),
// já no formato do formulário; null = sem padrão.
function defaultsFor(row: DraftOption): Partial<DraftOption> | null {
  if (!row.builtIn || !row.id) return null;
  const d = BUILT_IN_OPTION_DEFAULTS[row.id];
  if (!d) return null;
  return {
    label: d.label,
    minAge: text(d.minAge),
    maxAge: text(d.maxAge),
    minAthletes: text(d.minAthletes),
    maxAthletes: text(d.maxAthletes),
  };
}

function differsFromDefault(row: DraftOption, key: CategoryCriterionKey): boolean {
  const d = defaultsFor(row);
  if (!d) return false;
  const fields: (keyof DraftOption)[] =
    key === "age_group" ? ["label", "minAge", "maxAge"] : ["label", "minAthletes", "maxAthletes"];
  return fields.some((f) => (row[f] as string).trim() !== d[f]);
}

let rowCounter = 0;
const nextRowKey = () => `row-${++rowCounter}`;
const text = (n: number | null | undefined) => (n == null ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const digits = (value: string, max = 3) => value.replace(/\D/g, "").slice(0, max);

function emptyRow(): DraftOption {
  return {
    rowKey: nextRowKey(),
    id: null,
    builtIn: false,
    label: "",
    minAge: "",
    maxAge: "",
    minAthletes: "",
    maxAthletes: "",
    build: "",
    tumbling: "same",
  };
}

function toDraft(criterion: CategoryCriterion): DraftOption[] {
  return criterion.options.map((o) => {
    const level = o.level ?? null;
    const build = level != null ? Math.floor(level + 1e-9) : null;
    const tumblingDigit = level != null && build != null ? Math.round((level - build) * 10) : 0;
    return {
      ...emptyRow(),
      id: o.id,
      builtIn: !!o.builtIn,
      label: o.label,
      minAge: text(o.minAge),
      maxAge: text(o.maxAge),
      minAthletes: text(o.minAthletes),
      maxAthletes: text(o.maxAthletes),
      build: text(build),
      tumbling: o.nonTumbling ? "none" : tumblingDigit ? String(tumblingDigit) : "same",
    };
  });
}

function levelOf(row: DraftOption): { level: number; nonTumbling: boolean } | null {
  if (!row.build) return null;
  const build = Number(row.build);
  if (row.tumbling === "none") return { level: build, nonTumbling: true };
  if (row.tumbling === "same" || Number(row.tumbling) === build) {
    return { level: build, nonTumbling: false };
  }
  return { level: build + Number(row.tumbling) / 10, nonTumbling: false };
}

const BUILD_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"];
const TUMBLING_LABELS: Record<string, string> = {
  same: "Mesmo nível",
  none: "Sem tumbling (.0)",
  ...Object.fromEntries(BUILD_OPTIONS.map((n) => [n, `Tumbling ${n}`])),
};

export function CriterionOptionsDialog({
  eventId,
  criterionKey,
  startWithNewOption,
  editOptionId = null,
  criteria,
  onOpenChange,
  onSaved,
}: {
  eventId: string;
  // null = fechado.
  criterionKey: CategoryCriterionKey | null;
  // Aberto pela caixinha "+ Adicionar": já começa com uma linha nova.
  startWithNewOption: boolean;
  // Aberto pelo lápis de uma opção criada pelo produtor: só ela aparece
  // (renomear, ajustar a regra ou excluir).
  editOptionId?: string | null;
  criteria: CategoryCriterion[];
  onOpenChange: (open: boolean) => void;
  // newOptionIds: opções criadas agora (a tela já marca elas).
  onSaved: (criteria: CategoryCriterion[], newOptionIds: string[]) => void;
}) {
  const criterion = criteria.find((c) => c.key === criterionKey) ?? null;
  const [rows, setRows] = useState<DraftOption[]>([]);
  const [cutoff, setCutoff] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstNewRow = useRef<string | null>(null);

  useEffect(() => {
    if (!criterion) return;
    const draft = toDraft(criterion);
    if (startWithNewOption) {
      const row = emptyRow();
      firstNewRow.current = row.rowKey;
      draft.push(row);
    } else {
      firstNewRow.current = null;
    }
    setRows(draft);
    setCutoff(criterion.ageCutoffDate ?? "");
    setError(null);
    // Só ao abrir (os critérios não mudam com o popup aberto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criterionKey, startWithNewOption, editOptionId]);

  if (!criterion) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }
  const key = criterion.key;
  const isLevel = key === "level";

  function update(rowKey: string, patch: Partial<DraftOption>) {
    setRows((list) => list.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setError(null);
    const options: CategoryCriterionOption[] = [];
    for (const row of rows) {
      if (isLevel) {
        const value = levelOf(row);
        if (!value) {
          setError("Escolha o nível de construção de cada linha.");
          return;
        }
        const problem = levelProblem(value.level, value.nonTumbling);
        if (problem) {
          setError(problem);
          return;
        }
        options.push({ id: row.id, label: "", ...value });
        continue;
      }
      if (!row.label.trim()) {
        setError("Toda opção precisa de nome.");
        return;
      }
      options.push({
        id: row.id,
        label: row.label.trim(),
        minAge: key === "age_group" ? num(row.minAge) : undefined,
        maxAge: key === "age_group" ? num(row.maxAge) : undefined,
        minAthletes: key === "size" ? num(row.minAthletes) : undefined,
        maxAthletes: key === "size" ? num(row.maxAthletes) : undefined,
      });
    }

    const payload = criteria.map((c) =>
      c.key === key
        ? { ...c, options, ageCutoffDate: key === "age_group" ? cutoff || null : c.ageCutoffDate }
        : c,
    );
    setSaving(true);
    try {
      const saved = await categoryCriteriaApi.update(eventId, payload);
      const before = new Set(criterion?.options.map((o) => o.id));
      const after = saved.find((c) => c.key === key)?.options ?? [];
      const newIds = after.map((o) => o.id).filter((id): id is string => !!id && !before.has(id));
      onSaved(saved, newIds);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            {startWithNewOption
              ? `Nova opção em ${CRITERION_LABELS[key]}`
              : editOptionId
                ? `Editar opção de ${CRITERION_LABELS[key]}`
                : CRITERION_LABELS[key]}
          </DialogTitle>
          <DialogDescription>
            {DESCRIPTIONS[key]}
          </DialogDescription>
        </div>

        <FormError message={error} />

        {key === "age_group" && (
          <div className="grid gap-1.5">
            <Label htmlFor="age-cutoff">Idade completada até</Label>
            <div className="max-w-56">
              <DatePicker
                id="age-cutoff"
                value={cutoff}
                onChange={setCutoff}
                captionLayout="dropdown"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A idade de cada atleta é a que ele tem nessa data. Ex.: Senior com idade máxima 17 e
              data 31/03/2026 aceita quem completa 18 anos depois de março de 2026.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          {/* Pela caixinha "+ Adicionar", só as opções novas (as
              existentes continuam salvas como estão). */}
          {rows
            .filter((row) =>
              startWithNewOption
                ? row.id === null
                : editOptionId
                  ? row.id === editOptionId
                  : true,
            )
            .map((row) => (
            <div key={row.rowKey} className="grid gap-2 rounded-lg bg-muted/40 p-3">
            <div className="grid gap-2 sm:flex sm:items-end">
              {isLevel ? (
                <>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <Label className="text-xs text-muted-foreground">Construção</Label>
                    <Select
                      disabled={row.builtIn}
                      value={row.build || null}
                      onValueChange={(value) => update(row.rowKey, { build: value as string })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string | null) => (value ? `Nível ${value}` : "Escolha")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {BUILD_OPTIONS.map((n) => (
                          <SelectItem key={n} value={n}>
                            Nível {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <Label className="text-xs text-muted-foreground">Tumbling</Label>
                    <Select
                      disabled={row.builtIn}
                      value={row.tumbling}
                      onValueChange={(value) => update(row.rowKey, { tumbling: value as string })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{(value: string) => TUMBLING_LABELS[value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {["same", ...BUILD_OPTIONS, "none"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {TUMBLING_LABELS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm font-medium text-foreground sm:w-24 sm:pb-2">
                    {(() => {
                      const value = levelOf(row);
                      return value ? levelLabel(value.level, value.nonTumbling) : "";
                    })()}
                  </p>
                </>
              ) : (
                <div className="grid min-w-0 flex-1 gap-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={row.label}
                    maxLength={40}
                    autoFocus={row.rowKey === firstNewRow.current}
                    placeholder="Ex.: Sub13"
                    onChange={(e) => update(row.rowKey, { label: e.target.value })}
                  />
                </div>
              )}

              {key === "age_group" && (
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Idade mín."
                    value={row.minAge}
                    onChange={(v) => update(row.rowKey, { minAge: digits(v, 2) })}
                  />
                  <NumberField
                    label="Idade máx."
                    value={row.maxAge}
                    onChange={(v) => update(row.rowKey, { maxAge: digits(v, 2) })}
                  />
                </div>
              )}

              {key === "size" && (
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Mín. atletas"
                    value={row.minAthletes}
                    onChange={(v) => update(row.rowKey, { minAthletes: digits(v) })}
                  />
                  <NumberField
                    label="Máx. atletas"
                    value={row.maxAthletes}
                    onChange={(v) => update(row.rowKey, { maxAthletes: digits(v) })}
                  />
                </div>
              )}

              {/* Excluir uma opção criada pelo produtor é pela lixeira ao
                  lado do lápis, na própria tela da categoria. */}
            </div>
            {/* Opção padrão alterada: volta ao valor da plataforma (linha
                própria, embaixo dos campos). */}
            {differsFromDefault(row, key) && (
              <button
                type="button"
                onClick={() => update(row.rowKey, defaultsFor(row) ?? {})}
                aria-label={`Restaurar padrão de ${row.label || "opção"}`}
                className="flex items-center gap-1.5 justify-self-start text-xs font-medium text-primary hover:underline"
              >
                <RotateCcw className="size-3.5" />
                Restaurar padrão
              </button>
            )}
            </div>
            ))}
        </div>

        <button
          type="button"
          onClick={() => setRows((list) => [...list, emptyRow()])}
          hidden={startWithNewOption || !!editOptionId}
          className="flex items-center gap-1.5 justify-self-start text-sm font-medium text-primary hover:underline"
        >
          <Plus className="size-4" />
          Nova opção
        </button>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="sm:w-20"
        inputMode="numeric"
        placeholder="Sem"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
