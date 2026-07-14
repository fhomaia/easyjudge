import type { CSSProperties, HTMLAttributes } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isNodeValid } from "@/lib/scoringTree";
import type { ScoringCriterion } from "@/api/client";

interface ScoringCriterionRowProps {
  criterion: ScoringCriterion;
  criteria: ScoringCriterion[];
  depth: number;
  path: string;
  hasChildren: boolean;
  collapsed: boolean;
  selected: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  rootRef?: (node: HTMLElement | null) => void;
  rootStyle?: CSSProperties;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
}

export function ScoringCriterionRow({
  criterion,
  criteria,
  depth,
  path,
  hasChildren,
  collapsed,
  selected,
  onToggleCollapse,
  onSelect,
  onAddChild,
  onDelete,
  rootRef,
  rootStyle,
  dragHandleProps,
  isDragging,
  isOverlay,
}: ScoringCriterionRowProps) {
  const valid = isNodeValid(criterion, criteria);

  return (
    <div
      ref={rootRef}
      onClick={onSelect}
      style={{ paddingLeft: `${depth * 24 + 12}px`, ...rootStyle }}
      className={cn(
        "flex cursor-pointer items-center gap-2 border-b border-border/60 py-2.5 pr-3 transition-colors last:border-0 hover:bg-muted/40",
        selected && "bg-primary/[0.06]",
        isDragging && "opacity-40",
        isOverlay && "rounded-lg border bg-card shadow-lg",
      )}
    >
      <span
        aria-hidden
        {...dragHandleProps}
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
      >
        <GripVertical className="size-4" />
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse();
        }}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
          !hasChildren && "invisible",
        )}
      >
        {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      <span className="w-14 shrink-0 text-xs text-muted-foreground">{path}</span>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {criterion.name}
      </span>

      <Badge
        variant="outline"
        className={cn(
          "shrink-0 border-transparent",
          criterion.type === "group"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {criterion.type === "group" ? "Grupo" : "Item de avaliação"}
      </Badge>

      {criterion.type === "group" &&
        (valid ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="size-4 shrink-0 text-destructive" />
        ))}

      <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
        {criterion.maxScore.toFixed(2)} pts
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          aria-label="Adicionar filho"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Excluir critério"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
