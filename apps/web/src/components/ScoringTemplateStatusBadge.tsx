import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScoringTemplateStatusBadgeProps {
  isComplete: boolean;
}

export function ScoringTemplateStatusBadge({ isComplete }: ScoringTemplateStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        isComplete
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      {isComplete ? "Completo" : "Incompleto"}
    </Badge>
  );
}
