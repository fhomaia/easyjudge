interface MetricBarListProps {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}

// Lista de barras horizontais, ranqueada por magnitude — usada pelos
// gráficos da tela de Métricas do evento (EventMetricsPage). Cor única
// (--chart-1, a mesma tonalidade de brand-blue do resto do app): a
// identidade de cada categoria já vem do rótulo em texto, não precisa de
// paleta categórica (nem "por modalidade" nem "por estado" comparam
// cores entre si, só magnitude entre linhas).
export function MetricBarList({ items, emptyLabel = "Nenhum dado ainda." }: MetricBarListProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span
            className="w-24 shrink-0 truncate text-sm text-foreground sm:w-36"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
              title={`${item.label}: ${item.count}`}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
