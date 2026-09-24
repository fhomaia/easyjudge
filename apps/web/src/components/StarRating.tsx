import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Nota de 1 a 5 estrelas. Sem `onChange` vira só exibição.
export function StarRating({
  value,
  onChange,
  size = "size-8",
  className,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)} role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const icon = (
          <Star
            className={cn(size, filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} estrela${n === 1 ? "" : "s"}`}
            onClick={() => onChange(n)}
            className="rounded-md p-0.5 transition-transform hover:scale-110"
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </div>
  );
}
