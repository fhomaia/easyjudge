import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Flag, Music, Plus, Trophy, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomIntervalDialog } from "@/components/CustomIntervalDialog";
import { AddComponentEntryDialog } from "@/components/AddComponentEntryDialog";
import type { ScheduleDay, ScheduleEntry } from "@/api/client";

export interface ComponentBlockDef {
  type: "break" | "ceremony" | "award";
  label: string;
  durationMinutes: number;
  icon: LucideIcon;
  colorClass: string;
}

const COMPONENT_BLOCKS: ComponentBlockDef[] = [
  { type: "break", label: "Almoço", durationMinutes: 60, icon: UtensilsCrossed, colorClass: "text-orange-600" },
  { type: "break", label: "Contestação de notas", durationMinutes: 30, icon: Flag, colorClass: "text-orange-600" },
  { type: "ceremony", label: "Abertura", durationMinutes: 30, icon: Music, colorClass: "text-purple-600" },
  { type: "award", label: "Premiação", durationMinutes: 30, icon: Trophy, colorClass: "text-teal-600" },
];

// id codifica "component:<type>:<duração>:<label>" — consumido em
// SchedulePage.handleDragEnd, que agora usa a duração daqui em vez de
// cair sempre no default genérico do backend (15 min, mesmo pro
// Almoço).
export function ComponentBlockCard({ def }: { def: ComponentBlockDef }) {
  const Icon = def.icon;
  return (
    <>
      <Icon className={cn("size-4 shrink-0", def.colorClass)} />
      <span className="flex-1 font-medium text-foreground">{def.label}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{def.durationMinutes} min</span>
    </>
  );
}

function ComponentBlock({
  def,
  onClick,
}: {
  def: ComponentBlockDef;
  onClick: (def: ComponentBlockDef) => void;
}) {
  const id = `component:${def.type}:${def.durationMinutes}:${def.label}`;
  // Sem `transform` no elemento original de propósito — mesmo motivo de
  // UnscheduledTeamsPanel (bug real 2026-08-05): esta lista não tem
  // scroll próprio, mas o painel lateral que a contém tem, então o card
  // ainda sumia ao cruzar essa borda. O DragOverlay (ver SchedulePage),
  // renderizado num portal, não sofre disso.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: "component", def },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // onClick coexiste com o drag: o PointerSensor do dnd-kit (ver
      // SchedulePage) só ativa o arraste depois de `distance: 5`px de
      // movimento, então um clique de verdade chega normalmente (mesmo
      // padrão de UnscheduledTeamsPanel) — alternativa ao
      // drag-and-drop pra quando a pista de destino não está visível
      // sem rolar a tela (pedido do usuário 2026-08-06).
      onClick={() => onClick(def)}
      className={cn(
        // touch-none: mesmo raciocínio de UnscheduledTeamsPanel — sem
        // isso o navegador intercepta o toque inicial como scroll em
        // vez de deixar o dnd-kit iniciar o arraste.
        "flex touch-none cursor-grab items-center gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-sm transition-colors hover:border-primary/50 active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <ComponentBlockCard def={def} />
    </div>
  );
}

interface EventComponentsLibraryProps {
  eventId: string;
  day: ScheduleDay;
  onCreated: (createdEntries: ScheduleEntry[]) => void;
}

export function EventComponentsLibrary({ eventId, day, onCreated }: EventComponentsLibraryProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [addingDef, setAddingDef] = useState<ComponentBlockDef | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Componentes do evento</h3>
        <p className="text-xs text-muted-foreground">
          Arraste até uma pista ou clique num componente para escolher a posição.
        </p>
        <div className="flex flex-col gap-2">
          {COMPONENT_BLOCKS.map((def) => (
            <ComponentBlock key={`${def.type}:${def.label}`} def={def} onClick={setAddingDef} />
          ))}

          {/* Diferente dos outros — pede nome/duração antes de criar,
              então não dá pra soltar direto num recurso (não há como
              coletar esses dados no meio de um drag). Clicar abre um
              popup em vez de arrastar. */}
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="size-4 shrink-0" />
            <span className="font-medium">Intervalo personalizado</span>
          </button>
        </div>
      </div>

      <CustomIntervalDialog
        eventId={eventId}
        day={day}
        open={customOpen}
        onOpenChange={setCustomOpen}
        onCreated={onCreated}
      />

      <AddComponentEntryDialog
        eventId={eventId}
        day={day}
        def={addingDef}
        onOpenChange={(open) => !open && setAddingDef(null)}
        onCreated={onCreated}
      />
    </>
  );
}
