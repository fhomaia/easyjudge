interface MetricColumnChartProps {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
  // Cor CSS (ex. "var(--chart-6)") da coluna — cada card da tela de
  // Métricas usa uma cor diferente entre si só pra ficar fácil
  // diferenciar um gráfico do outro de relance.
  color?: string;
}

// Colunas verticais, ranqueadas pela ORDEM em que vêm em `items` — usado
// tanto ranqueado por magnitude ("Categorias por programa") quanto por
// ordem natural, sem reordenar ("Apresentações por nível", onde nível é
// ordinal e trocar a ordem mudaria o sentido do gráfico). Rótulos curtos
// cabem melhor como eixo de colunas do que na lista horizontal usada
// pelo resto da tela (MetricBarList, pensada pra rótulo de texto mais
// longo/variável — nome de programa, estado).
export function MetricColumnChart({
  items,
  emptyLabel = "Nenhum dado ainda.",
  color = "var(--chart-1)",
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
            className="w-full max-w-8 rounded-t-sm transition-[filter] duration-150 group-hover:brightness-110"
            style={{ height: `${Math.max((item.count / max) * 100, 4)}%`, backgroundColor: color }}
          />
          <span className="mt-1 max-w-full truncate text-xs text-muted-foreground" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
