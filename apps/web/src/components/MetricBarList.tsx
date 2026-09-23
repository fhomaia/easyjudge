interface MetricBarListProps {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
  // Cor CSS (ex. "var(--chart-6)") da barra — cada card da tela de
  // Métricas usa uma cor diferente entre si só pra ficar fácil
  // diferenciar um gráfico do outro de relance; dentro de UM gráfico
  // continua sendo cor única (série única, sem paleta categórica —
  // a identidade de cada linha já vem do rótulo em texto).
  color?: string;
}

// Lista de barras horizontais, ranqueada por magnitude — usada pelos
// gráficos da tela de Métricas do evento (EventMetricsPage). Sem
// legenda: série única, o título do card já diz o que é.
export function MetricBarList({
  items,
  emptyLabel = "Nenhum dado ainda.",
  color = "var(--chart-1)",
}: MetricBarListProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="group flex items-center gap-3">
          <span
            className="w-24 shrink-0 truncate text-sm text-foreground sm:w-36"
            title={item.label}
          >
            {item.label}
          </span>
          {/* Track: reto (a barra nasce de uma base à esquerda); só a
              ponta de dado (direita) é arredondada — nunca a base, pra
              não parecer que o valor "flutua" sem origem. */}
          <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-r-sm transition-[filter] duration-150 group-hover:brightness-110"
              style={{ width: `${Math.max((item.count / max) * 100, 4)}%`, backgroundColor: color }}
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
