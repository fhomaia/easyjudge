import type { ScheduleEntry, ScheduleEntryType } from "@/api/client";
import { formatMinutes } from "@/lib/scheduleTime";
import { isAutoWaitBreak } from "@/lib/scheduleEntryKind";

export { isAutoWaitBreak } from "@/lib/scheduleEntryKind";

// Compartilhado entre ScheduleEntryCard (linha do tempo) e
// ScheduleTableView (tabela consolidada) — as duas visões mostram a
// mesma entry, só o layout do card muda.
export const SCHEDULE_TYPE_STYLES: Record<
  ScheduleEntryType,
  { bg: string; border: string; text: string }
> = {
  presentation: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/50",
    text: "text-blue-800 dark:text-blue-300",
  },
  warmup: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/50",
    text: "text-emerald-800 dark:text-emerald-300",
  },
  break: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/50",
    text: "text-orange-800 dark:text-orange-300",
  },
  ceremony: {
    bg: "bg-purple-500/15",
    border: "border-purple-500/50",
    text: "text-purple-800 dark:text-purple-300",
  },
  award: {
    bg: "bg-teal-500/15",
    border: "border-teal-500/50",
    text: "text-teal-800 dark:text-teal-300",
  },
};

const COMPONENT_LABELS: Partial<Record<ScheduleEntryType, string>> = {
  break: "Intervalo",
  ceremony: "Abertura",
  award: "Premiação",
};

export interface ScheduleEntryDisplay {
  title: string;
  subtitle: string | null;
  timeRange: string;
  tooltip: string;
}

export function getScheduleEntryDisplay(
  entry: ScheduleEntry,
  startMinutes: number,
  endMinutes: number,
  conflictReasons: string[],
): ScheduleEntryDisplay {
  const title =
    entry.type === "presentation" || entry.type === "warmup"
      ? (entry.teamName ?? "Equipe")
      : (entry.label ?? COMPONENT_LABELS[entry.type] ?? entry.type);
  const subtitle =
    entry.type === "presentation"
      ? entry.categoryName
      : entry.type === "warmup"
        ? entry.categoryName
          ? `Aquecimento · ${entry.categoryName}`
          : "Aquecimento"
        : null;
  const timeRange = `${formatMinutes(startMinutes)} – ${formatMinutes(endMinutes)}`;
  const baseLabel = subtitle ? `${title} — ${subtitle} · ${timeRange}` : `${title} · ${timeRange}`;
  const hasConflict = conflictReasons.length > 0;
  const tooltip =
    (hasConflict ? `${baseLabel}\n⚠ ${conflictReasons.join("\n⚠ ")}` : baseLabel) +
    (isAutoWaitBreak(entry) ? "\n(gerado automaticamente — some junto com a apresentação)" : "");
  return { title, subtitle, timeRange, tooltip };
}
