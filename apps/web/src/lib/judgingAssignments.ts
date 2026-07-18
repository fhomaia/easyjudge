import type { ScoringCriterion } from "@/api/client";
import { buildChildrenMap } from "@/lib/scoringTree";

export type NodeAssignmentStatus = "completed" | "partial" | "pending";

// Chave composta pro Map de atribuições — um critério-folha agora tem
// um conjunto de jurados POR RECURSO (pista), não um só (ver
// CriterionJudgeAssignment no backend: um jurado não pode estar em
// dois palcos ao mesmo tempo). `judgeIdsByCriterion` no restante do
// app é `Map<assignmentKey(criterionId, resourceId), string[]>`.
export function assignmentKey(criterionId: string, resourceId: string): string {
  return `${criterionId}::${resourceId}`;
}

export function parseAssignmentKey(key: string): { criterionId: string; resourceId: string } | null {
  const sepIndex = key.lastIndexOf("::");
  if (sepIndex === -1) return null;
  return { criterionId: key.slice(0, sepIndex), resourceId: key.slice(sepIndex + 2) };
}

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

function isLeafAssignedForResource(
  judgeIdsByCriterion: Map<string, string[]>,
  leafId: string,
  resourceId: string,
): boolean {
  return (judgeIdsByCriterion.get(assignmentKey(leafId, resourceId))?.length ?? 0) > 0;
}

// Status de um nó, considerando TODOS os recursos (pistas) do dia
// selecionado — um critério-folha só está "completo" quando tem
// jurado em CADA recurso (um jurado não cobre duas pistas ao mesmo
// tempo, ver assignmentKey); grupo é completo quando toda combinação
// folha×recurso descendente está coberta, parcial se só algumas,
// pendente se nenhuma.
export function computeNodeStatus(
  criterion: ScoringCriterion,
  criteria: ScoringCriterion[],
  judgeIdsByCriterion: Map<string, string[]>,
  resourceIds: string[],
): NodeAssignmentStatus {
  const { assigned, total } = computeNodeFraction(
    criterion,
    criteria,
    judgeIdsByCriterion,
    resourceIds,
  );
  if (total === 0 || assigned === 0) return "pending";
  if (assigned === total) return "completed";
  return "partial";
}

// Fração "N/M" exibida ao lado do status — folha é (recursos
// atribuídos)/(total de recursos); grupo soma isso pra todas as folhas
// descendentes.
export function computeNodeFraction(
  criterion: ScoringCriterion,
  criteria: ScoringCriterion[],
  judgeIdsByCriterion: Map<string, string[]>,
  resourceIds: string[],
): { assigned: number; total: number } {
  const leafIds =
    criterion.type === "score_item" ? [criterion.id] : getDescendantLeafIds(criteria, criterion.id);
  let assigned = 0;
  for (const leafId of leafIds) {
    for (const resourceId of resourceIds) {
      if (isLeafAssignedForResource(judgeIdsByCriterion, leafId, resourceId)) assigned++;
    }
  }
  return { assigned, total: leafIds.length * resourceIds.length };
}

// Jurados exibidos no chip de um grupo pra UM recurso específico —
// união (deduplicada) dos jurados de todas as folhas descendentes
// naquele recurso. É só um resumo visual, não significa que o grupo
// "recebe" jurado.
export function computeGroupJudgeIds(
  criterion: ScoringCriterion,
  criteria: ScoringCriterion[],
  judgeIdsByCriterion: Map<string, string[]>,
  resourceId: string,
): string[] {
  const leafIds = getDescendantLeafIds(criteria, criterion.id);
  const seen = new Set<string>();
  for (const leafId of leafIds) {
    for (const judgeId of judgeIdsByCriterion.get(assignmentKey(leafId, resourceId)) ?? []) {
      seen.add(judgeId);
    }
  }
  return Array.from(seen);
}
