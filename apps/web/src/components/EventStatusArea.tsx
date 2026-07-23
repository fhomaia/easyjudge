import { BlinkingDot } from "@/components/BlinkingDot";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import type { Event } from "@/api/client";

export function EventStatusIndicator({ event }: { event: Event }) {
  if (event.status === "started") {
    return (
      <span className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
        <BlinkingDot colorClassName="bg-red-500" />
        Ao vivo
      </span>
    );
  }

  return <EventStatusBadge status={event.status} />;
}
