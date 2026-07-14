import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import type { SetupStep } from "@/lib/eventSetupSteps";

export function SetupRecommendedBanner({ step }: { step: SetupStep }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-amber-300/60 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/20 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
          <Star className="size-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Próxima etapa recomendada</p>
          <p className="text-sm text-muted-foreground">
            Continue o cadastro de {step.shortTitle.toLowerCase()} para avançar na configuração do
            evento.
          </p>
        </div>
      </div>
      {step.href ? (
        <Link
          to={step.href}
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          Ir para {step.shortTitle.toLowerCase()}
          <ArrowRight className="size-4" />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title="Disponível em breve"
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary opacity-50"
        >
          Ir para {step.shortTitle.toLowerCase()}
          <ArrowRight className="size-4" />
        </button>
      )}
    </div>
  );
}
