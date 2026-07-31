import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { EventActionsMenu } from "@/components/EventActionsMenu";
import { EventLifecycleAction } from "@/components/EventLifecycleAction";
import { EventStatusIndicator } from "@/components/EventStatusArea";
import { EventThumbnail } from "@/components/EventThumbnail";
import { formatDate } from "@/lib/formatDate";
import { listItemVariants } from "@/lib/motionVariants";
import { cn } from "@/lib/utils";
import type { Event } from "@/api/client";

interface EventListItemProps {
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

export function EventListItem({
  event,
  starting,
  onStart,
  onEdit,
  onDelete,
  onViewHistory,
  onTogglePublish,
  onShare,
  onOpenLive,
}: EventListItemProps) {
  const isAdmin = event.currentUserRole === "admin";
  const isAssessor = event.currentUserRole === "assessor";
  const navigate = useNavigate();
  const isConfigurable = event.status === "created";
  const isLive = event.status === "published" || event.status === "started";
  const isClickable = isConfigurable || isLive;

  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ y: -2 }}
      onClick={
        isConfigurable
          ? () => navigate(`/events/${event.aliasId}/setup`)
          : isLive
            ? () => onOpenLive(event)
            : undefined
      }
      className={cn(
        "flex items-center gap-5 rounded-lg border border-border/60 bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-md",
        isClickable && "cursor-pointer",
      )}
    >
      <EventThumbnail
        name={event.name}
        logoUrl={event.logoUrl}
        className="size-20 rounded-xl text-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{event.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(event.startDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {event.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {event.categoriesCount ?? 0} categorias · {event.programsCount ?? 0} programas
          </span>
        </div>
      </div>

      <EventStatusIndicator event={event} />

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <EventLifecycleAction event={event} starting={starting} onStart={() => onStart(event)} />

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
    </motion.div>
  );
}
