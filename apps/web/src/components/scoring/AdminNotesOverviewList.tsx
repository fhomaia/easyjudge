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
  // Visão de Programa/Atleta: apresentação cuja categoria ainda não teve
  // as notas liberadas naquele dia aparece sem nota, com o selo
  // "Aguardando liberação", e não abre (ver backend ReleasesService).
  hideUnreleased?: boolean;
  // Só na visão do admin (ver findTiedEntryIds): súmulas da mesma
  // categoria/dia com a mesma nota final ganham o selo "Empate".
  tiedEntryIds?: Set<string>;
}

// Empate = mesma nota final com a precisão mostrada na tela (2 casas),
// entre súmulas completas do mesmo grupo (quem chama já passa um grupo
// só: mesma categoria no mesmo dia). Desistência não entra.
export function findTiedEntryIds(entries: AdminOverviewEntry[]): Set<string> {
  const byScore = new Map<number, string[]>();
  for (const entry of entries) {
    if (entry.withdrawn) continue;
    const key = Math.round(entry.finalResult * 100);
    byScore.set(key, [...(byScore.get(key) ?? []), entry.scheduleEntryId]);
  }
  const tied = new Set<string>();
  for (const ids of byScore.values()) {
    if (ids.length > 1) ids.forEach((id) => tied.add(id));
  }
  return tied;
}

export function AdminNotesOverviewList({
  entries,
  onSelect,
  hideUnreleased = false,
  tiedEntryIds,
}: AdminNotesOverviewListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma súmula disponível ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const waiting = hideUnreleased && !entry.released && !entry.withdrawn;
        const inactive = entry.withdrawn || waiting;
        const tied = tiedEntryIds?.has(entry.scheduleEntryId) ?? false;
        return (
          <button
            key={entry.scheduleEntryId}
            type="button"
            onClick={() => !inactive && onSelect(entry.scheduleEntryId)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left",
              entry.withdrawn
                ? "cursor-default opacity-60"
                : waiting
                  ? "cursor-default"
                  : "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{entry.teamName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.categoryName} · {entry.resourceName}
              </p>
              {/* Selos embaixo do nome, não ao lado: na mesma linha eles
                  espremiam o nome da equipe no celular. */}
              {(waiting || entry.withdrawn || entry.contestationRequested || tied) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {waiting && (
                    <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Aguardando liberação
                    </span>
                  )}
                  {entry.withdrawn && (
                    <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                      Desistência
                    </span>
                  )}
                  {entry.contestationRequested && entry.contestationResolved && (
                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Contestação resolvida
                    </span>
                  )}
                  {entry.contestationRequested && !entry.contestationResolved && (
                    <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                      Contestação
                    </span>
                  )}
                  {tied && (
                    <span className="inline-flex rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-400">
                      Empate
                    </span>
                  )}
                </div>
              )}
            </div>
            {!inactive && (
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-foreground">{formatPoints(entry.finalResult)} pts</p>
                <p className="text-xs text-muted-foreground">{formatPercent(entry.percentage)}</p>
              </div>
            )}
            {!inactive && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          </button>
        );
      })}
    </div>
  );
}
