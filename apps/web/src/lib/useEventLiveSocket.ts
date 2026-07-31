import { useEffect, useRef } from "react";
import { createEventSocket } from "@/lib/socket";

export interface NotificationCreatedPayload {
  aliasId: string;
  id: string;
  type: string;
  audience: string;
  title: string;
  scheduleEntryId: string | null;
}

export interface EventStatusChangedPayload {
  aliasId: string;
  status: string;
}

// Cadência do `setInterval` de fallback nas páginas que consomem este
// hook — rede de segurança pra reconexão de socket falhando
// silenciosamente, não o mecanismo principal (esse é o WebSocket).
// Bem mais espaçado que os antigos 30s de puro polling.
export const REALTIME_FALLBACK_POLL_MS = 120_000;

interface EventLiveSocketHandlers {
  onNotification?: (payload: NotificationCreatedPayload) => void;
  onEventStatusChanged?: (payload: EventStatusChangedPayload) => void;
}

// Só avisa "algo mudou" (ver EventsGateway no backend) — quem recebe o
// sinal decide o que refazer (mesmo GET que o polling antigo já
// fazia). Nunca usado pelo fluxo de lançamento de nota em si (isso
// continua só POST HTTP + buffer IndexedDB).
//
// Handlers passados por ref (não entram no array de dependências do
// effect) — permite os componentes chamadores passarem funções novas a
// cada render (closures sobre o estado deles) sem isso reconectar o
// socket a cada re-render.
export function useEventLiveSocket(
  aliasId: string | null | undefined,
  handlers: EventLiveSocketHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!aliasId) return;

    const socket = createEventSocket();
    if (!socket) return;

    socket.on("connect", () => {
      socket.emit("join", { aliasId });
    });
    socket.on("notification.created", (payload: NotificationCreatedPayload) => {
      handlersRef.current.onNotification?.(payload);
    });
    socket.on("event.status_changed", (payload: EventStatusChangedPayload) => {
      handlersRef.current.onEventStatusChanged?.(payload);
    });

    return () => {
      socket.emit("leave", { aliasId });
      socket.close();
    };
  }, [aliasId]);
}
