import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/categoryLabels";
import type { CategoryStatus } from "@/api/client";

const STATUS_CLASSNAMES: Record<CategoryStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
};

export function CategoryStatusBadge({ status }: { status: CategoryStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_CLASSNAMES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
