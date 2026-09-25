import { useEffect, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { eventsApi, type EventMemberRole, type NotificationType } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { useEventLiveSocket } from "@/lib/useEventLiveSocket";
import { hasEventStaffRole } from "@/lib/eventMemberRoles";
import { NOTIFICATION_ICONS, notificationHref } from "@/lib/notificationDisplay";

const TOAST_DURATION_MS = 6000;
const MAX_TOASTS = 3;

interface Toast {
  id: string;
  type: NotificationType;
  title: string;
  href: string | null;
}

// Balão que aparece quando chega uma notificação do evento aberto no
// painel "evento ao vivo" (qualquer subpágina `/events/:id/live/...`).
// Montado uma vez em App.tsx, então a conexão não cai ao trocar de aba
// dentro do mesmo evento. Só mostra pra quem recebe a notificação: o
// socket entrega todo sinal da sala, então o público STAFF é filtrado
// aqui com os papéis do usuário no evento (mesma regra de
// NotificationsService.audiencesForMember).
export function EventNotificationToaster() {
  const match = useMatch("/events/:id/live/*");
  const aliasId = match?.params.id;
  const location = useLocation();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [roles, setRoles] = useState<EventMemberRole[] | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setRoles(null);
    setToasts([]);
    if (!aliasId || !accessToken) return;
    let cancelled = false;
    eventsApi
      .get(aliasId)
      .then((event) => {
        if (!cancelled) setRoles(event.currentUserRoles);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [aliasId, accessToken]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  function dismiss(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEventLiveSocket(roles ? aliasId : null, {
    onNotification: (payload) => {
      if (!aliasId || !roles) return;
      if (payload.audience === "staff" && !hasEventStaffRole(roles)) return;
      // Na própria tela de notificações a lista já atualiza sozinha.
      if (location.pathname.endsWith("/live/notifications")) return;
      // Quem está na súmula da apresentação em questão acabou de causar
      // (ou já está vendo) o que a notificação conta.
      const scoringMatch = location.pathname.match(/\/live\/scoring\/([^/]+)/);
      if (scoringMatch && payload.scheduleEntryId === scoringMatch[1]) return;

      const type = payload.type as NotificationType;
      const toast: Toast = {
        id: payload.id,
        type,
        title: payload.title,
        href: notificationHref(aliasId, roles, {
          id: payload.id,
          type,
          title: payload.title,
          scheduleEntryId: payload.scheduleEntryId,
          createdAt: new Date().toISOString(),
        }),
      };
      setToasts((prev) => {
        if (prev.some((t) => t.id === toast.id)) return prev;
        const next = [...prev, toast];
        next.slice(0, Math.max(0, next.length - MAX_TOASTS)).forEach((old) => {
          const timer = timers.current.get(old.id);
          if (timer) clearTimeout(timer);
          timers.current.delete(old.id);
        });
        return next.slice(-MAX_TOASTS);
      });
      timers.current.set(
        toast.id,
        setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS),
      );
    },
  });

  if (!aliasId) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:items-end sm:pr-6"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = NOTIFICATION_ICONS[toast.type] ?? Bell;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-primary/25 border-l-4 border-l-primary bg-card p-3 shadow-xl ring-1 ring-black/5"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => {
                  dismiss(toast.id);
                  navigate(toast.href ?? `/events/${aliasId}/live/notifications`);
                }}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-primary">Nova notificação</span>
                  <span className="block text-sm font-medium leading-snug">{toast.title}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Fechar"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => dismiss(toast.id)}
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
