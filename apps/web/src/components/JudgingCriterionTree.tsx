import { useMemo, useState } from "react";
import { ChevronsDownUp, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { flattenTree } from "@/lib/scoringTree";
import {
  computeGroupJudgeIds,
  computeNodeFraction,
  computeNodeStatus,
} from "@/lib/judgingAssignments";
import { JudgingCriterionRow } from "@/components/JudgingCriterionRow";
import type { ScoringCriterion, Judge } from "@/api/client";

interface JudgingCriterionTreeProps {
  criteria: ScoringCriterion[];
  judgeIdsByCriterion: Map<string, string[]>;
  judgesById: Map<string, Judge>;
  selectedCriterionId: string | null;
  onSelectLeaf: (criterionId: string) => void;
}

export function JudgingCriterionTree({
  criteria,
  judgeIdsByCriterion,
  judgesById,
  selectedCriterionId,
  onSelectLeaf,
}: JudgingCriterionTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [hidePending, setHidePending] = useState(false);

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groupIds = criteria.filter((c) => c.type === "group").map((c) => c.id);
  const allCollapsed = groupIds.length > 0 && groupIds.every((id) => collapsedIds.has(id));

  const nodes = useMemo(
    () => flattenTree(criteria, collapsedIds),
    [criteria, collapsedIds],
  );

  const visibleNodes = hidePending
    ? nodes.filter(
        ({ criterion }) => computeNodeStatus(criterion, criteria, judgeIdsByCriterion) !== "completed",
      )
    : nodes;

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 p-4">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <ListTree className="size-4 text-muted-foreground" />
          Árvore de critérios
        </h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Mostrar apenas pendentes
            <Switch checked={hidePending} onCheckedChange={(v) => setHidePending(v === true)} />
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCollapsedIds(allCollapsed ? new Set() : new Set(groupIds))}
          >
            <ChevronsDownUp data-icon="inline-start" />
            {allCollapsed ? "Expandir tudo" : "Recolher tudo"}
          </Button>
        </div>
      </div>

      {nodes.length > 0 && (
        <div className="grid grid-cols-[1fr_180px_140px] gap-3 border-b border-border/60 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <span style={{ paddingLeft: "12px" }}>Critério</span>
          <span>Jurados atribuídos</span>
          <span className="text-right">Status</span>
        </div>
      )}

      {nodes.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Este sistema de pontuação ainda não tem critérios cadastrados.
        </p>
      ) : visibleNodes.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nenhum critério pendente — tudo atribuído por aqui.
        </p>
      ) : (
        <div>
          {visibleNodes.map(({ criterion, depth, hasChildren }) => {
            const judgeIds =
              criterion.type === "score_item"
                ? judgeIdsByCriterion.get(criterion.id) ?? []
                : computeGroupJudgeIds(criterion, criteria, judgeIdsByCriterion);
            const judges = judgeIds.map((id) => judgesById.get(id)).filter((j): j is Judge => !!j);
            const status = computeNodeStatus(criterion, criteria, judgeIdsByCriterion);
            const fraction = computeNodeFraction(criterion, criteria, judgeIdsByCriterion);

            return (
              <JudgingCriterionRow
                key={criterion.id}
                criterion={criterion}
                depth={depth}
                status={status}
                fraction={fraction}
                judges={judges}
                hasChildren={hasChildren}
                collapsed={collapsedIds.has(criterion.id)}
                onToggleCollapse={() => toggleCollapse(criterion.id)}
                selected={selectedCriterionId === criterion.id}
                onSelect={() => onSelectLeaf(criterion.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
