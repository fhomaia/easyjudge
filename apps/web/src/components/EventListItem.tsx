import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Pencil, Trash2, Users } from "lucide-react";
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
  publishing: boolean;
  onPublish: (event: Event) => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

export function EventListItem({
  event,
  starting,
  onStart,
  publishing,
  onPublish,
  onEdit,
  onDelete,
}: EventListItemProps) {
  const isAdmin = event.currentUserRole === "admin";
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
          ? () => navigate(`/events/${event.id}/setup`)
          : isLive
            ? () => navigate(`/events/${event.id}/live`)
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
        <EventLifecycleAction
          event={event}
          starting={starting}
          onStart={() => onStart(event)}
          publishing={publishing}
          onPublish={() => onPublish(event)}
        />

        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(event)}
              aria-label="Editar evento"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(event)}
              aria-label="Excluir evento"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
