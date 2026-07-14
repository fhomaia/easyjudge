import { Calculator, Calendar, Layers, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getDirectChildren, maxTreeDepth, sumMaxScore } from "@/lib/scoringTree";
import type { ScoringCriterion } from "@/api/client";

interface ScoringStatCardsProps {
  criteria: ScoringCriterion[];
  targetScore: number;
}

export function ScoringStatCards({ criteria, targetScore }: ScoringStatCardsProps) {
  const distributed = sumMaxScore(getDirectChildren(criteria, null));

  const stats = [
    {
      key: "target",
      label: "Meta de pontos do template",
      subtitle: "Definida na listagem de templates",
      icon: Calculator,
      iconClassName: "bg-primary/10 text-primary",
      value: `${targetScore.toFixed(2)} pts`,
    },
    {
      key: "distributed",
      label: "Pontuação distribuída",
      subtitle: "Soma dos critérios-raiz",
      icon: Calendar,
      iconClassName: "bg-primary/10 text-primary",
      value: `${distributed.toFixed(2)} pts`,
    },
    {
      key: "count",
      label: "Critérios (todos os níveis)",
      subtitle: "Total de critérios",
      icon: ListChecks,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
      value: String(criteria.length),
    },
    {
      key: "depth",
      label: "Níveis de profundidade",
      subtitle: "Nível máximo",
      icon: Layers,
      iconClassName: "bg-amber-500/10 text-amber-600",
      value: String(maxTreeDepth(criteria)),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ key, label, subtitle, icon: Icon, iconClassName, value }) => (
        <Card key={key} className="flex-row items-center gap-4 p-5">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
