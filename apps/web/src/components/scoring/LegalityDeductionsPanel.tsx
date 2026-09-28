import { formatDeduction } from "@/lib/formatNumber";
import { useRef, useState } from "react";
import { Check, Pencil, Scale, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeductionLogEntry } from "@/lib/scoreEventsReducer";
import {
  DEDUCTION_ICONS,
  DEDUCTION_FALLBACK_ICON,
  WARNING_DEDUCTION_TYPE,
  formatElapsed,
  parseElapsed,
} from "@/lib/deductionIcons";
import { getDeductionLabel } from "@/lib/deductionLabels";
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
  const [editingTimeInvalid, setEditingTimeInvalid] = useState(false);
  // Cancelar (Esc/✕) tira o campo da tela; o blur que o navegador pode
  // disparar nessa hora não deve salvar.
  const cancelledEditRef = useRef(false);
  const isMobile = variant === "mobile";
  const previewCount = isMobile ? 3 : 5;
  const visibleDeductions = showAll ? deductions : deductions.slice(0, previewCount);

  function startEditingTime(d: DeductionLogEntry) {
    cancelledEditRef.current = false;
    setEditingTimeId(d.id);
    setEditingTimeInvalid(false);
    setEditingTimeValue(d.presentationElapsedMs !== null ? formatElapsed(d.presentationElapsedMs) : "00:00");
  }

  // Salva no Enter, no ✓ e ao sair do campo (tocar fora, comum no
  // celular). Texto que não dá pra entender NÃO fecha em silêncio (antes
  // voltava pro tempo antigo sem aviso): o campo fica aberto e vermelho.
  function cancelEditingTime() {
    cancelledEditRef.current = true;
    setEditingTimeId(null);
  }

  function commitEditingTime(d: DeductionLogEntry) {
    if (cancelledEditRef.current) return;
    const parsed = parseElapsed(editingTimeValue);
    if (parsed === null) {
      setEditingTimeInvalid(true);
      return;
    }
    if (parsed !== d.presentationElapsedMs) onEditDeductionTime(d.id, parsed);
    // Mesmo motivo do cancelar: o blur ao sair da tela não salva de novo.
    cancelledEditRef.current = true;
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
          const isWarning = rule.type === WARNING_DEDUCTION_TYPE;
          return (
            <button
              key={rule.type}
              type="button"
              onClick={() => onAddDeduction(rule.type)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border bg-card p-2.5 text-center",
                isWarning
                  ? "border-amber-300 hover:bg-amber-500/10"
                  : "border-border hover:border-red-300 hover:bg-red-500/5",
              )}
            >
              <Icon className={cn("size-4", isWarning ? "text-amber-500" : "text-red-500")} />
              <span className="text-[11px] leading-tight font-medium text-foreground">
                {rule.label}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  isWarning ? "text-amber-700 dark:text-amber-400" : "text-red-600",
                )}
              >
                {isWarning ? "Sem desconto" : formatDeduction(rule.value)}
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
          {/* Teto de altura + rolagem própria (não depende de nenhuma
              altura externa, ao contrário de flex-1/h-full — a grade de
              tipos de dedução acima não tem limite, então o card
              inteiro precisa continuar de altura NATURAL) — sem isso,
              muitas ilegalidades lançadas na mesma apresentação faziam
              o card (e a linha toda, via h-full do vizinho) crescer sem
              parar (pedido do usuário, 2026-09-19). "Ver todos" continua
              útil pra abrir a lista completa, agora com rolagem. */}
          <div className={cn("mt-1 divide-y divide-border", !isMobile && "max-h-48 overflow-y-auto")}>
            {visibleDeductions.map((d) => (
              <div key={d.id} className="py-2">
                <div className={cn("flex items-center", isMobile ? "gap-3" : "gap-2")}>
                  {editingTimeId === d.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        autoFocus
                        value={editingTimeValue}
                        inputMode="numeric"
                        aria-label="Tempo da dedução (minutos e segundos)"
                        aria-invalid={editingTimeInvalid}
                        title={editingTimeInvalid ? "Digite minutos e segundos, ex.: 1:30 ou 130" : undefined}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          setEditingTimeValue(e.target.value);
                          setEditingTimeInvalid(false);
                        }}
                        onBlur={() => commitEditingTime(d)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEditingTime(d);
                          if (e.key === "Escape") cancelEditingTime();
                        }}
                        placeholder="MM:SS"
                        className={cn(
                          "w-16 rounded border bg-background px-1 py-0.5 text-xs font-medium text-foreground outline-none",
                          editingTimeInvalid ? "border-red-500" : "border-border focus-visible:border-primary",
                        )}
                      />
                      {/* preventDefault no pointerdown: o campo não perde o
                          foco antes do clique (o blur já salvaria). */}
                      <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => commitEditingTime(d)}
                        aria-label="Salvar horário"
                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={cancelEditingTime}
                        aria-label="Cancelar"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" />
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
                  <span className="flex-1 truncate text-sm text-foreground">{getDeductionLabel(d.deductionType, rules)}</span>
                  {d.deductionType === WARNING_DEDUCTION_TYPE ? (
                    <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400">Warning</span>
                  ) : (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-red-600">
                      {formatDeduction(rules.find((r) => r.type === d.deductionType)?.value ?? 0)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onUndoDeduction(d.id)}
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Undo2 className="size-3" />
                    Remover
                  </button>
                </div>
                {rules.find((r) => r.type === d.deductionType)?.requiresCode ? (
                  <input
                    key={d.id}
                    defaultValue={d.code ?? ""}
                    onBlur={(e) => onSetDeductionCode(d.id, e.target.value)}
                    placeholder="Especificação"
                    className={cn(
                      "mt-1.5 w-full rounded-lg border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-primary",
                      d.code ? "border-border" : "border-amber-400",
                    )}
                  />
                ) : (
                  d.deductionType === WARNING_DEDUCTION_TYPE && (
                    // Descrição opcional do warning (não bloqueia o envio).
                    <input
                      key={d.id}
                      defaultValue={d.code ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (d.code ?? "")) onSetDeductionCode(d.id, e.target.value);
                      }}
                      placeholder="Descrição (opcional)"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-primary"
                    />
                  )
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
