import { getSpreadColor } from "@/lib/avatarColor";

interface MetricColumnChartProps {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}

// Colunas verticais, ranqueadas pela ORDEM em que vêm em `items` — usado
// hoje só por "Categorias por programa" (nome de programa é livre,
// então a lista pode ter mais itens do que cabe na largura do card:
// coluna com largura FIXA + rolagem horizontal, em vez de flex-1
// espremendo/estourando o card — bug real reportado em produção com um
// evento de 7+ programas). Cada coluna com sua própria cor (mesma
// paleta de 13 cores dos ícones de súmula/evento, atribuída pela
// POSIÇÃO — não pelo hash do nome, ver getSpreadColor — pra garantir
// contraste entre programas vizinhos em vez de tons parecidos por
// coincidência).
export function MetricColumnChart({
  items,
  emptyLabel = "Nenhum dado ainda.",
}: MetricColumnChartProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    // `pb-4`: espaço pra barra de rolagem horizontal ficar ABAIXO dos
    // nomes — em sistemas com barra sobreposta (Linux, celular) ela
    // cobria o nome dos programas.
    <div className="scrollbar-slim flex h-52 items-end gap-3 overflow-x-auto pb-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="group flex h-full w-14 shrink-0 flex-col items-center justify-end gap-1.5"
        >
          <span className="text-xs font-medium tabular-nums text-foreground">{item.count}</span>
          {/* Coluna: reta na base (nasce do eixo), arredondada só no
              topo (a ponta de dado) — nunca a base. */}
          <div
            className="w-8 rounded-t-sm transition-[filter] duration-150 group-hover:brightness-110"
            style={{
              height: `${Math.max((item.count / max) * 100, 4)}%`,
              backgroundColor: getSpreadColor(i),
            }}
          />
          <span
            className="mt-1 line-clamp-2 h-8 w-full shrink-0 text-center text-xs leading-4 text-muted-foreground"
            title={item.label}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
