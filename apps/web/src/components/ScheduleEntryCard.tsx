import { useDraggable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_TYPE_STYLES,
  getScheduleEntryDisplay,
  isAutoWaitBreak,
} from "@/lib/scheduleEntryDisplay";
import type { ScheduleEntry } from "@/api/client";

interface ScheduleEntryCardProps {
  entry: ScheduleEntry;
  startMinutes: number;
  endMinutes: number;
  left: number;
  width: number;
  // Até onde o rótulo pode se estender além do próprio card (distância
  // livre até o próximo item da mesma linha) — ver ScheduleTimeline.
  labelMaxWidth: number;
  // Vazio = sem conflito. Os motivos (ver lib/scheduleConflicts) entram
  // no tooltip além de acender o destaque vermelho — só a cor não dizia
  // qual conflito era.
  conflictReasons: string[];
  onRemove: () => void;
  // Setado quando ESTE card não é o que o usuário está arrastando,
  // mas sim o aquecimento vinculado à apresentação que está sendo
  // arrastada — espelha o deslocamento do drag ativo (ver
  // SchedulePage), fazendo os dois "andarem juntos" visualmente
  // mesmo estando em linhas diferentes da timeline. O reposicionamento
  // de verdade quem faz é o backend (moveEntry), isso aqui é só o
  // feedback visual durante o arrasto.
  peerDrag?: { x: number; y: number } | null;
}

export function ScheduleEntryCard({
  entry,
  startMinutes,
  endMinutes,
  left,
  width,
  labelMaxWidth,
  conflictReasons,
  onRemove,
  peerDrag,
}: ScheduleEntryCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
  });
  const style = SCHEDULE_TYPE_STYLES[entry.type];
  const hasConflict = conflictReasons.length > 0;
  const isWaitBreak = isAutoWaitBreak(entry);
  const { title, subtitle, timeRange, tooltip } = getScheduleEntryDisplay(
    entry,
    startMinutes,
    endMinutes,
    conflictReasons,
  );
  const effectiveTransform = transform ?? (peerDrag ? { x: peerDrag.x, y: peerDrag.y } : null);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        position: "absolute",
        left,
        width: Math.max(width, 32),
        top: 6,
        bottom: 6,
        transform: effectiveTransform
          ? `translate3d(${effectiveTransform.x}px, ${effectiveTransform.y}px, 0)`
          : undefined,
        zIndex: isDragging || peerDrag ? 50 : 10,
      }}
      className={cn(
        "group flex cursor-grab flex-col justify-center overflow-visible rounded-md border px-2 py-1 text-xs shadow-sm transition-opacity active:cursor-grabbing",
        style.bg,
        style.border,
        style.text,
        hasConflict && "border-destructive bg-destructive/15 text-destructive",
        (isDragging || peerDrag) && "opacity-60",
      )}
      title={tooltip}
    >
      {!isWaitBreak && (
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
      )}
      {/* Como apresentações costumam durar bem menos que o espaço
          confortável de leitura, o rótulo pode "vazar" pra fora do
          card — mas só até `labelMaxWidth` (a distância livre real até
          o próximo item da linha), nunca além disso: o fundo dos cards
          é translúcido, então deixar vazar sem limite faz o texto se
          misturar com o do próximo bloco em vez de ficar escondido
          atrás dele. Passado esse limite, trunca com reticências — o
          nome completo sempre fica disponível no tooltip. */}
      <div style={{ maxWidth: labelMaxWidth }} className="overflow-hidden">
        <p className="truncate pr-3 font-medium">{title}</p>
        {subtitle && <p className="truncate pr-3 opacity-80">{subtitle}</p>}
        <p className="truncate pr-3 opacity-70">{timeRange}</p>
      </div>
    </div>
  );
}
