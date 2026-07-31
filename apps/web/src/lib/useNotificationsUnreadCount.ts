import { useEffect, useState } from "react";
import { notificationsApi } from "@/api/client";

// Só pro badge do NotificationBell nas telas de setup do evento
// (não-live) — busca uma vez no mount, sem polling/WebSocket (essas
// telas não têm nenhum mecanismo de atualização automática hoje, não
// vale introduzir um só pra isso). `eventId` undefined (telas sem um
// evento específico em contexto, ex. Home, biblioteca de sistemas de
// pontuação) não busca nada, o badge fica sem número.
export function useNotificationsUnreadCount(eventId: string | undefined): number | undefined {
  const [count, setCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!eventId) return;
    notificationsApi
      .list(eventId)
      .then((res) => setCount(res.unreadCount))
      .catch(() => setCount(undefined));
  }, [eventId]);

  return count;
}
