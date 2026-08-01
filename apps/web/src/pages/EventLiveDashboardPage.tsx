import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  MapPin,
  Menu,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { BlinkingDot } from "@/components/BlinkingDot";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EventCelebrationOverlay } from "@/components/EventCelebrationOverlay";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { EventLiveDesktopView } from "@/components/EventLiveDesktopView";
import { JudgesSummaryDialog } from "@/components/JudgesSummaryDialog";
import { ProgramsSummaryDialog } from "@/components/ProgramsSummaryDialog";
import {
  ENTRY_VISUALS,
  EventLiveBottomNav,
  StatTile,
  buildEventNavTabs,
  countdownLabel,
  scheduleItemTitleParts,
} from "@/components/EventLiveShared";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { REALTIME_FALLBACK_POLL_MS, useEventLiveSocket } from "@/lib/useEventLiveSocket";
import { formatDate } from "@/lib/formatDate";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { computeResourceTimes, formatMinutes } from "@/lib/scheduleTime";
import { computeEventLiveSchedule, toIsoDate } from "@/lib/eventLiveSchedule";
import { resolveCenterTab, resolveNotesHref } from "@/lib/eventNavPriority";
import { buildJudgePresentationList } from "@/lib/judgeSchedule";
import { NOTIFICATION_ICONS, formatNotificationRelativeTime, notificationHref } from "@/lib/notificationDisplay";
import { cn } from "@/lib/utils";
import {
  ApiError,
  categoriesApi,
  eventsApi,
  judgesApi,
  judgingApi,
  notificationsApi,
  programsApi,
  regulationApi,
  scheduleApi,
  scoringApi,
  teamsApi,
  usersApi,
  type Category,
  type Event,
  type EventMemberRole,
  type Judge,
  type JudgeAssignmentsSummary,
  type NotificationView,
  type Program,
  type Regulation,
  type ScheduleDay,
  type TeamWithProgram,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

const EMPTY_ASSIGNMENT: JudgeAssignmentsSummary = {
  isJudge: false,
  specialRoles: [],
  criterionGroups: [],
  resourceIds: [],
  criterionResourceTemplates: [],
};

export function EventLiveDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id, { allowSpectator: true });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [judges, setJudges] = useState<Judge[] | null>(null);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [teams, setTeams] = useState<TeamWithProgram[] | null>(null);
  const [assignment, setAssignment] = useState<JudgeAssignmentsSummary>(EMPTY_ASSIGNMENT);
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);
  const [startedPresentations, setStartedPresentations] = useState<
    Array<{ scheduleEntryId: string; startedAt: string }>
  >([]);
  const [completedEntryIds, setCompletedEntryIds] = useState<string[]>([]);
  const [regulation, setRegulation] = useState<Regulation | null>(null);
  const [notifications, setNotifications] = useState<NotificationView[] | null>(null);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState<number | null>(null);
  const [memberCounts, setMemberCounts] = useState<Partial<Record<EventMemberRole, number>>>({});
  const [judgesDialogOpen, setJudgesDialogOpen] = useState(false);
  const [programsDialogOpen, setProgramsDialogOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startCelebrationOpen, setStartCelebrationOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    scheduleApi.listDays(id).then(setDays).catch(() => setDays([]));
    categoriesApi.list(id).then(setCategories).catch(() => setCategories([]));
    regulationApi.get(id).then(setRegulation).catch(() => setRegulation(null));
    judgingApi.me(id).then(setAssignment).catch(() => setAssignment(EMPTY_ASSIGNMENT));
    scoringApi.getMySubmissions(id).then(setSubmittedIds).catch(() => setSubmittedIds([]));
    judgesApi
      .list(id)
      .then(setJudges)
      .catch(() => setJudges(null));
    // Direto de ProgramParticipation (mesma fonte da tela "Programas e
    // equipes"), não do roster de acessos (EventMember) — mais
    // confiável: um programa pode existir sem o papel "program" nunca
    // ter sido sincronizado pro roster (dado legado, ver
    // ProgramsService.create/linkUnclaimedProgramsByEmail).
    programsApi
      .list(id)
      .then(setPrograms)
      .catch(() => setPrograms(null));
    // Só pra agrupar por programa no popup de "Programas cadastrados"
    // (ver ProgramsSummaryDialog) — um único GET pra todas as equipes do
    // evento em vez de N chamadas (uma por programa).
    teamsApi
      .listForEvent(id)
      .then(setTeams)
      .catch(() => setTeams(null));
  }, [id]);

  // Card "Atraso atual" — atualizado via WebSocket (ver
  // useEventLiveSocket abaixo) a cada notificação relevante; o
  // `setInterval` (bem mais espaçado que antes) é só uma rede de
  // segurança pra reconexão de socket falhando silenciosamente, não o
  // mecanismo principal.
  const refreshStartedPresentations = useCallback(() => {
    if (!id) return;
    scoringApi.getStartedPresentations(id).then(setStartedPresentations).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    refreshStartedPresentations();
    const interval = setInterval(refreshStartedPresentations, REALTIME_FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [id, refreshStartedPresentations]);

  // "Próxima apresentação"/"Próximo em cada pista" — mesmo raciocínio
  // acima: sem isso, uma apresentação julgada mais rápido que a duração
  // planejada continuava aparecendo como "próxima" até o relógio
  // alcançar o horário agendado (ver lib/eventLiveSchedule.ts).
  const refreshCompletedPresentations = useCallback(() => {
    if (!id) return;
    scoringApi.getCompletedPresentations(id).then(setCompletedEntryIds).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    refreshCompletedPresentations();
    const interval = setInterval(refreshCompletedPresentations, REALTIME_FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [id, refreshCompletedPresentations]);

  useEffect(() => {
    if (!id) return;
    eventsApi.getMemberCounts(id).then(setMemberCounts).catch(() => {});
  }, [id]);

  // Card/sino "Notificações" — mesmo padrão de started/completed acima.
  const refreshNotifications = useCallback(() => {
    if (!id) return;
    notificationsApi
      .list(id)
      .then((res) => {
        setNotifications(res.notifications);
        setNotificationsUnreadCount(res.unreadCount);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    refreshNotifications();
    const interval = setInterval(refreshNotifications, REALTIME_FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [id, refreshNotifications]);

  // Sinal do backend (EventsGateway, ver CLAUDE.md "Tempo real") — só
  // avisa "algo mudou", quem recebe decide o que refazer. Uma
  // notificação nova pode significar apresentação iniciada/concluída,
  // movida, contestação, desistência etc.; mais simples (e barato o
  // bastante numa POC) reatualizar os 3 de uma vez do que filtrar por
  // tipo. `event.status_changed` recarrega o evento (badge de status/
  // "Ao vivo" some/aparece sem precisar de reload).
  useEventLiveSocket(id, {
    onNotification: () => {
      refreshNotifications();
      refreshStartedPresentations();
      refreshCompletedPresentations();
    },
    onEventStatusChanged: () => {
      if (!id) return;
      eventsApi.get(id).then(setEvent).catch(() => {});
    },
  });

  // Essa tela é só pra evento publicado/em andamento — "created" volta
  // pro setup, "completed" ainda não tem uma tela própria de resumo
  // pós-evento, então volta pra Home por enquanto.
  useEffect(() => {
    if (!event) return;
    if (event.status === "created") navigate(`/events/${event.aliasId}/setup`, { replace: true });
    else if (event.status === "completed") navigate("/", { replace: true });
  }, [event, navigate]);

  // Sem WebSocket ainda (ver "Próximos passos" do projeto) — o horário
  // "agora" é recalculado periodicamente pra manter a contagem
  // regressiva e a barra de aquecimento razoavelmente atualizadas.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const completedEntryIdSet = useMemo(() => new Set(completedEntryIds), [completedEntryIds]);
  const live = useMemo(
    () => (days && event ? computeEventLiveSchedule(days, completedEntryIdSet) : null),
    [days, event, completedEntryIdSet],
  );
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isoToday = toIsoDate(now);

  // "Ir para agora" só faz sentido pra quem lança nota (jurado de
  // verdade — `assignment.isJudge`, não só o papel "judge" no evento) —
  // leva direto pra súmula da apresentação seguinte não enviada (a que
  // está rolando agora ou a próxima), mesma lista/critério de "próxima
  // apresentação" já usado em EventLiveNotesPage.
  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories ?? []) map.set(c.id, c);
    return map;
  }, [categories]);
  const submittedSet = useMemo(() => new Set(submittedIds), [submittedIds]);
  const nextJudgePresentationId = useMemo(() => {
    if (!days || !assignment.isJudge) return null;
    const myPresentations = buildJudgePresentationList(days, categoriesById, assignment, submittedSet);
    return (
      myPresentations.find((item) => !item.submitted && !item.entry.withdrawnAt)?.entry.id ?? null
    );
  }, [days, categoriesById, assignment, submittedSet]);

  function handleGoToNow() {
    if (!event || !nextJudgePresentationId) return;
    navigate(`/events/${event.aliasId}/live/scoring/${nextJudgePresentationId}`);
  }

  // "Atraso atual" (card RESUMO DO EVENTO) — compara o horário AGENDADO
  // da apresentação mais recentemente iniciada (ScoreEventKind.
  // TIMER_STARTED, ver ScoringService.getStartedPresentations) com o
  // horário REAL em que o Jurado de Legalidade deu play no cronômetro.
  // Só métrica informativa — não altera a projeção de horário das
  // próximas apresentações (decisão do usuário).
  const delayMinutes = useMemo(() => {
    if (!days || startedPresentations.length === 0) return null;
    const scheduleByEntry = new Map<string, { dayDate: string; startMinutes: number }>();
    for (const day of days) {
      const times = computeResourceTimes(day.resources, day.startMinutes);
      for (const [entryId, t] of times) {
        scheduleByEntry.set(entryId, { dayDate: day.date, startMinutes: t.startMinutes });
      }
    }
    let latest: { scheduleEntryId: string; startedAt: Date } | null = null;
    for (const sp of startedPresentations) {
      const startedAt = new Date(sp.startedAt);
      if (!latest || startedAt > latest.startedAt) latest = { scheduleEntryId: sp.scheduleEntryId, startedAt };
    }
    if (!latest) return null;
    const scheduled = scheduleByEntry.get(latest.scheduleEntryId);
    if (!scheduled) return null;
    const scheduledDate = new Date(`${scheduled.dayDate}T00:00:00`);
    scheduledDate.setMinutes(scheduledDate.getMinutes() + scheduled.startMinutes);
    return Math.round((latest.startedAt.getTime() - scheduledDate.getTime()) / 60_000);
  }, [days, startedPresentations]);

  const delayLabel =
    delayMinutes === null
      ? "—"
      : delayMinutes > 0
        ? `+${delayMinutes} min`
        : delayMinutes < 0
          ? `${delayMinutes} min`
          : "No horário";
  const delayProgress = delayMinutes === null ? 0 : Math.min(1, Math.max(0, delayMinutes / 30));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleStart() {
    if (!event) return;
    setStarting(true);
    try {
      const updated = await eventsApi.start(event.aliasId);
      setEvent(updated);
      setStartCelebrationOpen(true);
    } catch (err) {
      // Sem sistema de toast no projeto ainda — silencioso é melhor que
      // travar a tela; o botão volta a ficar clicável pra tentar de novo.
      console.error(err instanceof ApiError ? err.message : err);
    } finally {
      setStarting(false);
    }
  }

  // Sem try/catch aqui de propósito — o ConfirmDialog (ver
  // EventLiveDesktopView) trata o erro inline e mantém o popup aberto
  // pra tentar de novo, diferente do handleStart acima. Assim que
  // `event.status` virar "created", o useEffect logo no topo do
  // componente já redireciona pro setup — não precisa navegar
  // manualmente aqui.
  async function handleRevert() {
    if (!event) return;
    const updated = await eventsApi.unpublish(event.aliasId);
    setEvent(updated);
  }

  // Sem try/catch, mesmo raciocínio de handleRevert acima — o
  // ConfirmDialog trata o erro inline e mantém o popup aberto.
  async function handleComplete() {
    if (!event) return;
    const updated = await eventsApi.complete(event.aliasId);
    setEvent(updated);
  }

  if (!event || !live) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  // Sem o filtro de "é hoje o dia do evento" que a Home usa
  // (EventLifecycleAction) — aqui o admin já entrou de propósito na
  // tela de gestão de um evento específico, então o botão fica sempre
  // disponível enquanto ele não tiver sido iniciado.
  const canStart = event.currentUserRoles.includes("admin") && event.status === "published";
  const isAdminOrAssessor = event.currentUserRoles.some((r) => r === "admin" || r === "assessor");
  const canComplete = isAdminOrAssessor && event.status === "started";
  // "Jurados cadastrados" — quem lança nota também pode ver quem mais
  // tá julgando o evento (ver JudgesController.findAll, ampliado pra
  // jurado); "Programas cadastrados" continua só admin/assessor (é
  // gestão do evento, não faz sentido pra jurado).
  const canViewJudges = isAdminOrAssessor || event.currentUserRoles.includes("judge");

  const eventNavTabs = buildEventNavTabs({
    current: "inicio",
    onNavigateHome: () => navigate(`/events/${event.aliasId}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.aliasId}/live/schedule`),
    onNavigateNotes: () => navigate(resolveNotesHref(event.aliasId, event.currentUserRoles)),
    onNavigateResults: () => navigate(`/events/${event.aliasId}/live/results`),
    onNavigateNotifications: () => navigate(`/events/${event.aliasId}/live/notifications`),
    notificationsUnreadCount: notificationsUnreadCount ?? undefined,
    centerTab: resolveCenterTab(event.currentUserRoles),
  });

  const nextDisplay = live.next ? scheduleItemTitleParts(live.next) : null;
  const warmupTotal = live.next?.warmup ? live.next.warmup.end - live.next.warmup.start : 0;
  const warmupElapsed = live.next?.warmup
    ? Math.min(warmupTotal, Math.max(0, nowMinutes - live.next.warmup.start))
    : 0;

  return (
    <>
    <div className="flex h-svh flex-col bg-background lg:hidden">
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
            {formatEventDateRange(event.startDate, event.competitionDays)} · {event.location}
          </p>
        </div>
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

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {event.status === "started" ? (
                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <BlinkingDot colorClassName="bg-emerald-500" />
                  Evento em andamento
                </span>
              ) : canStart ? (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting}
                  className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <BlinkingDot colorClassName="bg-emerald-500" />
                  {starting ? "Iniciando..." : "Iniciar evento"}
                </button>
              ) : (
                <EventStatusBadge status={event.status} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      disabled={!regulation || regulation.documents.length === 0}
                      title={
                        !regulation || regulation.documents.length === 0
                          ? "Nenhum documento enviado ainda"
                          : undefined
                      }
                      aria-label="Documentos do regulamento"
                      className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                    />
                  }
                >
                  <FileText className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {regulation?.documents.map((doc) => (
                    <DropdownMenuItem
                      key={doc.id}
                      onClick={() => window.open(doc.fileUrl, "_blank", "noopener,noreferrer")}
                    >
                      <FileText data-icon="inline-start" />
                      <span className="truncate">{doc.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {canComplete && (
                <button
                  type="button"
                  onClick={() => setCompleteDialogOpen(true)}
                  className="flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-500/20"
                >
                  <BlinkingDot colorClassName="bg-violet-500" />
                  Concluir evento
                </button>
              )}

              {assignment.isJudge && (
                <button
                  type="button"
                  onClick={handleGoToNow}
                  disabled={!nextJudgePresentationId}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                >
                  <Clock className="size-4" />
                  Ir para agora
                </button>
              )}
            </div>
          </div>

          {live.next ? (
            <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg">
              <p className="text-xs font-semibold tracking-wide text-white/70">
                {live.next.entry.type === "presentation" ? "PRÓXIMA APRESENTAÇÃO" : "A SEGUIR"}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm text-white/80">
                  <Clock className="size-4" />
                  {formatMinutes(live.next.start)}
                </span>
                {/* Contagem regressiva só faz sentido comparando minutos
                    dentro do MESMO dia — se o item é de outro dia do
                    cronograma (evento não iniciado, ou dia de hoje já
                    esgotado), mostra a data em vez de "Em X min". */}
                {live.next.dayDate === isoToday ? (
                  <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">
                    {countdownLabel(live.next.start, nowMinutes)}
                  </span>
                ) : (
                  <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">
                    {formatDate(live.next.dayDate)}
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl leading-tight font-bold">{nextDisplay?.title}</p>
              {nextDisplay?.subtitle && <p className="text-white/80">{nextDisplay.subtitle}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
                <MapPin className="size-4" />
                {live.next.resourceName}
              </p>

              {live.next.warmup &&
                (live.next.dayDate === isoToday ? (
                  <div className="mt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{
                          width: `${warmupTotal > 0 ? Math.min(100, (warmupElapsed / warmupTotal) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-white/70">
                      Warm-up: {formatMinutes(live.next.warmup.start)} -{" "}
                      {formatMinutes(live.next.warmup.end)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-white/70">
                    Warm-up: {formatMinutes(live.next.warmup.start)} -{" "}
                    {formatMinutes(live.next.warmup.end)}
                  </p>
                ))}
            </div>
          ) : (
            <div className="mx-4 mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {live.total === 0
                ? "Nenhuma apresentação cadastrada no cronograma ainda."
                : "Todas as apresentações já aconteceram."}
            </div>
          )}

          {live.upcoming.length > 0 && (
            <div className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                DEPOIS DISSO
              </p>
              <div className="mt-3 divide-y divide-border">
                {live.upcoming.map((item) => {
                  const display = scheduleItemTitleParts(item);
                  const visual = ENTRY_VISUALS[item.entry.type];
                  const Icon = visual.icon;
                  return (
                    <div key={item.entry.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="w-14 shrink-0">
                        <p className="text-sm font-medium text-foreground">{formatMinutes(item.start)}</p>
                        {item.dayDate !== isoToday && (
                          <p className="text-[10px] text-muted-foreground">{formatDate(item.dayDate)}</p>
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          visual.className,
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{display.title}</p>
                        {display.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{display.subtitle}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {item.resourceName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                <Bell className="size-4" />
                NOTIFICAÇÕES
              </span>
              <button
                type="button"
                onClick={() => navigate(`/events/${event.aliasId}/live/notifications`)}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted"
              >
                Ver todas
              </button>
            </div>
            {notifications === null || notifications.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {notifications === null ? "Carregando..." : "Nenhuma notificação ainda."}
              </p>
            ) : (
              <div className="mt-1 divide-y divide-border">
                {notifications.slice(0, 4).map((notification) => {
                  const Icon = NOTIFICATION_ICONS[notification.type];
                  const href = notificationHref(event.aliasId, event.currentUserRoles, notification);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      disabled={!href}
                      onClick={() => href && navigate(href)}
                      className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0 disabled:cursor-default"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatNotificationRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="mx-4 mt-4 text-xs font-semibold tracking-wide text-muted-foreground">
            RESUMO DO EVENTO
          </p>
          <div className="mx-4 mt-2 mb-6 grid grid-cols-2 gap-3">
            <StatTile
              icon={CalendarDays}
              iconClassName="bg-violet-500/10 text-violet-600"
              barClassName="bg-violet-500"
              value={`${live.completed} / ${live.total}`}
              label="Apresentações"
              progress={live.total > 0 ? live.completed / live.total : 0}
            />
            <StatTile
              icon={Users}
              iconClassName="bg-emerald-500/10 text-emerald-600"
              value={String(event.judgesCount ?? 0)}
              label="Jurados cadastrados"
              onClick={canViewJudges ? () => setJudgesDialogOpen(true) : undefined}
            />
            <StatTile
              icon={Clock}
              iconClassName="bg-amber-500/10 text-amber-600"
              barClassName="bg-amber-500"
              value={delayLabel}
              label="Atraso atual"
              progress={delayProgress}
            />
            <StatTile
              icon={Building2}
              iconClassName="bg-blue-500/10 text-blue-600"
              value={String(event.programsCount ?? 0)}
              label="Programas cadastrados"
              onClick={isAdminOrAssessor ? () => setProgramsDialogOpen(true) : undefined}
            />
            <StatTile
              icon={Eye}
              iconClassName="bg-slate-500/10 text-slate-600"
              value={String(memberCounts.spectator ?? 0)}
              label="Espectadores"
            />
            <StatTile
              icon={UserRound}
              iconClassName="bg-pink-500/10 text-pink-600"
              value={String(memberCounts.athlete ?? 0)}
              label="Atletas"
            />
          </div>
        </div>
      </main>

      <EventLiveBottomNav tabs={eventNavTabs} className="sticky bottom-0 z-20" />
    </div>

    <EventLiveDesktopView
      event={event}
      live={live}
      days={days}
      isoToday={isoToday}
      nowMinutes={nowMinutes}
      canStart={canStart}
      starting={starting}
      canComplete={canComplete}
      onOpenComplete={() => setCompleteDialogOpen(true)}
      regulation={regulation}
      memberCounts={memberCounts}
      isAdminOrAssessor={isAdminOrAssessor}
      canViewJudges={canViewJudges}
      completedEntryIds={completedEntryIdSet}
      notifications={notifications}
      notificationsUnreadCount={notificationsUnreadCount}
      isJudge={assignment.isJudge}
      onGoToNow={nextJudgePresentationId ? handleGoToNow : null}
      delayLabel={delayLabel}
      delayProgress={delayProgress}
      onOpenJudges={() => setJudgesDialogOpen(true)}
      onOpenPrograms={() => setProgramsDialogOpen(true)}
      onOpenNotifications={(href) => navigate(href ?? `/events/${event.aliasId}/live/notifications`)}
      onStart={handleStart}
      onRevert={handleRevert}
      onOpenFullSchedule={() => navigate(`/events/${event.aliasId}/live/schedule`)}
      eventNavItems={eventNavTabs}
      profile={profile}
      onLogout={handleLogout}
    />

    <ConfirmDialog
      open={completeDialogOpen}
      onOpenChange={setCompleteDialogOpen}
      title="Concluir evento?"
      description="Esta ação encerra o evento em definitivo. Deseja prosseguir?"
      confirmLabel="Concluir"
      confirmingLabel="Concluindo..."
      onConfirm={handleComplete}
    />

    <JudgesSummaryDialog open={judgesDialogOpen} onOpenChange={setJudgesDialogOpen} judges={judges} />
    <ProgramsSummaryDialog
      open={programsDialogOpen}
      onOpenChange={setProgramsDialogOpen}
      programs={programs}
      teams={teams}
    />

    {/* Já estamos na tela ao vivo (diferente do "Iniciar evento" clicado
        na Home) — o CTA só fecha o overlay em vez de navegar. */}
    <EventCelebrationOverlay
      open={startCelebrationOpen}
      title="Vamos começar o show!"
      subtitle="O evento começou — boa competição!"
      actionLabel="Continuar"
      onAction={() => setStartCelebrationOpen(false)}
    />
    </>
  );
}
