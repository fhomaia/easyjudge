import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, CalendarDays, ChevronLeft, MapPin, Trophy } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { PresentationNotesDetail } from "@/components/scoring/PresentationNotesDetail";
import { buildEventNavTabs } from "@/components/EventLiveShared";
import { resolveCenterTab, resolveNotesHref } from "@/lib/eventNavPriority";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import {
  eventsApi,
  teamScoringApi,
  usersApi,
  type AdminOverviewEntry,
  type Event,
  type PresentationDetail,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

// Visão do Programa (dono da equipe) sobre as notas das próprias
// equipes — só aparecem apresentações já liberadas
// (`scoresReleasedAt`). Conteúdo (lista + detalhe) é o mesmo em mobile
// e desktop, só o chrome muda: mobile fica enxuto de propósito (mesmo
// espírito minimalista de EventLiveScoringPage), desktop ganha a
// AppSidebar completa (2026-07-27, a pedido do usuário — a versão sem
// sidebar ficava com o conteúdo espremido num container estreito e
// centralizado em telas largas). Mesmo padrão de split mobile/desktop
// já usado em EventLiveNotesPage/EventLiveNotesDesktopView.
export function EventLiveTeamNotesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<AdminOverviewEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PresentationDetail | null>(null);
  const [contesting, setContesting] = useState(false);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    teamScoringApi.getOverview(id).then(setEntries).catch(() => setEntries([]));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedId) {
      setDetail(null);
      return;
    }
    teamScoringApi.getDetail(id, selectedId).then(setDetail);
  }, [id, selectedId]);

  async function handleContest() {
    if (!id || !selectedId) return;
    setContesting(true);
    await teamScoringApi.contest(id, selectedId);
    // Também recarrega a lista (não só o detalhe aberto) — senão o
    // badge "Contestação" na lista fica desatualizado até um reload
    // manual da página.
    const [refreshedDetail, refreshedEntries] = await Promise.all([
      teamScoringApi.getDetail(id, selectedId),
      teamScoringApi.getOverview(id),
    ]);
    setDetail(refreshedDetail);
    setEntries(refreshedEntries);
    setContesting(false);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!event || !entries) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const eventNavTabs = buildEventNavTabs({
    current: "notas",
    onNavigateHome: () => navigate(`/events/${event.id}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.id}/live/schedule`),
    onNavigateNotes: () => navigate(resolveNotesHref(event.id, event.currentUserRoles)),
    onNavigateResults: () => navigate(`/events/${event.id}/live/results`),
    onNavigateNotifications: () => navigate(`/events/${event.id}/live/notifications`),
    centerTab: resolveCenterTab(event.currentUserRoles),
  });

  const contestButton =
    detail && detail.contestationReleased && !detail.contestationRequested ? (
      <button
        type="button"
        onClick={() => void handleContest()}
        disabled={contesting}
        className="w-full rounded-xl border border-red-300 bg-red-500/5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-60"
      >
        {contesting ? "Enviando..." : "Solicitar contestação"}
      </button>
    ) : undefined;

  return (
    <>
      <div className="flex h-svh flex-col bg-background lg:hidden">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">{event.name}</p>
            <p className="truncate text-xs text-muted-foreground">Notas das minhas equipes</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
          {selectedId && detail ? (
            <div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
                Voltar
              </button>
              <PresentationNotesDetail detail={detail} actions={contestButton} />
            </div>
          ) : (
            <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} />
          )}
        </main>
      </div>

      <div className="hidden h-svh lg:flex">
        <AppSidebar profile={profile} onLogout={handleLogout} eventNavItems={eventNavTabs} />
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          <header className="border-b border-border bg-card px-8 py-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                <Trophy className="size-6 text-white" />
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

          <main className="flex-1 overflow-y-auto p-6">
            {selectedId && detail ? (
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  Voltar
                </button>
                <PresentationNotesDetail detail={detail} actions={contestButton} />
              </div>
            ) : (
              <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} />
            )}
          </main>
        </div>
      </div>
    </>
  );
}
