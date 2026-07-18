import { useMemo, useState } from "react";
import { ChevronsDownUp, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { flattenTree } from "@/lib/scoringTree";
import {
  assignmentKey,
  computeGroupJudgeIds,
  computeNodeFraction,
  computeNodeStatus,
} from "@/lib/judgingAssignments";
import { JudgingCriterionRow } from "@/components/JudgingCriterionRow";
import type { ScoringCriterion, Judge } from "@/api/client";

interface JudgingCriterionTreeProps {
  criteria: ScoringCriterion[];
  resources: Array<{ id: string; name: string }>;
  judgeIdsByCriterion: Map<string, string[]>;
  judgesById: Map<string, Judge>;
  selectedCriterionId: string | null;
  selectedResourceId: string | null;
  onSelectCell: (criterionId: string, resourceId: string) => void;
}

export function JudgingCriterionTree({
  criteria,
  resources,
  judgeIdsByCriterion,
  judgesById,
  selectedCriterionId,
  selectedResourceId,
  onSelectCell,
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
  const resourceIds = useMemo(() => resources.map((r) => r.id), [resources]);

  const nodes = useMemo(
    () => flattenTree(criteria, collapsedIds),
    [criteria, collapsedIds],
  );

  const visibleNodes = hidePending
    ? nodes.filter(
        ({ criterion }) =>
          computeNodeStatus(criterion, criteria, judgeIdsByCriterion, resourceIds) !== "completed",
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
        <div
          style={{ gridTemplateColumns: `1fr repeat(${resources.length}, 160px) 140px` }}
          className="grid gap-3 border-b border-border/60 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          <span style={{ paddingLeft: "12px" }}>Critério</span>
          {resources.map((resource) => (
            <span key={resource.id} className="truncate normal-case">
              {resource.name}
            </span>
          ))}
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
            const judgesByResource = new Map<string, Judge[]>();
            for (const resource of resources) {
              const judgeIds =
                criterion.type === "score_item"
                  ? judgeIdsByCriterion.get(assignmentKey(criterion.id, resource.id)) ?? []
                  : computeGroupJudgeIds(criterion, criteria, judgeIdsByCriterion, resource.id);
              judgesByResource.set(
                resource.id,
                judgeIds.map((id) => judgesById.get(id)).filter((j): j is Judge => !!j),
              );
            }
            const status = computeNodeStatus(criterion, criteria, judgeIdsByCriterion, resourceIds);
            const fraction = computeNodeFraction(
              criterion,
              criteria,
              judgeIdsByCriterion,
              resourceIds,
            );

            return (
              <JudgingCriterionRow
                key={criterion.id}
                criterion={criterion}
                depth={depth}
                status={status}
                fraction={fraction}
                resources={resources}
                judgesByResource={judgesByResource}
                hasChildren={hasChildren}
                collapsed={collapsedIds.has(criterion.id)}
                onToggleCollapse={() => toggleCollapse(criterion.id)}
                selectedResourceId={selectedCriterionId === criterion.id ? selectedResourceId : null}
                onSelectCell={(resourceId) => onSelectCell(criterion.id, resourceId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
