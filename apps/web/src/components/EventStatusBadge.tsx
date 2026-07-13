import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/api/client";

const STATUS_CONFIG: Record<EventStatus, { label: string; className: string }> = {
  created: {
    label: "Criado",
    className: "bg-muted text-muted-foreground",
  },
  published: {
    label: "Publicado",
    className: "bg-primary/15 text-primary",
  },
  started: {
    label: "Iniciado",
    className: "bg-brand-yellow/20 text-[color-mix(in_oklch,var(--brand-yellow),black_35%)]",
  },
  completed: {
    label: "Concluído",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("border-transparent", config.className)}>
      {config.label}
    </Badge>
  );
}
