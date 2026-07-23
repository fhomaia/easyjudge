import { useMemo } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeResourceTimes, formatMinutes, getScheduleRowStarts } from "@/lib/scheduleTime";
import { getResourceColor } from "@/lib/resourceColor";
import {
  SCHEDULE_TYPE_STYLES,
  getScheduleEntryDisplay,
  isAutoWaitBreak,
} from "@/lib/scheduleEntryDisplay";
import type { ScheduleDay, ScheduleEntry } from "@/api/client";

// Id do droppable de cada célula — "table-cell:<resourceId>:<rowStart
// em minutos>". Diferente do droppable da timeline (o id "cru" do
// recurso, resolvendo a posição por pixel), aqui a própria linha já É
// o horário de destino, sem precisar de conta de pixel nenhuma — ver
// SchedulePage.handleDragEnd.
export const TABLE_CELL_PREFIX = "table-cell:";

type GridCell =
  | { kind: "entry"; entry: ScheduleEntry; span: number }
  | { kind: "skip" }
  | { kind: "empty" };

interface ScheduleTableViewProps {
  day: ScheduleDay;
  conflicts: Map<string, string[]>;
  onRemoveEntry: (entryId: string) => void;
  // Enquanto o usuário arrasta uma apresentação, o aquecimento
  // vinculado a ela recebe o mesmo deslocamento (ver SchedulePage) —
  // dá a impressão de arrastar os dois juntos, embora o
  // reposicionamento de verdade só aconteça no backend ao soltar.
  peerDrag?: { entryId: string; x: number; y: number } | null;
}

export function ScheduleTableView({
  day,
  conflicts,
  onRemoveEntry,
  peerDrag = null,
}: ScheduleTableViewProps) {
  const times = useMemo(
    () => computeResourceTimes(day.resources, day.startMinutes),
    [day.resources, day.startMinutes],
  );
  const sortedResources = useMemo(
    () => [...day.resources].sort((a, b) => a.order - b.order),
    [day.resources],
  );
  // União de todo horário de início de qualquer recurso — vira uma
  // linha da tabela. Recursos com blocos de duração diferente (ex:
  // aquecimento de 10min ao lado de apresentações de 1min) não têm
  // fronteiras alinhadas naturalmente entre si; a célula de um recurso
  // cuja entry atravessa mais de uma linha ganha rowSpan (ver grid
  // abaixo) em vez de se repetir.
  const rowStarts = useMemo(
    () => getScheduleRowStarts(day.resources, times),
    [day.resources, times],
  );

  // horário -> índice da linha, pra ancorar cada entry direto (sem
  // andar recurso por recurso) — precisa disso porque as linhas agora
  // vêm só de entries "de verdade" (rowStarts já exclui os intervalos
  // automáticos, ver getScheduleRowStarts), então o horário de início
  // de uma entry real sempre bate exatamente com uma linha, mas o de
  // um intervalo suprimido pode não bater com nenhuma.
  const rowIndexByStart = useMemo(
    () => new Map(rowStarts.map((start, index) => [start, index])),
    [rowStarts],
  );

  const grid = useMemo(() => {
    return sortedResources.map((resource) => {
      const cells: GridCell[] = rowStarts.map(() => ({ kind: "empty" }));
      const sortedEntries = [...resource.entries].sort((a, b) => a.order - b.order);
      for (const entry of sortedEntries) {
        // Suprimido da tabela — a linha de tempo continua mostrando
        // (é lá que faz sentido ver o motivo do atraso), mas aqui só
        // polui: o intervalo em si não é uma equipe nem um componente
        // de verdade, só o tempo entre um e outro.
        if (isAutoWaitBreak(entry)) continue;
        const t = times.get(entry.id);
        if (!t) continue;
        const anchor = rowIndexByStart.get(t.startMinutes);
        if (anchor === undefined) continue;
        let span = 0;
        let j = anchor;
        while (j < rowStarts.length && rowStarts[j] < t.endMinutes) {
          span++;
          j++;
        }
        span = Math.max(span, 1);
        cells[anchor] = { kind: "entry", entry, span };
        for (let k = anchor + 1; k < anchor + span && k < cells.length; k++) {
          cells[k] = { kind: "skip" };
        }
      }
      return cells;
    });
  }, [sortedResources, rowStarts, times, rowIndexByStart]);

  // Horário em que cada recurso realmente termina (soma de toda
  // duração já agendada nele) — vira a célula de destino da linha
  // extra no fim da tabela (ver trailing row abaixo). Sem essa linha
  // dedicada, soltar algo "depois de tudo" exigia mirar a MESMA célula
  // do último evento — e como o horário dessa célula é o INÍCIO do
  // evento, não o fim, o cálculo de posição (ver SchedulePage.
  // handleDragEnd) media a distância até o meio do card e às vezes
  // resolvia "antes dele" em vez de "depois".
  const resourceEndMinutes = sortedResources.map((resource) =>
    resource.entries.reduce((sum, e) => sum + e.durationMinutes, day.startMinutes),
  );

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th className="sticky left-0 top-0 z-20 min-w-24 border-r border-border/40 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Horário
            </th>
            {sortedResources.map((resource) => (
              <th
                key={resource.id}
                className="sticky top-0 z-10 min-w-40 border-r border-border/30 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground last:border-r-0"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getResourceColor(resource) }}
                  />
                  <span className="truncate">{resource.name}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowStarts.map((rowStart, rowIndex) => (
            <tr key={rowStart} className="border-b border-border/40 last:border-b-0">
              <td className="sticky left-0 z-10 border-r border-border/40 bg-card px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                {formatMinutes(rowStart)}
              </td>
              {sortedResources.map((resource, resourceIndex) => {
                const cell = grid[resourceIndex][rowIndex];
                if (cell.kind === "skip") return null;
                if (cell.kind === "entry") {
                  const t = times.get(cell.entry.id)!;
                  return (
                    <TableEntryCell
                      key={cell.entry.id}
                      entry={cell.entry}
                      rowSpan={cell.span}
                      resourceId={resource.id}
                      rowStart={rowStart}
                      startMinutes={t.startMinutes}
                      endMinutes={t.endMinutes}
                      conflictReasons={conflicts.get(cell.entry.id) ?? []}
                      onRemove={() => onRemoveEntry(cell.entry.id)}
                      peerDrag={peerDrag && peerDrag.entryId === cell.entry.id ? peerDrag : null}
                    />
                  );
                }
                return (
                  <TableEmptyCell
                    key={`${resource.id}:${rowStart}`}
                    resourceId={resource.id}
                    rowStart={rowStart}
                  />
                );
              })}
            </tr>
          ))}

          {/* Linha reservada só pra "depois do último horário" de cada
              recurso — alvo de soltar sem ambiguidade, separado da
              célula do último evento (ver comentário de
              resourceEndMinutes acima). */}
          <tr className="border-t-2 border-dashed border-border/60">
            <td className="sticky left-0 z-10 border-r border-border/40 bg-card px-3 py-2 align-top text-xs text-muted-foreground/60">
              {rowStarts.length === 0 ? "—" : "+"}
            </td>
            {sortedResources.map((resource, index) => (
              <TableTrailingCell
                key={`trailing:${resource.id}`}
                resourceId={resource.id}
                dropMinutes={resourceEndMinutes[index]}
              />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface TableEntryCellProps {
  entry: ScheduleEntry;
  rowSpan: number;
  resourceId: string;
  rowStart: number;
  startMinutes: number;
  endMinutes: number;
  conflictReasons: string[];
  onRemove: () => void;
  // Setado quando ESTA célula não é a que o usuário está arrastando,
  // mas sim o aquecimento vinculado à apresentação sendo arrastada —
  // espelha o deslocamento do drag ativo (ver SchedulePage), pra dar a
  // impressão de arrastar os dois juntos.
  peerDrag?: { x: number; y: number } | null;
}

function TableEntryCell({
  entry,
  rowSpan,
  resourceId,
  rowStart,
  startMinutes,
  endMinutes,
  conflictReasons,
  onRemove,
  peerDrag,
}: TableEntryCellProps) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: entry.id,
  });
  // A própria célula ocupada também é um alvo de soltar — arrastar
  // outra coisa por cima dela ainda conta como "soltar neste recurso,
  // neste horário" (mesma posição de insertIndex calculada em
  // handleDragEnd a partir do horário da linha).
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${TABLE_CELL_PREFIX}${resourceId}:${rowStart}`,
  });
  const style = SCHEDULE_TYPE_STYLES[entry.type];
  const hasConflict = conflictReasons.length > 0;
  const { title, subtitle, timeRange, tooltip } = getScheduleEntryDisplay(
    entry,
    startMinutes,
    endMinutes,
    conflictReasons,
  );
  const effectiveTransform = transform ?? (peerDrag ? { x: peerDrag.x, y: peerDrag.y } : null);

  function setRefs(node: HTMLTableCellElement | null) {
    setDragRef(node);
    setDropRef(node);
  }

  return (
    <td
      ref={setRefs}
      {...listeners}
      {...attributes}
      rowSpan={rowSpan}
      title={tooltip}
      style={{
        transform: effectiveTransform
          ? `translate3d(${effectiveTransform.x}px, ${effectiveTransform.y}px, 0)`
          : undefined,
        position: effectiveTransform ? "relative" : undefined,
        zIndex: isDragging || peerDrag ? 50 : undefined,
      }}
      className={cn(
        "group relative min-w-40 cursor-grab border-r border-l border-border/30 px-3 py-2 align-top text-xs transition-opacity last:border-r-0 active:cursor-grabbing",
        style.bg,
        style.text,
        hasConflict && "bg-destructive/15 text-destructive",
        (isDragging || peerDrag) && "opacity-50",
        isOver && "ring-2 ring-inset ring-primary/40",
      )}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-1 top-1 hidden rounded-full bg-black/10 p-0.5 group-hover:block hover:bg-black/20"
      >
        <X className="size-3" />
      </button>
      <p className="truncate pr-4 font-medium">{title}</p>
      {subtitle && <p className="truncate pr-4 opacity-80">{subtitle}</p>}
      <p className="truncate pr-4 opacity-70">{timeRange}</p>
    </td>
  );
}

function TableEmptyCell({ resourceId, rowStart }: { resourceId: string; rowStart: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${TABLE_CELL_PREFIX}${resourceId}:${rowStart}`,
  });
  return (
    <td
      ref={setNodeRef}
      className={cn(
        "min-w-40 border-r border-l border-border/30 px-3 py-2 align-top text-xs text-muted-foreground/40 last:border-r-0",
        isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30",
      )}
    >
      —
    </td>
  );
}

// Célula "depois de tudo" de um recurso — sempre soma no fim da fila
// dele (dropMinutes = a soma de toda duração já agendada), nunca antes
// de um evento existente. Visual tracejado/discreto, igual ao "Novo
// recurso" da timeline, pra deixar claro que é uma área de soltar, não
// um evento de verdade.
function TableTrailingCell({
  resourceId,
  dropMinutes,
}: {
  resourceId: string;
  dropMinutes: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${TABLE_CELL_PREFIX}${resourceId}:${dropMinutes}`,
  });
  return (
    <td
      ref={setNodeRef}
      className={cn(
        "min-w-40 border-r border-l border-dashed border-border/40 px-3 py-2 align-top text-xs text-muted-foreground/40 last:border-r-0",
        isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30",
      )}
    >
      Arraste aqui para adicionar após o evento acima
    </td>
  );
}
