import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeResourceTimes, formatMinutes } from "@/lib/scheduleTime";
import { getResourceColor } from "@/lib/resourceColor";
import { ScheduleEntryCard } from "./ScheduleEntryCard";
import type { ScheduleDay, ScheduleResource } from "@/api/client";

// Calibrado pra deixar um card de apresentação de ~3 min (o caso
// típico) largo o suficiente pra ler o nome da equipe sem depender só
// do rótulo "vazando" pra fora do card (ver ScheduleEntryCard). Isso
// custa quanto do dia cabe visível sem rolar — de propósito: preferimos
// ver ~15-20 min de cada vez com texto legível a ver 30 min truncado.
export const SCHEDULE_PX_PER_MINUTE = 44;

// Prefixos dos ids de drag/drop usados pra reordenar as próprias
// linhas de recurso (distintos do id "cru" do recurso, que já é o
// droppable da área de entries — ver ResourceRow).
export const RESOURCE_DRAG_PREFIX = "resource-drag:";
export const RESOURCE_DROP_PREFIX = "resource-drop:";

// Recursos são genéricos (nome livre, sem "tipo" fixo em código) — o
// rótulo abaixo do nome é só um resumo do papel derivado dos dados
// (aceita apresentações? é o aquecimento vinculado de alguma pista?),
// não uma categoria embutida no modelo. O vínculo fica no aquecimento
// apontando pra pista (pairedResourceId) — uma pista pode ter mais de
// um aquecimento vinculado, então o rótulo dela mostra a contagem.
function getResourceRoleLabel(resource: ScheduleResource, allResources: ScheduleResource[]): string | null {
  if (resource.supportsPresentations) {
    const warmupCount = allResources.filter((r) => r.pairedResourceId === resource.id).length;
    return warmupCount > 0
      ? `Apresentações · ${warmupCount} ${warmupCount === 1 ? "aquecimento" : "aquecimentos"}`
      : "Apresentações";
  }
  if (resource.pairedResourceId) {
    const mat = allResources.find((r) => r.id === resource.pairedResourceId);
    if (mat) return `Aquecimento de ${mat.name}`;
  }
  return null;
}

interface ResourceRowProps {
  resource: ScheduleResource;
  roleLabel: string | null;
  day: ScheduleDay;
  times: Map<string, { startMinutes: number; endMinutes: number }>;
  conflicts: Map<string, string[]>;
  onRemoveEntry: (entryId: string) => void;
  onEditResource: (resourceId: string) => void;
  peerDrag: { entryId: string; x: number; y: number } | null;
}

function ResourceRow({
  resource,
  roleLabel,
  day,
  times,
  conflicts,
  onRemoveEntry,
  onEditResource,
  peerDrag,
}: ResourceRowProps) {
  const { setNodeRef: setEntriesDropRef, isOver } = useDroppable({ id: resource.id });
  const { setNodeRef: setHandleDropRef, isOver: isHandleOver } = useDroppable({
    id: `${RESOURCE_DROP_PREFIX}${resource.id}`,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: `${RESOURCE_DRAG_PREFIX}${resource.id}` });

  function setHandleRefs(node: HTMLButtonElement | null) {
    setDragRef(node);
    setHandleDropRef(node);
  }

  const totalWidth = (day.endMinutes - day.startMinutes) * SCHEDULE_PX_PER_MINUTE;

  return (
    <div
      className={cn(
        "flex min-h-16 flex-1 border-b border-border/40 last:border-b-0",
        isDragging && "opacity-40",
      )}
    >
      <button
        ref={setHandleRefs}
        {...listeners}
        {...attributes}
        type="button"
        onClick={() => onEditResource(resource.id)}
        style={
          transform
            ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
            : undefined
        }
        className={cn(
          "group sticky left-0 z-20 flex w-36 shrink-0 cursor-grab flex-col justify-center border-r border-border/40 bg-card px-3 py-2 text-left transition-colors hover:bg-muted/60 active:cursor-grabbing",
          isHandleOver && "bg-primary/10",
        )}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: getResourceColor(resource) }}
          />
          <p className="truncate text-sm font-medium text-foreground">{resource.name}</p>
          <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        {roleLabel && <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>}
      </button>
      <div
        ref={setEntriesDropRef}
        style={{
          width: totalWidth,
          minWidth: totalWidth,
          // Tonalidade bem sutil da cor do recurso (mesma da bolinha) —
          // só quando não está em drag-over, que já tem seu próprio
          // destaque (bg-primary/5 via className).
          backgroundColor: isOver ? undefined : `${getResourceColor(resource)}0d`,
        }}
        className={cn("relative min-h-16 flex-1", isOver && "bg-primary/5")}
      >
        {(() => {
          const sortedEntries = [...resource.entries].sort((a, b) => a.order - b.order);
          return sortedEntries.map((entry, index) => {
            const t = times.get(entry.id);
            if (!t) return null;
            const left = (t.startMinutes - day.startMinutes) * SCHEDULE_PX_PER_MINUTE;
            const width = entry.durationMinutes * SCHEDULE_PX_PER_MINUTE;

            // Espaço livre até o próximo item da mesma linha (ou uma
            // folga generosa se for o último) — o rótulo pode "vazar"
            // pra fora do card até esse limite, nunca além dele, pra
            // não ficar ilegível sobre o próximo bloco (o fundo dos
            // cards é translúcido, então só cobrir com z-index não
            // basta).
            const nextEntry = sortedEntries[index + 1];
            const nextT = nextEntry ? times.get(nextEntry.id) : null;
            const availableWidth = nextT
              ? (nextT.startMinutes - t.startMinutes) * SCHEDULE_PX_PER_MINUTE
              : Math.max(width, 240);
            const labelMaxWidth = Math.max(availableWidth - 8, width);

            return (
              <ScheduleEntryCard
                key={entry.id}
                entry={entry}
                startMinutes={t.startMinutes}
                endMinutes={t.endMinutes}
                left={left}
                width={width}
                labelMaxWidth={labelMaxWidth}
                conflictReasons={conflicts.get(entry.id) ?? []}
                onRemove={() => onRemoveEntry(entry.id)}
                peerDrag={peerDrag && peerDrag.entryId === entry.id ? peerDrag : null}
              />
            );
          });
        })()}
      </div>
    </div>
  );
}

// Linha fantasma abaixo do último recurso — mesma "forma" de uma
// ResourceRow, mas tracejada/opaca, convidando a criar um recurso
// novo direto pela timeline (sem precisar abrir "Gerenciar recursos"
// primeiro). Clicar em qualquer ponto abre o mesmo popup de cadastro.
function AddResourceRow({ totalWidth, onClick }: { totalWidth: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full shrink-0 items-stretch text-left"
    >
      <div className="sticky left-0 z-20 flex w-36 shrink-0 items-center gap-1.5 border-r border-dashed border-border bg-card px-3 py-2 text-muted-foreground transition-colors group-hover:text-primary">
        <Plus className="size-3.5 shrink-0" />
        <span className="text-sm">Novo recurso</span>
      </div>
      <div
        style={{ width: totalWidth, minWidth: totalWidth }}
        className="h-16 shrink-0 border-2 border-dashed border-border/50 bg-muted/20 transition-colors group-hover:border-primary/40 group-hover:bg-primary/5"
      />
    </button>
  );
}

interface ScheduleTimelineProps {
  day: ScheduleDay;
  conflicts: Map<string, string[]>;
  onRemoveEntry: (entryId: string) => void;
  onAddResource: () => void;
  onEditResource: (resourceId: string) => void;
  // Enquanto o usuário arrasta uma apresentação, o aquecimento
  // vinculado a ela recebe o mesmo deslocamento (ver SchedulePage) —
  // dá a impressão de arrastar os dois juntos, embora o
  // reposicionamento de verdade só aconteça no backend ao soltar.
  peerDrag?: { entryId: string; x: number; y: number } | null;
}

export function ScheduleTimeline({
  day,
  conflicts,
  onRemoveEntry,
  onAddResource,
  onEditResource,
  peerDrag = null,
}: ScheduleTimelineProps) {
  const times = computeResourceTimes(day.resources, day.startMinutes);
  const sortedResources = [...day.resources].sort((a, b) => a.order - b.order);
  const totalWidth = (day.endMinutes - day.startMinutes) * SCHEDULE_PX_PER_MINUTE;
  // Grade de 5 em 5 minutos, com rótulo em cada marca — o zoom
  // (SCHEDULE_PX_PER_MINUTE) já dá espaço suficiente pro texto.
  const ticks: number[] = [];
  for (let m = day.startMinutes; m <= day.endMinutes; m += 5) ticks.push(m);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-border/60 bg-card">
      <div className="flex flex-1 flex-col" style={{ width: totalWidth + 144 }}>
        <div className="flex shrink-0 border-b border-border/60">
          <div className="sticky left-0 z-20 w-36 shrink-0 border-r border-border/40 bg-card" />
          <div className="relative h-8 shrink-0" style={{ width: totalWidth }}>
            {ticks.map((m) => {
              const isHour = m % 60 === 0;
              return (
                <div
                  key={m}
                  style={{ left: (m - day.startMinutes) * SCHEDULE_PX_PER_MINUTE }}
                  className="absolute top-0 bottom-0"
                >
                  <div
                    className={cn("absolute bottom-0 w-px bg-border", isHour ? "h-2.5" : "h-1.5")}
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs",
                      isHour ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {formatMinutes(m)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {sortedResources.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            roleLabel={getResourceRoleLabel(resource, day.resources)}
            day={day}
            times={times}
            conflicts={conflicts}
            onRemoveEntry={onRemoveEntry}
            onEditResource={onEditResource}
            peerDrag={peerDrag}
          />
        ))}

        <AddResourceRow totalWidth={totalWidth} onClick={onAddResource} />
      </div>
    </div>
  );
}
