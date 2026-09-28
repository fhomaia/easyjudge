import { useEffect, useState } from "react";
import { useMinimumLoading } from "@/lib/useMinimumLoading";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { useNavigate, useParams } from "react-router-dom";
import { Bell, Building2, CalendarDays, ChevronLeft, Loader2, MapPin, Menu, Trophy } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminNotesOverviewList } from "@/components/scoring/AdminNotesOverviewList";
import { PresentationNotesDetail } from "@/components/scoring/PresentationNotesDetail";
import { EventLiveBottomNav, buildEventNavTabs } from "@/components/EventLiveShared";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { EventFeedbackHeaderButton } from "@/components/EventFeedbackHeaderButton";
import { formatDate } from "@/lib/formatDate";
import { resolveCenterTab, resolveNotesHref } from "@/lib/eventNavPriority";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import {
  eventsApi,
  notificationsApi,
  teamScoringApi,
  usersApi,
  type AdminOverviewEntry,
  type Event,
  type PresentationDetail,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { ContestationDialog } from "@/components/scoring/ContestationDialog";

// Visão do Programa (dono da equipe) sobre as notas das próprias
// equipes — as notas de cada apresentação aparecem quando a categoria
// dela é liberada naquele dia (antes disso, "Aguardando liberação").
// Conteúdo (lista + detalhe) é o mesmo em mobile
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
  const [detailError, setDetailError] = useState(false);
  const [contesting, setContesting] = useState(false);
  const [contestDialogOpen, setContestDialogOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    teamScoringApi.getOverview(id).then(setEntries).catch(() => setEntries([]));
    notificationsApi
      .list(id)
      .then((res) => setNotificationsUnreadCount(res.unreadCount))
      .catch(() => setNotificationsUnreadCount(null));
  }, [id]);

  useEffect(() => {
    setDetail(null);
    setDetailError(false);
    if (!id || !selectedId) return;
    let cancelled = false;
    teamScoringApi
      .getDetail(id, selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetailError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, selectedId]);

  // Chamado pelo ContestationDialog (descrição e imagens opcionais). Erro
  // no envio sobe pro popup, que mostra a mensagem e continua aberto.
  async function handleContest(input: { description: string; images: File[] }) {
    if (!id || !selectedId) return;
    setContesting(true);
    try {
      await teamScoringApi.contest(id, selectedId, input);
      // Também recarrega a lista (não só o detalhe aberto) — senão o
      // badge "Contestação" na lista fica desatualizado até um reload
      // manual da página.
      const [refreshedDetail, refreshedEntries] = await Promise.all([
        teamScoringApi.getDetail(id, selectedId),
        teamScoringApi.getOverview(id),
      ]);
      setDetail(refreshedDetail);
      setEntries(refreshedEntries);
    } finally {
      setContesting(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Meio segundo no mínimo (useMinimumLoading), pro raio não piscar.
  const showLoading = useMinimumLoading(!event || !entries);
  if (showLoading || !event || !entries) {
    return (
      <RouteLoadingFallback />
    );
  }

  const eventNavTabs = buildEventNavTabs({
    current: "notas",
    event,
    onNavigateHome: () => navigate(`/events/${event.aliasId}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.aliasId}/live/schedule`),
    onNavigateNotes: () => navigate(resolveNotesHref(event.aliasId, event.currentUserRoles)),
    onNavigateResults: () => navigate(`/events/${event.aliasId}/live/results`),
    onNavigateNotifications: () => navigate(`/events/${event.aliasId}/live/notifications`),
    centerTab: resolveCenterTab(event.currentUserRoles),
    notificationsUnreadCount: notificationsUnreadCount ?? undefined,
  });

  const contestButton =
    detail && detail.contestationReleased && !detail.contestationRequested ? (
      <button
        type="button"
        onClick={() => setContestDialogOpen(true)}
        disabled={contesting}
        className="shrink-0 rounded-xl border border-red-300 bg-red-500/5 px-4 py-2 text-sm font-semibold whitespace-nowrap text-red-600 hover:bg-red-500/10 disabled:opacity-60"
      >
        {contesting ? "Enviando..." : "Solicitar contestação"}
      </button>
    ) : undefined;

  // Abre na hora ao clicar (mesmo padrão de admin/atleta): o detalhe leva
  // ~1,5 s pra chegar em produção e, sem isso, a lista ficava parada
  // como se o clique não tivesse funcionado.
  const notesContent = selectedId ? (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
        {detail && contestButton}
      </div>
      {detail ? (
        <PresentationNotesDetail detail={detail} celebrateHitZero />
      ) : detailError ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar a súmula. Volte e tente de novo.
        </p>
      ) : (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
    </div>
  ) : (
    <AdminNotesOverviewList entries={entries} onSelect={setSelectedId} hideUnreleased />
  );

  return (
    <>
      {/* Mesmo cabeçalho/menu/barra inferior das outras telas ao vivo
          (2026-09-28): antes era só "Sair", que deslogava, sem como
          navegar pro resto do evento. */}
      <div className="flex h-dvh flex-col bg-background lg:hidden">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-brand-navy px-4 py-3 text-white">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
            <Trophy className="size-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{event.name}</p>
            <p className="truncate text-xs text-white/60">
              {formatDate(event.startDate)} · {event.location}
            </p>
          </div>
          <EventFeedbackHeaderButton event={event} />
          <button
            type="button"
            aria-label="Notificações"
            onClick={() => navigate(`/events/${event.aliasId}/live/notifications`)}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Bell className="size-5" />
            {!!notificationsUnreadCount && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white">
                {notificationsUnreadCount}
              </span>
            )}
          </button>
        </header>

        <MobileNavSheet
          open={navOpen}
          onOpenChange={setNavOpen}
          profile={profile}
          onLogout={handleLogout}
          onNavigate={navigate}
          eventNavItems={eventNavTabs}
        />

        <main className="relative mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
          {notesContent}
        </main>

        <EventLiveBottomNav tabs={eventNavTabs} className="sticky bottom-0 z-20" />
      </div>

      <div className="hidden h-dvh lg:flex">
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

          <main className="relative flex-1 overflow-y-auto p-6">
            {notesContent}
          </main>
        </div>
      </div>

      <ContestationDialog
        open={contestDialogOpen}
        onOpenChange={setContestDialogOpen}
        teamName={detail?.presentation.teamName ?? ""}
        onConfirm={handleContest}
      />
    </>
  );
}
