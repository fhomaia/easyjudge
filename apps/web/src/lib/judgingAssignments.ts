import type { ScoringCriterion } from "@/api/client";
import { buildChildrenMap } from "@/lib/scoringTree";

export type NodeAssignmentStatus = "completed" | "partial" | "pending";

// Todas as folhas (score_item) descendentes de um nó — usado tanto
// pra decidir se um drop num grupo precisa do diálogo de conflito
// quanto pra montar os chips resumidos do grupo.
export function getDescendantLeafIds(criteria: ScoringCriterion[], rootId: string): string[] {
  const childrenMap = buildChildrenMap(criteria);
  const leafIds: string[] = [];

  function walk(nodeId: string) {
    const children = childrenMap.get(nodeId) ?? [];
    for (const child of children) {
      if (child.type === "score_item") {
        leafIds.push(child.id);
      } else {
        walk(child.id);
      }
    }
  }

  walk(rootId);
  return leafIds;
}

// Status de um nó: folha é completo/pendente conforme tem ou não
// jurado; grupo é completo se todas as folhas descendentes têm ao
// menos um jurado, parcial se só algumas, pendente se nenhuma.
export function computeNodeStatus(
  criterion: ScoringCriterion,
  criteria: ScoringCriterion[],
  judgeIdsByCriterion: Map<string, string[]>,
): NodeAssignmentStatus {
  if (criterion.type === "score_item") {
    return (judgeIdsByCriterion.get(criterion.id)?.length ?? 0) > 0 ? "completed" : "pending";
  }
  const leafIds = getDescendantLeafIds(criteria, criterion.id);
  if (leafIds.length === 0) return "pending";
  const assignedCount = leafIds.filter(
    (id) => (judgeIdsByCriterion.get(id)?.length ?? 0) > 0,
  ).length;
  if (assignedCount === 0) return "pending";
  if (assignedCount === leafIds.length) return "completed";
  return "partial";
}

// Fração "N/M" exibida ao lado do status — folha é 1/1 ou 0/1; grupo é
// quantas folhas descendentes já têm jurado sobre o total de folhas.
export function computeNodeFraction(
  criterion: ScoringCriterion,
  criteria: ScoringCriterion[],
  judgeIdsByCriterion: Map<string, string[]>,
): { assigned: number; total: number } {
  if (criterion.type === "score_item") {
    return { assigned: (judgeIdsByCriterion.get(criterion.id)?.length ?? 0) > 0 ? 1 : 0, total: 1 };
  }
  const leafIds = getDescendantLeafIds(criteria, criterion.id);
  const assigned = leafIds.filter((id) => (judgeIdsByCriterion.get(id)?.length ?? 0) > 0).length;
  return { assigned, total: leafIds.length };
}

// Jurados exibidos no chip de um grupo — união (deduplicada) dos
// jurados de todas as folhas descendentes. É só um resumo visual, não
// significa que o grupo "recebe" jurado.
export function computeGroupJudgeIds(
  criterion: ScoringCriterion,
  criteria: ScoringCriterion[],
  judgeIdsByCriterion: Map<string, string[]>,
): string[] {
  const leafIds = getDescendantLeafIds(criteria, criterion.id);
  const seen = new Set<string>();
  for (const leafId of leafIds) {
    for (const judgeId of judgeIdsByCriterion.get(leafId) ?? []) {
      seen.add(judgeId);
    }
  }
  return Array.from(seen);
}
