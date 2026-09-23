import { useState } from "react";
import { getSpreadColor } from "@/lib/avatarColor";

interface MetricDonutChartProps {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
  // "categorical": identidade sem ordem, cores fixas do tema (ex.
  // estado) — poucos slots, pensado pra quando os itens em si já têm
  // pouca variedade (no máximo ~5 categorias reais esperadas).
  // "vibrant": identidade sem ordem pedindo cores BEM diferentes entre
  // si mesmo com mais itens (ex. nível, quando o pedido é diferenciar
  // cada fatia à primeira vista) — reaproveita a mesma paleta de 13
  // cores já usada nos ícones de súmula/evento, atribuída pela POSIÇÃO
  // do segmento (ver getSpreadColor) — não pelo hash do rótulo, que
  // podia colocar rótulos parecidos ("Nível 1"/"Nível 2") em tons
  // vizinhos do mesmo matiz por coincidência. Excedente ao teto de
  // segmentos sempre dobra em "Outros" (cinza), nos dois modos.
  colorMode?: "categorical" | "vibrant";
  maxSegments?: number;
}

const SIZE = 168;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

// 5 dos 7 slots de cor do tema (--chart-1..7, validados com
// scripts/validate_palette.js do skill de dataviz) — não lidera com
// azul de propósito, já que outros cards da mesma tela já usam azul
// (cada card usa uma cor diferente entre si só pra ficar fácil
// diferenciar um gráfico do outro de relance). Acima de 5 categorias
// reais, o excedente vira "Outros" (cinza), então nunca estoura os
// slots de qualquer forma.
const CATEGORICAL_SLOTS = [
  "var(--chart-6)",
  "var(--chart-2)",
  "var(--chart-7)",
  "var(--chart-1)",
  "var(--chart-3)",
];

// Rosca com percentual sempre visível (legenda + rótulo do centro); a
// quantidade absoluta só aparece ao passar o mouse ou clicar num
// segmento (pedido do usuário) — o centro troca de "total" pro
// segmento ativo, e some ao tirar o mouse (mas fica preso no último
// clique, pra funcionar em touch sem hover).
export function MetricDonutChart({
  items,
  emptyLabel = "Nenhum dado ainda.",
  colorMode = "categorical",
  maxSegments,
}: MetricDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const cap = maxSegments ?? (colorMode === "vibrant" ? 8 : 6);
  const folded =
    items.length > cap
      ? [
          ...items.slice(0, cap - 1),
          {
            label: "Outros",
            count: items.slice(cap - 1).reduce((sum, item) => sum + item.count, 0),
          },
        ]
      : items;

  const total = folded.reduce((sum, item) => sum + item.count, 0) || 1;

  let cumulative = 0;
  const segments = folded.map((item, i) => {
    const fraction = item.count / total;
    const length = fraction * CIRCUMFERENCE;
    const offset = -cumulative;
    cumulative += length;
    const color =
      item.label === "Outros"
        ? "var(--muted-foreground)"
        : colorMode === "vibrant"
          ? getSpreadColor(i)
          : CATEGORICAL_SLOTS[i % CATEGORICAL_SLOTS.length];
    return { ...item, length, offset, fraction, color };
  });

  const active = activeIndex !== null ? segments[activeIndex] : null;
  const hover = (i: number | null) => () => setActiveIndex(i);
  const toggle = (i: number) => () => setActiveIndex((current) => (current === i ? null : i));

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {segments.map((seg, i) => (
            <circle
              key={seg.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(seg.length - GAP, 0)} ${CIRCUMFERENCE - seg.length + GAP}`}
              strokeDashoffset={seg.offset}
              tabIndex={0}
              role="img"
              aria-label={`${seg.label}: ${seg.count} (${Math.round(seg.fraction * 100)}%)`}
              className="cursor-pointer outline-none transition-[filter] duration-150 hover:brightness-110 focus-visible:brightness-110"
              onMouseEnter={hover(i)}
              onMouseLeave={hover(null)}
              onFocus={hover(i)}
              onBlur={hover(null)}
              onClick={toggle(i)}
            >
              <title>{`${seg.label}: ${seg.count} (${Math.round(seg.fraction * 100)}%)`}</title>
            </circle>
          ))}
        </g>
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-lg font-semibold"
        >
          {active ? active.count : total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 14}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-[11px]"
        >
          {active ? active.label : "Total"}
        </text>
      </svg>
      <ul className="flex w-full flex-col gap-1 text-sm sm:w-auto">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            tabIndex={0}
            className={`flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 outline-none transition-colors ${
              activeIndex === i ? "bg-muted" : "hover:bg-muted/50"
            }`}
            onMouseEnter={hover(i)}
            onMouseLeave={hover(null)}
            onFocus={hover(i)}
            onBlur={hover(null)}
            onClick={toggle(i)}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="flex-1 truncate text-foreground" title={seg.label}>
              {seg.label}
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums font-medium text-foreground">
              {Math.round(seg.fraction * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
