import { History, Pencil, QrCode, Send, Settings, Trash2, Undo2, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth";
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
// separada, fora do menu — restrita a quem CRIOU o evento (mais
// estrito que admin-only, ver `isOwner` abaixo).
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
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  // Excluir é mais restrito que os outros itens deste menu (admin-only):
  // qualquer admin pode editar/publicar/gerenciar o evento, mas só QUEM
  // CRIOU pode apagá-lo pra sempre — mesmo um admin adicionado depois
  // pelo dono (ver event-staff) não vê essa opção. Pedido do usuário,
  // 2026-09-22.
  const isOwner = event.createdById === userId;

  if (!isAdmin && !isAssessor) return null;

  // Mesmo destino do clique no card de um evento em "Criado" (ver
  // EventListItem/EventGridItem) — aqui com nome explícito, pra não
  // confundir com "Dados do evento" (popup de nome/data/local/foto).
  const canConfigure = event.status === "created";

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
          {canConfigure && (
            <DropdownMenuItem
              onClick={() => navigate(`/events/${event.aliasId}/setup`)}
            >
              <Settings data-icon="inline-start" />
              Configurar evento
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem onClick={() => onEdit(event)}>
              <Pencil data-icon="inline-start" />
              Dados do evento
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
      {isOwner && (
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
