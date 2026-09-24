// Formatação pt-BR (vírgula decimal, ponto de milhar) usada na página
// de Resultados — pontuação e percentual de aproveitamento.
export function formatPoints(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

// Nota de um critério na súmula: 1 casa decimal, ou 2 quando a nota tem
// (9,25 não pode virar 9,3, senão a soma das linhas não bate com o
// total). Mesma vírgula decimal dos totais.
export function formatCriterionScore(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
