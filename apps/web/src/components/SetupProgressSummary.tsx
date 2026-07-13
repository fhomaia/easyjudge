import { Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeStepState, type SetupStep } from "@/lib/eventSetupSteps";

const STATE_LABELS = {
  completed: "Concluído",
  in_progress: "Em andamento",
  not_started: "Não iniciado",
} as const;

interface SetupProgressSummaryProps {
  steps: SetupStep[];
}

export function SetupProgressSummary({ steps }: SetupProgressSummaryProps) {
  const completedCount = steps.filter((s) => s.completed).length;

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Calendar className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Progresso da configuração</p>
          <p className="text-lg font-semibold text-foreground">
            {completedCount} de {steps.length} etapas concluídas
          </p>
          <p className="text-sm text-muted-foreground">
            {completedCount === 0
              ? "Vamos começar a configurar o seu evento!"
              : "Falta pouco para o seu evento ficar pronto!"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const state = computeStepState(steps, index);
          return (
            <div key={step.key} className="flex items-center">
              {index > 0 && <div className="h-px w-10 bg-border sm:w-16" />}
              <div className="flex flex-col items-center gap-1.5 px-2">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    state === "completed" && "bg-emerald-500 text-white",
                    state === "in_progress" && "bg-primary text-primary-foreground",
                    state === "not_started" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "completed" ? <Check className="size-4" /> : index + 1}
                </span>
                <div className="text-center">
                  <p className="text-xs font-medium whitespace-nowrap text-foreground">
                    {step.shortTitle}
                  </p>
                  <p className="text-xs whitespace-nowrap text-muted-foreground">
                    {STATE_LABELS[state]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
