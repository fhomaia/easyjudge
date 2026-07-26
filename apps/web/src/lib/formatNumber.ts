// Formatação pt-BR (vírgula decimal, ponto de milhar) usada na página
// de Resultados — pontuação e percentual de aproveitamento.
export function formatPoints(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
