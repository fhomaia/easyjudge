import { History, Pencil, QrCode, Send, Trash2, Undo2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Event } from "@/api/client";

interface EventActionsMenuProps {
  event: Event;
  isAdmin: boolean;
  isAssessor: boolean;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
  onViewHistory: (event: Event) => void;
  onTogglePublish: (event: Event) => void;
  onShare: (event: Event) => void;
}

// Reaproveitado por EventListItem/EventGridItem — antes cada um tinha
// só lápis+lixeira soltos (admin-only). O lápis virou este menu de "⋯"
// (2026-07-26, a pedido do usuário) pra caber "Histórico" (2026-07-26:
// virou tela própria, ver EventHistoryPage — assessor também vê essa
// opção, é o único item do menu que não é admin-only) e publicar/
// reverter publicação (mesma dinâmica já usada no dropdown "Mais
// opções" da tela Início, ver EventLiveDesktopView). Lixeira continua
// separada, fora do menu, admin-only.
export function EventActionsMenu({
  event,
  isAdmin,
  isAssessor,
  onEdit,
  onDelete,
  onViewHistory,
  onTogglePublish,
  onShare,
}: EventActionsMenuProps) {
  if (!isAdmin && !isAssessor) return null;

  const canTogglePublish =
    isAdmin && (event.status === "created" || event.status === "published");
  const canShare = isAdmin && event.status !== "created";

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Mais opções"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            />
          }
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isAdmin && (
            <DropdownMenuItem onClick={() => onEdit(event)}>
              <Pencil data-icon="inline-start" />
              Editar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onViewHistory(event)}>
            <History data-icon="inline-start" />
            Histórico
          </DropdownMenuItem>
          {canTogglePublish && (
            <DropdownMenuItem onClick={() => onTogglePublish(event)}>
              {event.status === "published" ? (
                <Undo2 data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              {event.status === "published" ? "Reverter publicação" : "Publicar"}
            </DropdownMenuItem>
          )}
          {canShare && (
            <DropdownMenuItem onClick={() => onShare(event)}>
              <QrCode data-icon="inline-start" />
              Compartilhar evento
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isAdmin && (
        <button
          type="button"
          onClick={() => onDelete(event)}
          aria-label="Excluir evento"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
