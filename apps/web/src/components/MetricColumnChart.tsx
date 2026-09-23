interface MetricColumnChartProps {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}

// Colunas verticais, ranqueadas pela ORDEM em que vêm em `items` (não
// por magnitude) — usado só pra "Apresentações por nível" na tela de
// Métricas do evento: nível é ordinal (1 a 7), trocar a ordem mudaria o
// sentido do gráfico. Rótulos curtos ("Nível 3") cabem melhor como eixo
// de colunas do que na lista horizontal usada pelo resto da tela
// (MetricBarList), que é pensada pra rótulo de texto mais longo/
// variável (nome de programa, estado).
export function MetricColumnChart({
  items,
  emptyLabel = "Nenhum dado ainda.",
}: MetricColumnChartProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="flex h-48 items-end gap-2 border-b border-border pb-0">
      {items.map((item) => (
        <div key={item.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-xs font-medium tabular-nums text-foreground">{item.count}</span>
          {/* Coluna: reta na base (nasce do eixo), arredondada só no
              topo (a ponta de dado) — nunca a base. */}
          <div
            className="w-full max-w-8 rounded-t-sm bg-chart-1 transition-[filter] duration-150 group-hover:brightness-110"
            style={{ height: `${Math.max((item.count / max) * 100, 4)}%` }}
          />
          <span className="mt-1 max-w-full truncate text-xs text-muted-foreground" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
