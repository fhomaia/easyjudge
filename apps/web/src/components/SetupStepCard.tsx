import { BookOpen, CalendarDays, Check, Circle, Pencil, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatDate";
import type { SetupStep, SetupStepKey } from "@/lib/eventSetupSteps";

const STEP_ICONS: Record<SetupStepKey, typeof Trophy> = {
  categories: Trophy,
  regulation: BookOpen,
  teams: Users,
};

interface SetupStepCardProps {
  step: SetupStep;
  stepNumber: number;
  recommended: boolean;
}

export function SetupStepCard({ step, stepNumber, recommended }: SetupStepCardProps) {
  const Icon = STEP_ICONS[step.key];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            step.completed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {step.completed ? <Check className="size-4" /> : stepNumber}
        </span>
        {recommended && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            RECOMENDADO
          </span>
        )}
      </div>

      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{step.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg px-4 py-3",
          step.completed ? "bg-emerald-500/10" : "bg-muted",
        )}
      >
        <div className="flex items-center gap-2">
          {step.completed ? (
            <Check className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              step.completed ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
            )}
          >
            {step.completed ? "Concluído" : "Não iniciado"}
          </span>
        </div>
        <p className="mt-0.5 pl-6 text-sm text-muted-foreground">{step.detail}</p>
      </div>

      {step.updatedAt && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          Última atualização: {formatDateTime(step.updatedAt)}
        </p>
      )}

      <button
        type="button"
        disabled
        title="Disponível em breve"
        className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary opacity-50"
      >
        {step.completed && <Pencil className="size-4" />}
        {step.actionLabel}
      </button>
    </div>
  );
}
