import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, History } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { EVENT_ACTIVITY_ACTION_LABELS } from "@/lib/eventActivityLabels";
import { EVENT_ACTIVITY_ACTION_ICONS, isDestructiveActivityAction } from "@/lib/eventActivityIcons";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { cn } from "@/lib/utils";
import {
  eventsApi,
  usersApi,
  type Event,
  type EventActivityLogEntry,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Tela dedicada de histórico do evento (2026-07-26, a pedido do
// usuário — substituiu o popup EventHistoryDialog) — só admin/assessor
// (useEventSetupGuard, mesmo gate já usado nas outras telas de
// configuração). Alcançada só pelo menu "⋯" da lista de eventos da
// Home (ver EventActionsMenu); não faz parte da navegação do evento ao
// vivo (removida de lá, ver EventLiveShared).
export function EventHistoryPage() {
  const { id } = useParams<{ id: string }>();
  useEventSetupGuard(id);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<EventActivityLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    eventsApi
      .getActivityLog(id)
      .then(setEntries)
      .catch(() => setError("Não foi possível carregar o histórico."));
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-10 pt-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para eventos
          </button>
          <NotificationBell />
        </div>

        <div className="px-10 pb-10">
          <div className="mt-6 grid gap-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <History className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Histórico do evento</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event ? event.name : "Carregando..."}
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {entries === null ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : entries.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum registro ainda.
              </p>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card">
                <div className="divide-y divide-border">
                  {entries.map((entry) => {
                    const Icon = EVENT_ACTIVITY_ACTION_ICONS[entry.action];
                    const destructive = isDestructiveActivityAction(entry.action);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full",
                              destructive
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {EVENT_ACTIVITY_ACTION_LABELS[entry.action]}
                            </p>
                            {entry.detail && (
                              <p className="truncate text-xs text-muted-foreground">{entry.detail}</p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm text-foreground">{entry.actorName || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
