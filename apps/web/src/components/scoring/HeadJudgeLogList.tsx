import { Loader2, Pencil, Scale, Undo2 } from "lucide-react";
import { DEDUCTION_LABELS } from "@/lib/deductionLabels";
import type { HeadJudgeLogEntry } from "@/api/client";

// Aba "Logs" do Painel Head Judge — substitui a "Ocorrências" do print
// de referência: log de alterações de NOTAS e DEDUÇÕES de toda a
// equipe atual (todos os jurados desta apresentação), não só do jurado
// selecionado no drill-down. Comentário/esboço ficam de fora
// (ver ScoringService.getChangeLog no backend).
interface HeadJudgeLogListProps {
  log: HeadJudgeLogEntry[] | null;
  loading: boolean;
}

function describeEntry(entry: HeadJudgeLogEntry): string {
  if (entry.kind === "score_set") {
    return `${entry.criterionName ?? "Critério"} → ${entry.value?.toFixed(1) ?? "—"}`;
  }
  const label = entry.deductionType ? DEDUCTION_LABELS[entry.deductionType] : "Dedução";
  return entry.kind === "deduction_add" ? `+ ${label}` : `Desfeito: ${label}`;
}

export function HeadJudgeLogList({ log, loading }: HeadJudgeLogListProps) {
  if (loading || !log) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (log.length === 0) {
    return (
      <div className="p-4">
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma alteração registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border p-4">
      {log.map((entry) => {
        const time = new Date(entry.clientCreatedAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const Icon = entry.kind === "score_set" ? Pencil : entry.kind === "deduction_remove" ? Undo2 : Scale;
        return (
          <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{time}</span>·{entry.judgeName}
              </p>
              <p className="truncate text-sm text-foreground">{describeEntry(entry)}</p>
              {entry.actingJudgeName && (
                <p className="text-xs text-amber-600">editado por {entry.actingJudgeName}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
