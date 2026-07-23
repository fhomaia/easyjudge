import { BlinkingDot } from "@/components/BlinkingDot";
import { isEventDay } from "@/lib/eventDates";
import type { Event } from "@/api/client";

interface EventLifecycleActionProps {
  event: Event;
  onStart: () => void;
  starting: boolean;
  onPublish: () => void;
  publishing: boolean;
}

export function EventLifecycleAction({
  event,
  onStart,
  starting,
  onPublish,
  publishing,
}: EventLifecycleActionProps) {
  const canStart =
    event.currentUserRole === "admin" && event.status === "published" && isEventDay(event);

  if (canStart) {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <BlinkingDot colorClassName="bg-emerald-500" />
        {starting ? "Iniciando..." : "Iniciar evento"}
      </button>
    );
  }

  const canPublish = event.currentUserRole === "admin" && event.status === "created";

  if (canPublish) {
    return (
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing}
        className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
      >
        {publishing ? "Publicando..." : "Publicar evento"}
      </button>
    );
  }

  return null;
}
