import { useEffect, useRef, useState } from "react";
import { formatMinutes } from "@/lib/scheduleTime";
import { formatDelayText, type DelayPoint } from "@/lib/delayTimeline";

interface MetricDelayChartProps {
  points: DelayPoint[];
}

const HEIGHT = 220;
const MARGIN = { top: 24, right: 20, bottom: 28, left: 52 };
const NICE_STEPS = [5, 10, 15, 30, 60, 120, 240, 480, 720, 1440];

// Passo "redondo" do eixo Y; acima de 1 dia continua dobrando, pra nunca
// gerar marcações demais (dados de teste com dias de diferença).
function niceStep(span: number, targetTicks: number): number {
  const raw = span / targetTicks;
  const found = NICE_STEPS.find((s) => s >= raw);
  if (found) return found;
  let step = NICE_STEPS[NICE_STEPS.length - 1];
  while (step < raw) step *= 2;
  return step;
}

function formatAxisDelay(minutes: number): string {
  if (minutes === 0) return "0";
  const abs = Math.abs(minutes);
  const text = abs >= 60 && abs % 60 === 0 ? `${abs / 60}h` : `${abs}min`;
  return minutes > 0 ? `+${text}` : `-${text}`;
}

// Atraso ao longo do dia (Métricas do evento): uma linha com um ponto por
// apresentação/evento especial iniciado, no horário real. Acima de zero =
// atrasado, abaixo = adiantado. Série única: sem legenda, cor do tema
// (var(--chart-1)); rótulos só no pico e no último ponto; o resto fica no
// tooltip (crosshair que encosta no ponto mais próximo) e na tabela.
export function MetricDelayChart({ points }: MetricDelayChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const xs = points.map((p) => p.actualMinutes);
  const xMinRaw = Math.min(...xs);
  const xMaxRaw = Math.max(...xs);
  const xSpan = Math.max(xMaxRaw - xMinRaw, 30);
  const xStep = xSpan <= 120 ? 30 : xSpan <= 360 ? 60 : 120;
  const xMin = Math.floor((xMinRaw - 5) / xStep) * xStep;
  const xMax = Math.ceil((xMinRaw + xSpan + 5) / xStep) * xStep;

  const delays = points.map((p) => p.delayMinutes);
  const yMinRaw = Math.min(0, ...delays);
  const yMaxRaw = Math.max(0, ...delays);
  const yStep = niceStep(Math.max(yMaxRaw - yMinRaw, 10), 4);
  const yMin = Math.floor(yMinRaw / yStep) * yStep;
  const yMax = Math.max(Math.ceil(yMaxRaw / yStep) * yStep, yMin + yStep);

  const x = (m: number) => MARGIN.left + ((m - xMin) / (xMax - xMin)) * innerW;
  const y = (d: number) => MARGIN.top + ((yMax - d) / (yMax - yMin)) * innerH;

  const xTicks: number[] = [];
  for (let t = xMin; t <= xMax; t += xStep) xTicks.push(t);
  const yTicks: number[] = [];
  for (let t = yMin; t <= yMax; t += yStep) yTicks.push(t);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.actualMinutes)},${y(p.delayMinutes)}`).join(" ");

  const peakIndex = delays.reduce((best, d, i) => (d > delays[best] ? i : best), 0);
  const lastIndex = points.length - 1;
  const labeled = new Set([lastIndex, ...(delays[peakIndex] > 0 ? [peakIndex] : [])]);

  function handlePointer(clientX: number) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.actualMinutes) - px) < Math.abs(x(points[nearest].actualMinutes) - px)) nearest = i;
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  // Ao lado da linha vertical (nunca por cima do ponto): à direita na
  // metade esquerda do gráfico, à esquerda na metade direita.
  const TOOLTIP_W = 210;
  const hoverX = hovered ? x(hovered.actualMinutes) : 0;
  const tooltipLeft = hovered
    ? hoverX < width / 2
      ? Math.min(hoverX + 12, width - TOOLTIP_W)
      : Math.max(hoverX - 12 - TOOLTIP_W, 0)
    : 0;

  return (
    <div>
      <div
        ref={wrapperRef}
        className="relative w-full touch-pan-y select-none"
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <svg width={width} height={HEIGHT} role="img" aria-label="Atraso ao longo do evento">
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--muted-foreground)" : "var(--border)"}
                strokeOpacity={t === 0 ? 0.6 : 1}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatAxisDelay(t)}
              </text>
            </g>
          ))}
          <text
            x={MARGIN.left + 4}
            y={y(0) - 5}
            textAnchor="start"
            className="fill-muted-foreground text-[10px]"
          >
            No horário
          </text>
          {xTicks.map((t) => (
            <text
              key={`x${t}`}
              x={x(t)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {formatMinutes(t)}
            </text>
          ))}

          {hovered && (
            <line
              x1={x(hovered.actualMinutes)}
              x2={x(hovered.actualMinutes)}
              y1={MARGIN.top}
              y2={MARGIN.top + innerH}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}

          <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) => (
            <circle
              key={p.entryId}
              cx={x(p.actualMinutes)}
              cy={y(p.delayMinutes)}
              r={hoverIndex === i ? 6 : 4}
              fill="var(--chart-1)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}

          {[...labeled].map((i) => {
            const p = points[i];
            const cx = x(p.actualMinutes);
            const anchor = cx > width - 90 ? "end" : cx < MARGIN.left + 60 ? "start" : "middle";
            return (
              <text
                key={`l${i}`}
                x={cx}
                y={y(p.delayMinutes) - 10}
                textAnchor={anchor}
                className="fill-foreground text-[11px] font-medium tabular-nums"
              >
                {i === peakIndex && i !== lastIndex ? `Pico ${formatDelayText(p.delayMinutes)}` : formatDelayText(p.delayMinutes)}
              </text>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ left: tooltipLeft, width: TOOLTIP_W }}
          >
            <p className="truncate font-semibold text-foreground">{hovered.label}</p>
            <p className="whitespace-nowrap text-muted-foreground">
              Planejado {formatMinutes(hovered.plannedMinutes)} · Real {formatMinutes(hovered.actualMinutes)}
            </p>
            <p className="font-medium text-foreground">{formatDelayText(hovered.delayMinutes)}</p>
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Ver tabela</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Item</th>
              <th className="py-1 font-medium">Planejado</th>
              <th className="py-1 font-medium">Real</th>
              <th className="py-1 text-right font-medium">Atraso</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.entryId} className="border-t border-border">
                <td className="py-1 pr-2 text-foreground">{p.label}</td>
                <td className="py-1 tabular-nums text-muted-foreground">{formatMinutes(p.plannedMinutes)}</td>
                <td className="py-1 tabular-nums text-muted-foreground">{formatMinutes(p.actualMinutes)}</td>
                <td className="py-1 text-right tabular-nums text-foreground">{formatDelayText(p.delayMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
