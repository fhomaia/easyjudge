import type { DeductionRuleView, ScoringGroupView } from "@/api/client";
import type { DeductionLogEntry } from "@/lib/scoreEventsReducer";

// Soma só os critérios que ESTE jurado pontua (sheet.groups já vem
// escopado à atribuição dele) — não é o total da apresentação inteira,
// é a contribuição deste jurado.
export function sumCriteriaScores(groups: ScoringGroupView[], scores: Record<string, number>): number {
  return groups.flatMap((g) => g.criteria).reduce((sum, c) => sum + (scores[c.id] ?? 0), 0);
}

// `rules` (DeductionRuleView.value) já vem negativo do backend (ex:
// -1.0, -4.0 — ver iasf-deductions.ts), então somar direto ao total dá
// o resultado final sem precisar inverter sinal.
export function sumDeductions(deductions: DeductionLogEntry[], rules: DeductionRuleView[]): number {
  const valueByType = new Map(rules.map((r) => [r.type, r.value]));
  return deductions.reduce((sum, d) => sum + (valueByType.get(d.deductionType) ?? 0), 0);
}

// Soma dos `maxScore` dos mesmos critérios usados em sumCriteriaScores
// — base do "% de aproveitamento" (nota obtida / nota máxima). Tipado
// estruturalmente pra servir tanto ScoringGroupView[] (súmula do
// próprio jurado) quanto PresentationDetailGroup[] (súmula combinada
// do admin/programa), sem precisar de dois helpers iguais.
export function sumMaxScores(groups: Array<{ criteria: Array<{ maxScore: number }> }>): number {
  return groups.flatMap((g) => g.criteria).reduce((sum, c) => sum + c.maxScore, 0);
}
