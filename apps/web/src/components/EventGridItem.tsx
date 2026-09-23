import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { EventActionsMenu } from "@/components/EventActionsMenu";
import { EventLifecycleAction } from "@/components/EventLifecycleAction";
import { EventStatusIndicator } from "@/components/EventStatusArea";
import { EventThumbnail } from "@/components/EventThumbnail";
import { formatDate } from "@/lib/formatDate";
import { listItemVariants } from "@/lib/motionVariants";
import { hasEventStaffRole } from "@/lib/eventMemberRoles";
import { cn } from "@/lib/utils";
import type { Event } from "@/api/client";

interface EventGridItemProps {
  event: Event;
  starting: boolean;
  onStart: (event: Event) => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
  onViewHistory: (event: Event) => void;
  onTogglePublish: (event: Event) => void;
  onShare: (event: Event) => void;
  // Publicado/iniciado abre a tela "ao vivo" com a animação de raio
  // primeiro (ver HomePage.handleOpenLive) — por isso não navega direto
  // daqui como "created" (setup) continua fazendo.
  onOpenLive: (event: Event) => void;
}

export function EventGridItem({
  event,
  starting,
  onStart,
  onEdit,
  onDelete,
  onViewHistory,
  onTogglePublish,
  onShare,
  onOpenLive,
}: EventGridItemProps) {
  const isAdmin = event.currentUserRole === "admin";
  const isAssessor = event.currentUserRole === "assessor";
  const canManage = isAdmin || isAssessor;
  const isStaffViewer = hasEventStaffRole(event.currentUserRoles);
  const navigate = useNavigate();
  const isConfigurable = event.status === "created";
  const isLive = event.status === "published" || event.status === "started";
  // Evento "criado" agora aparece na Home pra QUALQUER vínculo (não só
  // staff, ver EventsService.findAllForUser, 2026-09-23) — mas só
  // admin/assessor/judge conseguem de fato abrir antes de publicar
  // (EventMemberGuard bloqueia o resto). Pra quem não é staff, o card
  // fica só informativo ("Em breve", ver EventStatusIndicator).
  const isClickable = (isConfigurable && isStaffViewer) || isLive;

  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ y: -2 }}
      onClick={
        isConfigurable && isStaffViewer
          ? canManage
            ? () => navigate(`/events/${event.aliasId}/setup`)
            // Jurado não edita configuração nenhuma — vai direto pro
            // evento em si, não pro setup (pedido do usuário, 2026-09-22).
            : () => onOpenLive(event)
          : isLive
            ? () => onOpenLive(event)
            : undefined
      }
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md",
        isClickable && "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <EventThumbnail name={event.name} logoUrl={event.logoUrl} className="size-14 text-base" />
        {(isAdmin || isAssessor) && (
          <div onClick={(e) => e.stopPropagation()}>
            <EventActionsMenu
              event={event}
              isAdmin={isAdmin}
              isAssessor={isAssessor}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewHistory={onViewHistory}
              onTogglePublish={onTogglePublish}
              onShare={onShare}
            />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{event.name}</p>
        <div className="mt-1.5 flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" />
            {formatDate(event.startDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" />
            {event.categoriesCount ?? 0} categorias · {event.programsCount ?? 0} programas
          </span>
        </div>
      </div>

      <div
        className="mt-auto flex flex-wrap items-center gap-2 pt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <EventStatusIndicator event={event} />
        <EventLifecycleAction event={event} starting={starting} onStart={() => onStart(event)} />
      </div>
    </motion.div>
  );
}
