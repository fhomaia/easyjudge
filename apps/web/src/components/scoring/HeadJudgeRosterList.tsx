import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPECIAL_JUDGE_ROLES } from "@/lib/specialJudgeRoles";
import type { HeadJudgeRoster, HeadJudgeRosterEntryStatus } from "@/api/client";

const SPECIAL_ROLE_LABELS = Object.fromEntries(SPECIAL_JUDGE_ROLES.map((r) => [r.role, r.label]));

const STATUS_STYLES: Record<HeadJudgeRosterEntryStatus, string> = {
  complete: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  incomplete: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const STATUS_LABELS: Record<HeadJudgeRosterEntryStatus, string> = {
  complete: "Completo",
  incomplete: "Incompleto",
};

interface HeadJudgeRosterListProps {
  roster: HeadJudgeRoster | null;
  loading: boolean;
  onSelectJudge: (judgeParticipationId: string) => void;
}

export function HeadJudgeRosterList({ roster, loading, onSelectJudge }: HeadJudgeRosterListProps) {
  if (loading || !roster) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">EQUIPE ATUAL</p>
      <p className="mt-1 text-lg font-bold text-foreground">{roster.team.name}</p>

      <div className="mt-4 space-y-2">
        {roster.judges.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum jurado escalado nesta pista ainda.
          </p>
        ) : (
          roster.judges.map((judge) => {
            const lines = [
              ...judge.groups,
              ...judge.specialRoles.map((role) => SPECIAL_ROLE_LABELS[role] ?? role),
            ];
            return (
              <button
                key={judge.judgeParticipationId}
                type="button"
                onClick={() => onSelectJudge(judge.judgeParticipationId)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{judge.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lines.length > 0 ? lines.join(" · ") : "Sem função atribuída"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    STATUS_STYLES[judge.status],
                  )}
                >
                  {STATUS_LABELS[judge.status]}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
