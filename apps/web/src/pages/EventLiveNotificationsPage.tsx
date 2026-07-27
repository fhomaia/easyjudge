import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bell, Building2, CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { EventLiveBottomNav, buildEventNavTabs } from "@/components/EventLiveShared";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { resolveCenterTab, resolveNotesHref } from "@/lib/eventNavPriority";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { NOTIFICATION_ICONS, formatNotificationRelativeTime, notificationHref } from "@/lib/notificationDisplay";
import { eventsApi, notificationsApi, usersApi, type Event, type NotificationView, type UserProfile } from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function EventLiveNotificationsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [notifications, setNotifications] = useState<NotificationView[] | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    notificationsApi
      .list(id)
      .then((res) => setNotifications(res.notifications))
      .catch(() => setNotifications([]));
    // Visitar a tela inteira conta como "visto" — mesmo raciocínio de
    // abrir o sino/popup, só que aqui é a própria tela.
    notificationsApi.markSeen(id).catch(() => {});
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!event) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const eventNavTabs = buildEventNavTabs({
    current: "notificacoes",
    onNavigateHome: () => navigate(`/events/${event.id}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.id}/live/schedule`),
    onNavigateNotes: () => navigate(resolveNotesHref(event.id, event.currentUserRoles)),
    onNavigateResults: () => navigate(`/events/${event.id}/live/results`),
    onNavigateNotifications: () => navigate(`/events/${event.id}/live/notifications`),
    centerTab: resolveCenterTab(event.currentUserRoles),
  });

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} eventNavItems={eventNavTabs} />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 sm:pt-0">
        <header className="border-b border-border bg-card px-4 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <Bell className="size-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-foreground">{event.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {formatEventDateRange(event.startDate, event.competitionDays)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {event.location}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-4" />
                    {event.venue}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 sm:py-6">
          <h2 className="text-lg font-bold text-foreground">Notificações</h2>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            {notifications === null ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : notifications.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma notificação ainda — avisos sobre súmulas, resultados e apresentações do
                evento aparecem aqui.
              </p>
            ) : (
              <div className="rounded-2xl border border-border bg-card">
                <div className="divide-y divide-border">
                  {notifications.map((notification) => {
                    const Icon = NOTIFICATION_ICONS[notification.type];
                    const href = notificationHref(event.id, notification);
                    const content = (
                      <>
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                          <Icon className="size-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatNotificationRelativeTime(notification.createdAt)}
                          </p>
                        </div>
                        {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                      </>
                    );
                    return href ? (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => navigate(href)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={notification.id} className="flex items-center gap-3 px-4 py-3.5">
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <EventLiveBottomNav tabs={eventNavTabs} className="sm:hidden" />
      </main>
    </div>
  );
}
