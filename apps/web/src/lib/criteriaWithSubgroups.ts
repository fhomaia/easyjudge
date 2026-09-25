import type { PresentationDetailCriterion, PresentationDetailGroup } from "@/api/client";

export type CriterionRow =
  | { kind: "subgroup"; label: string; depth: number }
  | { kind: "criterion"; criterion: PresentationDetailCriterion };

// Critérios de um grupo da súmula (já na ordem da árvore, ver backend
// sortCriteriaByTree) intercalados com um subtítulo sempre que o
// subgrupo muda — tela e PDF da súmula seguem a estrutura do template.
export function criteriaWithSubgroups(criteria: PresentationDetailCriterion[]): CriterionRow[] {
  const rows: CriterionRow[] = [];
  let previous: string[] = [];
  for (const criterion of criteria) {
    const path = criterion.subgroupPath ?? [];
    // Primeiro nível em que o caminho diverge do critério anterior.
    let common = 0;
    while (common < path.length && common < previous.length && path[common] === previous[common]) {
      common += 1;
    }
    for (let depth = common; depth < path.length; depth += 1) {
      rows.push({ kind: "subgroup", label: path[depth], depth });
    }
    rows.push({ kind: "criterion", criterion });
    previous = path;
  }
  return rows;
}

// "Grupo" que na verdade é um critério solto no primeiro nível da árvore
// (o backend agrupa pela raiz, e a raiz de um critério solto é ele mesmo).
export function isStandaloneCriterion(group: PresentationDetailGroup): boolean {
  return group.criteria.length === 1 && group.criteria[0].id === group.id;
}

// Subtítulos que precisam aparecer ANTES de um item, comparando o
// caminho de subgrupos dele com o do item anterior (mesma regra de
// criteriaWithSubgroups). Usado pela súmula do jurado, que desenha cada
// item com o próprio layout.
export function subgroupHeadingsBefore(
  previousPath: string[],
  path: string[],
): { label: string; depth: number }[] {
  let common = 0;
  while (common < path.length && common < previousPath.length && path[common] === previousPath[common]) {
    common += 1;
  }
  const headings: { label: string; depth: number }[] = [];
  for (let depth = common; depth < path.length; depth += 1) {
    headings.push({ label: path[depth], depth });
  }
  return headings;
}
