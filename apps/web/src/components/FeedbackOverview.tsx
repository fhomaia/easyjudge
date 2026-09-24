import { StarRating } from "@/components/StarRating";
import { formatDateTime } from "@/lib/formatDate";
import type { FeedbackSummary } from "@/api/client";

export interface FeedbackOverviewItem {
  id: string;
  name: string;
  details: string;
  rating: number;
  comment: string | null;
  date: string;
}

// Resumo (média, total e distribuição) + lista de avaliações. Usado nas
// avaliações do evento (tela de Métricas) e da plataforma (/admin/feedback).
export function FeedbackOverview({
  summary,
  items,
  emptyMessage,
}: {
  summary: FeedbackSummary;
  items: FeedbackOverviewItem[];
  emptyMessage: string;
}) {
  if (summary.count === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  const max = Math.max(...summary.distribution, 1);
  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-1 sm:w-40">
          <p className="text-4xl font-bold text-foreground">
            {summary.average!.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </p>
          <StarRating value={Math.round(summary.average!)} size="size-4" />
          <p className="text-xs text-muted-foreground">
            {summary.count} avaliaç{summary.count === 1 ? "ão" : "ões"}
          </p>
        </div>
        <div className="grid flex-1 gap-1.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summary.distribution[stars - 1];
            return (
              <div key={stars} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-3 text-right">{stars}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="w-6">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold break-words text-foreground">{item.name}</p>
                <p className="text-xs break-words text-muted-foreground">{item.details}</p>
              </div>
              <StarRating value={item.rating} size="size-4" />
            </div>
            {item.comment && <p className="mt-2 text-sm whitespace-pre-line text-foreground">{item.comment}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.date)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
