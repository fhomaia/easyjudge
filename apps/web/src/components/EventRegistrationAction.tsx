import { ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { EventUnreadBadge } from "@/components/EventUnreadBadge";
import { formatDeadline, isRegistrationOpen } from "@/lib/registrationWindow";
import type { Event } from "@/api/client";

// Botão da inscrição no card da Home, só pra conta Programa (2026-10-05):
// "Inscreva-se aqui" enquanto aberta; quem já se inscreveu vê "Minha
// inscrição" (edita até o prazo, depois só consulta).
// Card mostra o botão da inscrição no lugar do selo de status ("Em
// breve") quando isto é true (pedido do usuário, 2026-10-05).
export function showsRegistrationAction(event: Event, accountRole: string | null): boolean {
  if (accountRole !== "program") return false;
  const registered = event.currentUserRoles.includes("program");
  const beforeStart = event.status === "created" || event.status === "published";
  return isRegistrationOpen(event) || (registered && beforeStart);
}

export function EventRegistrationAction({
  event,
  onOpen,
}: {
  event: Event;
  // Quem chama pode tocar uma animação antes de navegar (Home: raio).
  onOpen?: (event: Event) => void;
}) {
  const navigate = useNavigate();
  const accountRole = useAuthStore((s) => s.role);
  if (!showsRegistrationAction(event, accountRole)) return null;

  const registered = event.currentUserRoles.includes("program");
  const open = isRegistrationOpen(event);

  return (
    <button
      type="button"
      onClick={() =>
        onOpen ? onOpen(event) : navigate(`/events/${event.aliasId}/registration`)
      }
      className={
        registered
          ? "relative flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          : // Mesmo degradê do "Ir para agora" do jurado.
            "relative flex items-center gap-1.5 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 px-3 py-1 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
      }
      title={
        open && event.registrationDeadline
          ? `Inscrições até ${formatDeadline(event.registrationDeadline)}`
          : undefined
      }
    >
      <ClipboardList className="size-3.5" />
      {registered ? "Minha inscrição" : "Inscreva-se aqui!"}
      <EventUnreadBadge aliasId={event.aliasId} className="bg-amber-500 text-white" />
    </button>
  );
}
