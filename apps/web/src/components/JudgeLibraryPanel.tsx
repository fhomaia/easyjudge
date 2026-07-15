import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Judge } from "@/api/client";

function getJudgeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`.toUpperCase();
}

interface JudgeCardProps {
  judge: Judge;
  itemsCount: number;
  totalCriteria: number;
  onRemove: () => void;
}

function JudgeCard({ judge, itemsCount, totalCriteria, onRemove }: JudgeCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: judge.id,
  });
  const workloadPct = totalCriteria > 0 ? Math.round((itemsCount / totalCriteria) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
          : undefined
      }
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 transition-colors",
        isDragging && "opacity-50",
      )}
    >
      <span
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </span>

      <span
        style={{ backgroundColor: getAvatarColor(judge.id) }}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      >
        {getJudgeInitials(judge.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{judge.name}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {itemsCount} {itemsCount === 1 ? "item" : "itens"}
          </span>
        </div>
        <Progress value={workloadPct} className="mt-1.5" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={onRemove}>
            <Trash2 data-icon="inline-start" />
            Remover jurado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface JudgeLibraryPanelProps {
  judges: Judge[];
  itemsCountByJudge: Map<string, number>;
  totalCriteria: number;
  onCreateJudge: () => void;
  onRemoveJudge: (judgeId: string) => void;
}

export function JudgeLibraryPanel({
  judges,
  itemsCountByJudge,
  totalCriteria,
  onCreateJudge,
  onRemoveJudge,
}: JudgeLibraryPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-foreground">Painel de jurados</h2>
        <Button size="sm" onClick={onCreateJudge}>
          <Plus data-icon="inline-start" />
          Novo jurado
        </Button>
      </div>

      <div className="grid gap-2">
        {judges.map((judge) => (
          <JudgeCard
            key={judge.id}
            judge={judge}
            itemsCount={itemsCountByJudge.get(judge.id) ?? 0}
            totalCriteria={totalCriteria}
            onRemove={() => onRemoveJudge(judge.id)}
          />
        ))}
        {judges.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum jurado escolhido ainda.
          </p>
        )}
      </div>

      <div className="mt-auto flex items-start gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] p-4">
        <MousePointerClick className="size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Arraste um jurado para um critério para atribuí-lo. Solte sobre um grupo para atribuir a
          todos os itens de avaliação filhos.
        </p>
      </div>
    </div>
  );
}
