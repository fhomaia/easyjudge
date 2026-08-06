import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatarColor";
import { Checkbox } from "@/components/ui/checkbox";
import type { UnscheduledPair } from "@/api/client";

export function UnscheduledItemCard({ pair }: { pair: UnscheduledPair }) {
  return (
    <>
      <span
        style={{ backgroundColor: getAvatarColor(pair.teamId) }}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      >
        {pair.teamName.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{pair.teamName}</p>
        <p className="truncate text-xs text-muted-foreground">{pair.categoryName}</p>
      </div>
    </>
  );
}

function UnscheduledItem({
  pair,
  onClick,
}: {
  pair: UnscheduledPair;
  onClick: (pair: UnscheduledPair) => void;
}) {
  const id = `unscheduled:${pair.teamId}:${pair.categoryId}`;
  // `data` carrega o par pro DragOverlay (ver SchedulePage) desenhar
  // uma prévia igual a este card sem precisar rebuscá-lo pelo id — o
  // DragOverlay renderiza num portal (document.body), imune ao
  // `overflow-y-auto` da lista abaixo. Sem `transform`/movimento no
  // elemento original de propósito (bug real 2026-08-05: a versão
  // anterior movia o próprio card via CSS, que continuava clipado pela
  // lista com scroll — some assim que o dedo cruza a borda dela); o
  // original só esmaece (`opacity-50`), o DragOverlay é quem se move.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: "unscheduled", pair },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // onClick coexiste com o drag: o PointerSensor do dnd-kit (ver
      // SchedulePage) só ativa o arraste depois de `distance: 5`px de
      // movimento — um clique de verdade (sem arrastar) nunca cruza esse
      // limiar, então o evento de clique chega normalmente. Alternativa
      // ao drag-and-drop pra quando a pista de destino não está visível
      // sem rolar a tela (pedido do usuário 2026-08-06).
      onClick={() => onClick(pair)}
      className={cn(
        // touch-none: sem isso, o navegador trata o toque inicial como
        // scroll da lista (que já é `overflow-y-auto`) em vez de
        // iniciar o arraste do dnd-kit — mesma classe que ScheduleEntryCard
        // já usa pros cards dentro da timeline (por isso funcionava lá e
        // não aqui).
        "flex touch-none cursor-grab items-center gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-sm transition-colors hover:border-primary/50 active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <UnscheduledItemCard pair={pair} />
    </div>
  );
}

interface UnscheduledTeamsPanelProps {
  pairs: UnscheduledPair[];
  ignoreUnscheduled: boolean;
  onToggleIgnoreUnscheduled: (value: boolean) => void;
  onSelectPair: (pair: UnscheduledPair) => void;
}

export function UnscheduledTeamsPanel({
  pairs,
  ignoreUnscheduled,
  onToggleIgnoreUnscheduled,
  onSelectPair,
}: UnscheduledTeamsPanelProps) {
  const [query, setQuery] = useState("");
  const filtered = pairs.filter((p) =>
    `${p.teamName} ${p.categoryName}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Equipes não agendadas neste dia</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {pairs.length}
        </span>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Arraste até uma pista ou clique numa equipe para escolher a posição.
      </p>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={ignoreUnscheduled}
          onCheckedChange={(value) => onToggleIgnoreUnscheduled(value === true)}
          className="mt-0.5"
        />
        <span>Ignorar apresentações não agendadas</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar equipe..."
          className="w-full rounded-md border border-border/60 bg-background py-1.5 pl-8 pr-2 text-sm text-foreground outline-none focus-visible:border-primary"
        />
      </div>
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {pairs.length === 0
              ? "Todas as apresentações deste dia já foram agendadas."
              : "Nenhuma equipe encontrada."}
          </p>
        )}
        {filtered.map((pair) => (
          <UnscheduledItem
            key={`${pair.teamId}:${pair.categoryId}`}
            pair={pair}
            onClick={onSelectPair}
          />
        ))}
      </div>
    </div>
  );
}
