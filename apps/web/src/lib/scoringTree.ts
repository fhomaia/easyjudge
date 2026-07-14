import type { ScoringCriterion } from "@/api/client";

export interface FlatScoringNode {
  criterion: ScoringCriterion;
  depth: number;
  path: string;
  hasChildren: boolean;
}

export function buildChildrenMap(
  criteria: ScoringCriterion[],
): Map<string | null, ScoringCriterion[]> {
  const map = new Map<string | null, ScoringCriterion[]>();
  for (const criterion of criteria) {
    const key = criterion.parentId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(criterion);
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => a.order - b.order);
  }
  return map;
}

// Achata a árvore num array ordenado via DFS, pulando subárvores sob um
// ancestral recolhido. Esse array alimenta tanto a renderização simples
// (indentação por depth) quanto o drag-and-drop depois.
export function flattenTree(
  criteria: ScoringCriterion[],
  collapsedIds: ReadonlySet<string>,
): FlatScoringNode[] {
  const childrenMap = buildChildrenMap(criteria);
  const result: FlatScoringNode[] = [];

  function walk(parentId: string | null, depth: number, pathPrefix: string) {
    const children = childrenMap.get(parentId) ?? [];
    children.forEach((criterion, index) => {
      const path = pathPrefix ? `${pathPrefix}.${index + 1}` : `${index + 1}`;
      const hasChildren = (childrenMap.get(criterion.id)?.length ?? 0) > 0;
      result.push({ criterion, depth, path, hasChildren });
      if (hasChildren && !collapsedIds.has(criterion.id)) {
        walk(criterion.id, depth + 1, path);
      }
    });
  }

  walk(null, 0, "");
  return result;
}

export function getDirectChildren(
  criteria: ScoringCriterion[],
  parentId: string | null,
): ScoringCriterion[] {
  return criteria.filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function sumMaxScore(criteria: ScoringCriterion[]): number {
  return criteria.reduce((sum, c) => sum + c.maxScore, 0);
}

// Profundidade máxima da árvore — um nó raiz sozinho já conta como
// profundidade 1 (bate com o exemplo do print: Building > Pyramid >
// Difficulty = 3 níveis).
export function maxTreeDepth(criteria: ScoringCriterion[]): number {
  const childrenMap = buildChildrenMap(criteria);
  let deepest = 0;

  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) ?? [];
    if (children.length === 0) return;
    deepest = Math.max(deepest, depth + 1);
    for (const child of children) {
      walk(child.id, depth + 1);
    }
  }

  walk(null, 0);
  return deepest;
}

// Um grupo é "válido" quando a soma do maxScore dos filhos diretos bate
// com o próprio maxScore. Um item de avaliação (folha) não tem essa
// checagem — é sempre considerado válido.
export function isNodeValid(criterion: ScoringCriterion, criteria: ScoringCriterion[]): boolean {
  if (criterion.type !== "group") return true;
  const children = getDirectChildren(criteria, criterion.id);
  if (children.length === 0) return true;
  return Math.abs(sumMaxScore(children) - criterion.maxScore) < 0.001;
}
