import { Navigation } from "lucide-react";
import type { Event } from "@/api/client";
import { cn } from "@/lib/utils";

// Endereço do evento como link pro Google Maps (busca por nome do local
// + endereço + cidade, pra achar mesmo com endereço incompleto). Nada
// quando o evento não tem endereço.
export function EventAddressLink({ event, className }: { event: Event; className?: string }) {
  if (!event.address) return null;
  const query = [event.venue, event.address, event.location].filter(Boolean).join(", ");
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex min-w-0 items-center gap-1.5 hover:text-foreground hover:underline", className)}
    >
      <Navigation className="size-4 shrink-0" />
      <span className="truncate">{event.address}</span>
    </a>
  );
}
