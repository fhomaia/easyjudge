import { BlinkingDot } from "@/components/BlinkingDot";
import { isEventDay } from "@/lib/eventDates";
import type { Event } from "@/api/client";

interface EventLifecycleActionProps {
  event: Event;
  onStart: () => void;
  starting: boolean;
}

// Publicar/Concluir saíram daqui (2026-07-27, a pedido do usuário) —
// continuam acessíveis pelo menu "⋯" (ver EventActionsMenu, publicar/
// reverter) e pela tela "Início" do evento ao vivo (concluir, ver
// EventLiveDesktopView/EventLiveDashboardPage), só não mais como botão
// solto na listagem. "Iniciar evento" continua aqui de propósito — é a
// única ação de ciclo de vida que o usuário pediu pra manter na lista.
export function EventLifecycleAction({ event, onStart, starting }: EventLifecycleActionProps) {
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

  return null;
}
