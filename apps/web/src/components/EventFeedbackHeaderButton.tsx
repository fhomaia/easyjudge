import { Heart } from "lucide-react";
import { canRateEvent, useEventFeedbackStore } from "@/store/eventFeedback";
import type { Event } from "@/api/client";

// Coração ao lado do sininho no cabeçalho mobile do evento ao vivo:
// abre a avaliação do evento (ver EventFeedbackHost). Não aparece pra
// quem organiza ou com o evento ainda em rascunho.
export function EventFeedbackHeaderButton({ event }: { event: Event }) {
  const open = useEventFeedbackStore((s) => s.open);
  if (!canRateEvent(event)) return null;
  return (
    <button
      type="button"
      aria-label="Avaliar evento"
      title="Avaliar evento"
      onClick={() => open(event)}
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Heart className="size-5" />
    </button>
  );
}
