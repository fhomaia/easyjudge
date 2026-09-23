import { cn } from "@/lib/utils";

export interface ScoringTemplateStep {
  key: string;
  label: string;
}

interface ScoringTemplateStepTrailProps {
  steps: ScoringTemplateStep[];
  current: string;
  onSelect: (key: string) => void;
}

// Trilha numerada (Estrutura / Deduções / Revisão) no topo do builder de
// sistema de pontuação — navegação LIVRE entre passos (clicável, não
// travada/sequencial), mantendo o padrão de autosave da página: nada
// fica pendente de um "confirmar" no fim, é só um indicador visual +
// atalho de navegação (pedido do usuário: trilha de progresso, não
// abas de texto, sem virar um assistente modal).
export function ScoringTemplateStepTrail({ steps, current, onSelect }: ScoringTemplateStepTrailProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const isCurrent = step.key === current;
        return (
          <div key={step.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect(step.key)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-primary/5"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : index < currentIndex
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span className="mx-2 h-px w-8 shrink-0 bg-border sm:w-12" />
            )}
          </div>
        );
      })}
    </div>
  );
}
