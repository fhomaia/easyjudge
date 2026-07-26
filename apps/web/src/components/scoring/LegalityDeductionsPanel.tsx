import { useState } from "react";
import { Check, Pencil, Scale, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeductionLogEntry } from "@/lib/scoreEventsReducer";
import { DEDUCTION_ICONS, DEDUCTION_FALLBACK_ICON, formatElapsed, parseElapsed } from "@/lib/deductionIcons";
import { DEDUCTION_LABELS } from "@/lib/deductionLabels";
import type { DeductionRuleView, DeductionType } from "@/api/client";

// Extraído de EventLiveScoringPage/EventLiveScoringDesktopView pra ser
// reusado também pelo Painel Head Judge — mesmo raciocínio de
// ScoringCriteriaGroups. "Ver todos"/"Ver menos" é estado próprio do
// componente (não precisa ser levantado, nenhum outro lugar depende
// disso).
interface LegalityDeductionsPanelProps {
  rules: DeductionRuleView[];
  deductions: DeductionLogEntry[];
  onAddDeduction: (deductionType: DeductionType) => void;
  onUndoDeduction: (deductionId: string) => void;
  onClearAllDeductions: () => void;
  onEditDeductionTime: (deductionId: string, presentationElapsedMs: number) => void;
  onSetDeductionCode: (deductionId: string, code: string) => void;
  variant?: "mobile" | "desktop";
  className?: string;
}

export function LegalityDeductionsPanel({
  rules,
  deductions,
  onAddDeduction,
  onUndoDeduction,
  onClearAllDeductions,
  onEditDeductionTime,
  onSetDeductionCode,
  variant = "mobile",
  className,
}: LegalityDeductionsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editingTimeValue, setEditingTimeValue] = useState("");
  const isMobile = variant === "mobile";
  const previewCount = isMobile ? 3 : 5;
  const visibleDeductions = showAll ? deductions : deductions.slice(0, previewCount);

  function startEditingTime(d: DeductionLogEntry) {
    setEditingTimeId(d.id);
    setEditingTimeValue(d.presentationElapsedMs !== null ? formatElapsed(d.presentationElapsedMs) : "00:00");
  }

  function commitEditingTime(deductionId: string) {
    const parsed = parseElapsed(editingTimeValue);
    if (parsed !== null) onEditDeductionTime(deductionId, parsed);
    setEditingTimeId(null);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-red-300/50 bg-red-500/5 p-4",
        isMobile ? "mx-4 mt-3" : "flex h-full flex-col",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-red-600">
        <Scale className="size-4" />
        LEGALIDADE
      </p>

      <p className="mt-3 text-xs font-semibold tracking-wide text-muted-foreground">DEDUÇÕES</p>
      <div className={cn("mt-2 grid gap-2", isMobile ? "grid-cols-3" : "grid-cols-2")}>
        {rules.map((rule) => {
          const Icon = DEDUCTION_ICONS[rule.type] ?? DEDUCTION_FALLBACK_ICON;
          return (
            <button
              key={rule.type}
              type="button"
              onClick={() => onAddDeduction(rule.type)}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-2.5 text-center hover:border-red-300 hover:bg-red-500/5"
            >
              <Icon className="size-4 text-red-500" />
              <span className="text-[11px] leading-tight font-medium text-foreground">
                {DEDUCTION_LABELS[rule.type]}
              </span>
            </button>
          );
        })}
      </div>

      {deductions.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">ÚLTIMOS REGISTROS</p>
            <button
              type="button"
              onClick={onClearAllDeductions}
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
            >
              Limpar tudo
              <Trash2 className="size-3" />
            </button>
          </div>
          <div className="mt-1 divide-y divide-border">
            {visibleDeductions.map((d) => (
              <div key={d.id} className="py-2">
                <div className={cn("flex items-center", isMobile ? "gap-3" : "gap-2")}>
                  {editingTimeId === d.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        autoFocus
                        value={editingTimeValue}
                        onChange={(e) => setEditingTimeValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEditingTime(d.id);
                          if (e.key === "Escape") setEditingTimeId(null);
                        }}
                        placeholder="MM:SS"
                        className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs font-medium text-foreground outline-none focus-visible:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => commitEditingTime(d.id)}
                        aria-label="Salvar horário"
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTimeId(null)}
                        aria-label="Cancelar"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditingTime(d)}
                      className="flex w-14 shrink-0 items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                    >
                      {d.presentationElapsedMs !== null ? formatElapsed(d.presentationElapsedMs) : "--:--"}
                      <Pencil className="size-2.5 shrink-0 opacity-60" />
                    </button>
                  )}
                  <span className="flex-1 truncate text-sm text-foreground">{DEDUCTION_LABELS[d.deductionType]}</span>
                  <button
                    type="button"
                    onClick={() => onUndoDeduction(d.id)}
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Undo2 className="size-3" />
                    Remover
                  </button>
                </div>
                {d.deductionType === "legality_infractions" && (
                  <input
                    key={d.id}
                    defaultValue={d.code ?? ""}
                    onBlur={(e) => onSetDeductionCode(d.id, e.target.value)}
                    placeholder="Código da ilegalidade"
                    className={cn(
                      "mt-1.5 w-full rounded-lg border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-primary",
                      d.code ? "border-border" : "border-amber-400",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          {deductions.length > previewCount && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {showAll ? "Ver menos" : `Ver todos (${deductions.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
