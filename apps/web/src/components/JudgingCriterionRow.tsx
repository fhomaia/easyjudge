import { useDroppable } from "@dnd-kit/core";
import { CheckCircle2, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatarColor";
import { assignmentKey, type NodeAssignmentStatus } from "@/lib/judgingAssignments";
import type { ScoringCriterion, Judge } from "@/api/client";

function getJudgeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`.toUpperCase();
}

const MAX_VISIBLE_CHIPS = 2;

function JudgeAvatarChip({ judge }: { judge: Judge }) {
  return (
    <span
      title={judge.name}
      style={{ backgroundColor: getAvatarColor(judge.id) }}
      className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card first:ml-0"
    >
      {getJudgeInitials(judge.name)}
    </span>
  );
}

const STATUS_CONFIG: Record<
  NodeAssignmentStatus,
  { icon: typeof CheckCircle2; dotClassName: string; badgeClassName: string; label: string }
> = {
  completed: {
    icon: CheckCircle2,
    dotClassName: "text-emerald-600",
    badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    label: "Completo",
  },
  partial: {
    icon: Circle,
    dotClassName: "text-amber-500",
    badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    label: "Parcial",
  },
  pending: {
    icon: Circle,
    dotClassName: "text-amber-500",
    badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    label: "Pendente",
  },
};

// Uma célula por recurso (pista) do dia selecionado — cada uma é seu
// próprio alvo de soltar (drag-and-drop) e, pra folhas, seu próprio
// gatilho pra abrir o painel de edição (ver JudgingPage). Um jurado
// não pode estar em duas pistas ao mesmo tempo, então cada recurso
// tem seu próprio conjunto de jurados, independente dos outros.
function ResourceAssignmentCell({
  criterionId,
  resourceId,
  judges,
  isLeaf,
  selected,
  onSelect,
}: {
  criterionId: string;
  resourceId: string;
  judges: Judge[];
  isLeaf: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: assignmentKey(criterionId, resourceId) });
  const visibleJudges = judges.slice(0, MAX_VISIBLE_CHIPS);
  const overflowCount = judges.length - visibleJudges.length;

  return (
    <div
      ref={setNodeRef}
      onClick={
        isLeaf
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
      className={cn(
        "flex min-h-9 items-center rounded-md px-1.5 transition-colors",
        isLeaf && "cursor-pointer hover:bg-muted/40",
        selected && "bg-primary/[0.06]",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
    >
      {visibleJudges.map((judge) => (
        <JudgeAvatarChip key={judge.id} judge={judge} />
      ))}
      {overflowCount > 0 && (
        <span className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
          +{overflowCount}
        </span>
      )}
      {judges.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
    </div>
  );
}

interface JudgingCriterionRowProps {
  criterion: ScoringCriterion;
  depth: number;
  status: NodeAssignmentStatus;
  fraction: { assigned: number; total: number };
  resources: Array<{ id: string; name: string }>;
  judgesByResource: Map<string, Judge[]>;
  hasChildren: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedResourceId: string | null;
  onSelectCell: (resourceId: string) => void;
}

export function JudgingCriterionRow({
  criterion,
  depth,
  status,
  fraction,
  resources,
  judgesByResource,
  hasChildren,
  collapsed,
  onToggleCollapse,
  selectedResourceId,
  onSelectCell,
}: JudgingCriterionRowProps) {
  const isLeaf = criterion.type === "score_item";
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      style={{
        gridTemplateColumns: `1fr repeat(${resources.length}, 160px) 140px`,
        paddingLeft: 0,
      }}
      className="grid items-center gap-3 border-b border-border/60 py-2 pr-4 pl-3 transition-colors last:border-0"
    >
      <div
        className="flex min-w-0 items-center gap-2"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
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
        <StatusIcon className={cn("size-4 shrink-0", statusConfig.dotClassName)} />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {criterion.name}
        </span>
      </div>

      {resources.map((resource) => (
        <ResourceAssignmentCell
          key={resource.id}
          criterionId={criterion.id}
          resourceId={resource.id}
          judges={judgesByResource.get(resource.id) ?? []}
          isLeaf={isLeaf}
          selected={isLeaf && selectedResourceId === resource.id}
          onSelect={() => onSelectCell(resource.id)}
        />
      ))}

      <div className="flex items-center justify-end gap-3">
        {isLeaf && (
          <Badge variant="outline" className={cn("border-transparent", statusConfig.badgeClassName)}>
            {statusConfig.label}
          </Badge>
        )}
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
          {fraction.assigned}/{fraction.total}
        </span>
      </div>
    </div>
  );
}
