import { cn } from "@/lib/utils";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import type { Event } from "@/api/client";

function BlinkingDot({ colorClassName }: { colorClassName: string }) {
  return (
    <span className="relative flex size-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          colorClassName,
        )}
      />
      <span className={cn("relative inline-flex size-2 rounded-full", colorClassName)} />
    </span>
  );
}

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
