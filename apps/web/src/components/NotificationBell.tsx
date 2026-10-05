import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  NOTIFICATION_ICONS,
  formatNotificationRelativeTime,
  notificationHref,
} from "@/lib/notificationDisplay";
import { useNotificationsUnreadStore } from "@/store/notificationsUnread";
import { notificationsApi, type NotificationView } from "@/api/client";

interface NotificationBellProps {
  // Contagem de não lidas do evento em foco na tela — undefined nas
  // telas sem um evento específico em contexto (Home, biblioteca de
  // sistemas de pontuação), onde não faz sentido nenhum indicador. Sem
  // badge quando 0/undefined.
  unreadCount?: number;
}

// Nas telas de um evento (rota com :id), o sino abre as notificações
// dele num popup e marca como lidas (2026-10-05: antes não fazia nada).
export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const refreshUnread = useNotificationsUnreadStore((s) => s.refresh);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [seen, setSeen] = useState(false);
  const shownCount = seen ? 0 : unreadCount;

  useEffect(() => {
    if (!open || !id) return;
    notificationsApi
      .list(id)
      .then((res) => setItems(res.notifications))
      .catch(() => setItems([]));
    notificationsApi
      .markSeen(id)
      .then(() => {
        setSeen(true);
        void refreshUnread(true);
      })
      .catch(() => {});
  }, [open, id, refreshUnread]);

  const badge = !!shownCount && (
    <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
      {shownCount > 9 ? "9+" : shownCount}
    </span>
  );

  if (!id) {
    return (
      <div className="relative text-muted-foreground" title="Notificações">
        <Bell className="size-5" />
        {badge}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="Notificações"
        className="relative rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {badge}
      </PopoverTrigger>
      <PopoverContent align="end" className="grid max-h-[70dvh] w-80 gap-1 overflow-y-auto p-2">
        <p className="px-2 pt-1 pb-2 text-sm font-semibold text-foreground">Notificações</p>
        {items === null ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
        ) : (
          items.map((n) => {
            const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
            const href = notificationHref(id, [], n);
            return (
              <button
                key={n.id}
                type="button"
                disabled={!href}
                onClick={() => {
                  if (!href) return;
                  setOpen(false);
                  navigate(href);
                }}
                className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors enabled:hover:bg-muted"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatNotificationRelativeTime(n.createdAt)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
