import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { scoringApi, type SheetStatusDay, type SheetStatusPending } from "@/api/client";
import { formatDayTab } from "@/lib/formatDate";
import { cn } from "@/lib/utils";

// Situação das súmulas (2026-09-28): o que falta e quem falta enviar,
// por categoria. Usado na visão do admin (AdminNotesOverview) e na do
// Head Judge (HeadJudgeSheetStatus, só leitura, só as pistas dele).

const REFRESH_MS = 30_000;

// Recarrega a cada 30 s: o envio de cada jurado não gera notificação
// (só o primeiro), então o socket não avisaria.
export function useSheetStatus(eventId: string) {
  const [status, setStatus] = useState<SheetStatusDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      scoringApi
        .getSheetStatus(eventId)
        .then((data) => {
          if (!cancelled) {
            setStatus(data);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar as súmulas.");
        });
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  return { status, error };
}

// "Todas as súmulas enviadas" em destaque quando a categoria fechou;
// senão, quantas faltam. Desistência fica fora da conta (total e feitas).
export function CategorySheetProgress({ total, doneCount }: { total: number; doneCount: number }) {
  if (total === 0) {
    return <p className="mt-0.5 text-xs text-muted-foreground">Nenhuma súmula a enviar.</p>;
  }
  if (doneCount >= total) {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        Todas as súmulas enviadas
      </span>
    );
  }
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      {doneCount} de {total} súmula{total === 1 ? "" : "s"} completa{doneCount === 1 ? "" : "s"}
    </p>
  );
}

function pendingDescription(item: SheetStatusPending) {
  if (item.requiredCount === 0) return "Nenhum jurado escalado nesta pista.";
  if (!item.started) return "Ainda não começou.";
  return `Falta enviar: ${item.missingJudges.join(", ")}`;
}

export function SheetStatusPendingList({ pending }: { pending: SheetStatusPending[] }) {
  if (pending.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Faltando ({pending.length})
      </p>
      {pending.map((item) => (
        <div
          key={item.scheduleEntryId}
          className="flex items-start gap-3 rounded-xl border border-dashed border-amber-400/60 bg-amber-500/5 p-3"
        >
          <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{item.teamName}</p>
            <p className="truncate text-xs text-muted-foreground">{item.resourceName}</p>
            <p className={cn("mt-1 text-xs", item.started ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              {pendingDescription(item)}
            </p>
          </div>
          {item.requiredCount > 0 && (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {item.submittedCount}/{item.requiredCount}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// Visão do Head Judge: só leitura, sem chaves de liberação nem notas.
export function HeadJudgeSheetStatus({ eventId }: { eventId: string }) {
  const { status, error } = useSheetStatus(eventId);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  if (error && !status) {
    return <p className="p-4 text-sm text-destructive">{error}</p>;
  }
  if (!status) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (status.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma apresentação nas suas pistas.
      </div>
    );
  }

  const activeDay = status.find((d) => d.dayId === activeDayId) ?? status[0];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Situação das súmulas das pistas em que você é Head Judge.</p>
      {status.length > 1 && (
        <div className="scrollbar-none flex items-center gap-1 overflow-x-auto border-b border-border">
          {status.map((day) => (
            <button
              key={day.dayId}
              type="button"
              onClick={() => setActiveDayId(day.dayId)}
              className={cn(
                "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                day.dayId === activeDay.dayId
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {formatDayTab(day.date)}
            </button>
          ))}
        </div>
      )}
      {activeDay.categories.map((category) => (
        <div key={category.categoryId} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold break-words text-foreground">{category.categoryName}</p>
          <CategorySheetProgress total={category.total} doneCount={category.doneCount} />
          {category.pending.length > 0 && (
            <div className="mt-3">
              <SheetStatusPendingList pending={category.pending} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
