import { ChevronRight } from "lucide-react";
import { formatPercent, formatPoints } from "@/lib/formatNumber";
import { cn } from "@/lib/utils";
import type { AdminOverviewEntry } from "@/api/client";

// Lista de apresentações 100% pontuadas (as incompletas ficam ocultas
// — decisão do usuário) na visão do admin/assessor da tela de Notas —
// com UMA exceção: apresentação com desistência sinalizada também
// entra aqui (mesmo nunca tendo sido pontuada), sempre inativa e com a
// badge "Desistência" (ver ScoringService.getAdminOverview/
// buildTeamScopedOverview).
//
// Reusada também pelas visões de Programa/Atleta (`EventLiveTeamNotesPage`,
// `AthleteNotesOverview`).
interface AdminNotesOverviewListProps {
  entries: AdminOverviewEntry[];
  onSelect: (scheduleEntryId: string) => void;
}

export function AdminNotesOverviewList({ entries, onSelect }: AdminNotesOverviewListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma súmula disponível ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <button
          key={entry.scheduleEntryId}
          type="button"
          onClick={() => !entry.withdrawn && onSelect(entry.scheduleEntryId)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left",
            entry.withdrawn
              ? "cursor-default opacity-60"
              : "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{entry.teamName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {entry.categoryName} · {entry.resourceName}
            </p>
          </div>
          {!entry.withdrawn && (
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-foreground">{formatPoints(entry.finalResult)} pts</p>
              <p className="text-xs text-muted-foreground">{formatPercent(entry.percentage)}</p>
            </div>
          )}
          {entry.withdrawn && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
              Desistência
            </span>
          )}
          {entry.contestationRequested && entry.contestationResolved && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Contestação resolvida
            </span>
          )}
          {entry.contestationRequested && !entry.contestationResolved && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
              Contestação
            </span>
          )}
          {!entry.withdrawn && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        </button>
      ))}
    </div>
  );
}
