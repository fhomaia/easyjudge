import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { TEAM_SITUATION_LABELS, type TeamSituation } from "@/lib/programAthletes";

// "Completa" em verde, pendências em âmbar. Só informativo.
export function TeamSituationBadge({ situation }: { situation: TeamSituation }) {
  const complete = situation === "complete";
  const Icon = complete ? CheckCircle2 : AlertTriangle;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        complete
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      }`}
    >
      <Icon className="size-3" />
      {TEAM_SITUATION_LABELS[situation]}
    </span>
  );
}
