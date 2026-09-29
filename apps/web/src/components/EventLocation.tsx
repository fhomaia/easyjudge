import { Building2, MapPin } from "lucide-react";
import type { Event } from "@/api/client";

// Endereço do evento (quando houver) e cidade/UF na mesma linha
// ("Av. Amazonas, 6200 · Belo Horizonte, MG"). O endereço é link pro
// Google Maps (busca por nome do local + endereço + cidade, pra achar
// mesmo com endereço incompleto); o clique nele não abre o evento do
// card. Nome do local (quando houver) logo depois, com ícone de prédio.
export function EventLocation({ event }: { event: Event }) {
  const query = [event.venue, event.address, event.location].filter(Boolean).join(", ");
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">
          {event.address && (
            <>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-foreground hover:underline"
              >
                {event.address}
              </a>
              {" · "}
            </>
          )}
          {event.location}
        </span>
      </span>
      {event.venue && (
        <span className="flex min-w-0 items-center gap-1.5">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{event.venue}</span>
        </span>
      )}
    </>
  );
}
