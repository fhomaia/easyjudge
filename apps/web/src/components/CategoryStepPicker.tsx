import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CRITERION_LABELS, CRITERION_ORDER } from "@/lib/categoryCriteria";
import { autoFormatKey, autoFormatKeyLabel, eventFormatKeysInDefaultOrder } from "@/lib/autoFormatKey";
import { ageProblem } from "@/lib/ageRules";
import { cn } from "@/lib/utils";
import type { Category, CategoryCriterionKey } from "@/api/client";

// Escolha de categorias pelo atleta (2026-11-10): em vez da lista inteira
// (ruim com muitas categorias, ainda mais no celular), "+ Adicionar
// categoria" abre um passo a passo: Modalidade, Gênero, Nível e as outras
// divisões, cada passo só com as opções que existem nas categorias que
// sobraram. Passo em que não há escolha (uma opção só) é pulado. Categoria
// fora da idade do atleta não pode ser escolhida (a API também recusa).

type StepKey = "modality" | CategoryCriterionKey;

// Modalidade, Gênero e Nível primeiro; depois as outras divisões na ordem
// fixa que monta o nome da categoria.
const STEP_ORDER: StepKey[] = [
  "modality",
  "gender",
  "level",
  ...CRITERION_ORDER.filter((k) => k !== "gender" && k !== "level"),
];

const STEP_TITLES: Record<StepKey, string> = {
  modality: "Modalidade",
  ...CRITERION_LABELS,
};

const NONE = "__none__";
// Com poucas categorias sobrando, mostra a lista em vez de mais passos.
const SHORT_LIST = 3;

function valueOf(category: Category, step: StepKey): string {
  if (step === "modality") return autoFormatKey(category.categoryFormat, category.customFormatLabel);
  return category.criteriaLabels?.find((l) => l.key === step)?.value ?? NONE;
}

function labelOf(category: Category, step: StepKey): string {
  if (step === "modality") return autoFormatKeyLabel(valueOf(category, step));
  const label = category.criteriaLabels?.find((l) => l.key === step)?.label;
  return label ?? `Sem ${CRITERION_LABELS[step].toLowerCase()}`;
}

interface StepOption {
  value: string;
  label: string;
  // Nenhuma categoria desta opção cabe na idade do atleta.
  blockedReason: string | null;
}

function optionsFor(step: StepKey, candidates: Category[], blocked: Map<string, string>): StepOption[] {
  const byValue = new Map<string, Category[]>();
  for (const c of candidates) {
    const v = valueOf(c, step);
    byValue.set(v, [...(byValue.get(v) ?? []), c]);
  }
  let values = [...byValue.keys()];
  if (step === "modality") {
    const order = eventFormatKeysInDefaultOrder(candidates);
    values = order.filter((v) => byValue.has(v));
  } else if (step === "level") {
    values.sort((a, b) => (byValue.get(a)![0].level ?? -1) - (byValue.get(b)![0].level ?? -1));
  }
  // "Sem ..." sempre no fim.
  values.sort((a, b) => Number(a === NONE) - Number(b === NONE));
  return values.map((value) => {
    const list = byValue.get(value)!;
    const allBlocked = list.every((c) => blocked.has(c.id));
    return {
      value,
      label: labelOf(list[0], step),
      blockedReason: allBlocked ? blocked.get(list[0].id) ?? null : null,
    };
  });
}

export function CategoryStepPicker({
  categories,
  selected,
  max,
  birthDate,
  onToggle,
}: {
  categories: Category[];
  selected: string[];
  // Limite de categorias por atleta (crossover); null = sem limite.
  max: number | null;
  birthDate: string | null;
  onToggle: (categoryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<{ step: StepKey; value: string; label: string }[]>([]);

  // Motivo de cada categoria fora da idade.
  const blocked = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      const problem = ageProblem(c.rules, birthDate);
      if (problem) map.set(c.id, problem);
    }
    return map;
  }, [categories, birthDate]);

  const available = categories.filter((c) => !selected.includes(c.id));
  const candidates = available.filter((c) => choices.every((ch) => valueOf(c, ch.step) === ch.value));

  // Próximo passo com escolha de verdade (mais de uma opção).
  const chosenSteps = new Set(choices.map((c) => c.step));
  const nextStep = STEP_ORDER.find(
    (step) => !chosenSteps.has(step) && new Set(candidates.map((c) => valueOf(c, step))).size > 1,
  );
  const showList = !nextStep || candidates.length <= SHORT_LIST;

  const limitReached = max !== null && selected.length >= max;
  const selectedCategories = selected
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => !!c);

  function close() {
    setOpen(false);
    setChoices([]);
  }

  function add(category: Category) {
    onToggle(category.id);
    close();
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">O organizador ainda não cadastrou categorias.</p>;
  }

  return (
    <div className="grid gap-3">
      {selectedCategories.length > 0 && (
        <ul className="grid gap-1.5">
          {selectedCategories.map((c) => (
            <li
              key={c.id}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 break-words text-foreground">{c.name}</span>
              {blocked.has(c.id) && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  {blocked.get(c.id)}
                </span>
              )}
              <button
                type="button"
                aria-label={`Tirar ${c.name}`}
                onClick={() => onToggle(c.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {limitReached ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {`O limite de ${max} ${max === 1 ? "categoria" : "categorias"} por atleta foi atingido. Para escolher outra, tire uma das atuais.`}
        </p>
      ) : available.length > 0 ? (
        <Button
          className="h-10 w-full rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 px-6 text-white shadow-md hover:opacity-90 sm:w-auto sm:justify-self-start"
          onClick={() => setOpen(true)}
        >
          <Plus data-icon="inline-start" />
          Adicionar categoria
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
          <div className="grid gap-1.5">
            <DialogTitle className="text-xl font-medium">Adicionar categoria</DialogTitle>
            <DialogDescription>
              {showList ? "Escolha a categoria." : `Escolha: ${STEP_TITLES[nextStep!].toLowerCase()}.`}
            </DialogDescription>
          </div>

          {choices.length > 0 && (
            <nav aria-label="Escolhas" className="flex flex-wrap items-center gap-1 text-sm">
              {choices.map((ch, index) => (
                <span key={ch.step} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                  <button
                    type="button"
                    onClick={() => setChoices(choices.slice(0, index))}
                    className="rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
                    title="Mudar esta escolha"
                  >
                    {ch.label}
                  </button>
                </span>
              ))}
            </nav>
          )}

          {showList ? (
            <ul className="grid gap-2">
              {candidates.map((c) => {
                const reason = blocked.get(c.id) ?? null;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={!!reason}
                      onClick={() => add(c)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                        reason
                          ? "cursor-not-allowed border-border/60 opacity-60"
                          : "border-border hover:border-primary/50 hover:bg-primary/5",
                      )}
                    >
                      <span className="min-w-0 flex-1 break-words font-medium text-foreground">{c.name}</span>
                      {reason ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{reason}</span>
                      ) : (
                        <Plus className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {optionsFor(nextStep!, candidates, blocked).map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    disabled={!!option.blockedReason}
                    onClick={() =>
                      setChoices([...choices, { step: nextStep!, value: option.value, label: option.label }])
                    }
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                      option.blockedReason
                        ? "cursor-not-allowed border-border/60 opacity-60"
                        : "border-border hover:border-primary/50 hover:bg-primary/5",
                    )}
                  >
                    <span className="min-w-0 break-words font-medium text-foreground">{option.label}</span>
                    {option.blockedReason ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{option.blockedReason}</span>
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" className="w-full sm:w-auto sm:justify-self-end" onClick={close}>
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
