import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Menu,
  Percent,
  Scale,
  Trophy,
  XCircle,
} from "lucide-react";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { FunctionsSummaryDialog } from "@/components/FunctionsSummaryDialog";
import { EventLiveNotesDesktopView } from "@/components/EventLiveNotesDesktopView";
import { AdminNotesOverview } from "@/components/scoring/AdminNotesOverview";
import { AthleteNotesOverview } from "@/components/scoring/AthleteNotesOverview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventLiveBottomNav, MetricTile, buildEventNavTabs } from "@/components/EventLiveShared";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { formatDate } from "@/lib/formatDate";
import { formatMinutes } from "@/lib/scheduleTime";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";
import { toIsoDate } from "@/lib/eventLiveSchedule";
import { buildJudgePresentationList, functionLabelsFor, type JudgePresentationItem } from "@/lib/judgeSchedule";
import { resolveCenterTab, resolveNotesHref } from "@/lib/eventNavPriority";
import { cn } from "@/lib/utils";
import {
  categoriesApi,
  eventsApi,
  judgingApi,
  notificationsApi,
  scheduleApi,
  scoringApi,
  usersApi,
  type Category,
  type Event,
  type JudgeAssignmentsSummary,
  type ScheduleDay,
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

export function EventLiveNotesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id, { allowSpectator: true });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [assignment, setAssignment] = useState<JudgeAssignmentsSummary | null>(null);
  const [submittedIds, setSubmittedIds] = useState<string[] | null>(null);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [functionsDialogOpen, setFunctionsDialogOpen] = useState(false);
  // Só é lido/mostrado quando o usuário acumula admin/assessor E jurado
  // (ver `isAdminOrAssessor && assignment.isJudge` mais abaixo) — pra
  // quem só é um dos dois, a tela nem tem abas.
  const [notesTab, setNotesTab] = useState<"mine" | "all">("mine");

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    scheduleApi.listDays(id).then(setDays).catch(() => setDays([]));
    categoriesApi.list(id).then(setCategories).catch(() => setCategories([]));
    judgingApi.me(id).then(setAssignment).catch(() => setAssignment(EMPTY_ASSIGNMENT));
    scoringApi.getMySubmissions(id).then(setSubmittedIds).catch(() => setSubmittedIds([]));
    notificationsApi
      .list(id)
      .then((res) => setNotificationsUnreadCount(res.unreadCount))
      .catch(() => setNotificationsUnreadCount(null));
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories ?? []) map.set(c.id, c);
    return map;
  }, [categories]);

  const isoToday = toIsoDate(now);

  // Todas as apresentações do jurado, na ordem do cronograma —
  // "concluída" vem de um sinal real (SHEET_SUBMITTED, emitido ao
  // clicar "Lançar notas"), não de comparação com o relógio (ver
  // buildJudgePresentationList).
  const submittedSet = useMemo(() => new Set(submittedIds ?? []), [submittedIds]);
  const myPresentations: JudgePresentationItem[] = useMemo(() => {
    if (!days || !assignment) return [];
    return buildJudgePresentationList(days, categoriesById, assignment, submittedSet);
  }, [days, assignment, categoriesById, submittedSet]);
  // Desistida nunca fica "submitted" de verdade (ninguém pontua) mas
  // também não é mais "a próxima" — pula pra não mandar o jurado pra
  // uma súmula que não aceita mais nota (ver ScoringService.
  // buildScoreEventRows).
  const nextIndex = myPresentations.findIndex(
    (item) => !item.submitted && !item.entry.withdrawnAt,
  );
  const completedCount = myPresentations.filter((item) => item.submitted).length;
  // Contestações pendentes (a resolvida some da lista — deixou de
  // precisar de atenção), na ordem em que a equipe solicitou —
  // "ordem de chegada", não a ordem do cronograma.
  const contestedItems = useMemo(
    () =>
      myPresentations
        .filter((item) => item.entry.contestationRequestedAt && !item.entry.contestationResolvedAt)
        .sort(
          (a, b) =>
            new Date(a.entry.contestationRequestedAt!).getTime() -
            new Date(b.entry.contestationRequestedAt!).getTime(),
        ),
    [myPresentations],
  );
  const todayItems = myPresentations.filter((item) => item.dayDate === isoToday);
  const todayCompleted = todayItems.filter((item) => item.submitted).length;
  const todayPercent = todayItems.length > 0 ? Math.round((todayCompleted / todayItems.length) * 100) : 0;

  if (!event || !assignment || !submittedIds) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const eventNavTabs = buildEventNavTabs({
    current: "notas",
    onNavigateHome: () => navigate(`/events/${event.aliasId}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.aliasId}/live/schedule`),
    onNavigateNotes: () => navigate(resolveNotesHref(event.aliasId, event.currentUserRoles)),
    onNavigateResults: () => navigate(`/events/${event.aliasId}/live/results`),
    onNavigateNotifications: () => navigate(`/events/${event.aliasId}/live/notifications`),
    notificationsUnreadCount: notificationsUnreadCount ?? undefined,
    centerTab: resolveCenterTab(event.currentUserRoles),
  });

  // Separada em destaque (card próprio), não só mais uma linha da lista
  // — mesmo raciocínio do design anterior.
  const nextItem = nextIndex >= 0 ? myPresentations[nextIndex] : null;
  const nextDisplay = nextItem ? getScheduleEntryDisplay(nextItem.entry, nextItem.start, nextItem.end, []) : null;

  const isAdminOrAssessor = event.currentUserRoles.some((r) => r === "admin" || r === "assessor");
  const isAthlete = event.currentUserRoles.includes("athlete");
  const isSpectator = event.currentUserRoles.includes("spectator");
  const functionLines = functionLabelsFor(assignment);
  const nowLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Reaproveitado tanto pra quem é só jurado (sozinho, sem abas) quanto
  // dentro da aba "Minhas súmulas" de quem também é admin/assessor —
  // evita duplicar todo este JSX nos dois lugares.
  const judgeQueueContent = (
    <>
      <div className="grid grid-cols-4 gap-2 px-4 pt-4">
        <MetricTile
          icon={Clock}
          iconClassName="bg-violet-500/10 text-violet-600"
          label="Horário"
          value={nowLabel}
          sub={formatDate(isoToday)}
        />
        <MetricTile
          icon={CalendarDays}
          iconClassName="bg-blue-500/10 text-blue-600"
          label="Apresentações"
          value={`${completedCount} / ${myPresentations.length}`}
          sub="Concluídas"
        />
        <MetricTile
          icon={Scale}
          iconClassName="bg-emerald-500/10 text-emerald-600"
          label="Funções"
          lines={functionLines.length > 0 ? functionLines : ["—"]}
          onExpand={() => setFunctionsDialogOpen(true)}
        />
        <MetricTile
          icon={Percent}
          iconClassName="bg-amber-500/10 text-amber-600"
          label="Progresso"
          value={`${todayPercent}%`}
          sub="Do dia"
        />
      </div>

      {nextItem ? (
        <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-wide text-white/70">PRÓXIMA APRESENTAÇÃO</p>
            {nextItem.dayDate !== isoToday && (
              <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">
                {formatDate(nextItem.dayDate)}
              </span>
            )}
          </div>
          <p className="mt-3 text-2xl leading-tight font-bold">{nextDisplay?.title}</p>
          {nextDisplay?.subtitle && <p className="text-white/80">{nextDisplay.subtitle}</p>}
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
            <MapPin className="size-4" />
            {nextItem.resourceName} · {formatMinutes(nextItem.start)}
          </p>
          {nextItem.entry.contestationRequestedAt && !nextItem.entry.contestationResolvedAt && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-white">
              <AlertTriangle className="size-3.5" />
              Contestação solicitada
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate(`/events/${event.aliasId}/live/scoring/${nextItem.entry.id}`)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
          >
            Iniciar avaliação
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : myPresentations.length > 0 ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-6 text-center text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Você concluiu todas as suas apresentações.
        </div>
      ) : (
        <div className="mx-4 mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma apresentação pendente pra você julgar.
        </div>
      )}

      {contestedItems.length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl border border-red-300/50 bg-red-500/5 p-2">
          <p className="px-2 pt-2 text-xs font-semibold tracking-wide text-red-600">CONTESTAÇÕES</p>
          <div className="mt-1 divide-y divide-red-300/30">
            {contestedItems.map((item) => {
              const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
              return (
                <button
                  key={item.entry.id}
                  type="button"
                  onClick={() => navigate(`/events/${event.aliasId}/live/scoring/${item.entry.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-red-500/10"
                >
                  <AlertTriangle className="size-4 shrink-0 text-red-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{display.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {display.subtitle ? `${display.subtitle} · ` : ""}
                      {item.resourceName}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mx-4 mt-4 mb-6 rounded-2xl border border-border bg-card p-2">
        <p className="px-2 pt-2 text-xs font-semibold tracking-wide text-muted-foreground">
          MINHAS APRESENTAÇÕES
        </p>
        {myPresentations.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma apresentação pendente pra você julgar.
          </p>
        ) : (
          <div className="mt-1 divide-y divide-border">
            {myPresentations.map((item, index) => {
              const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
              const isNext = index === nextIndex;
              const contested =
                Boolean(item.entry.contestationRequestedAt) &&
                !item.entry.contestationResolvedAt;
              const contestationResolved =
                Boolean(item.entry.contestationRequestedAt) &&
                Boolean(item.entry.contestationResolvedAt);
              const withdrawn = Boolean(item.entry.withdrawnAt);
              return (
                <button
                  key={item.entry.id}
                  type="button"
                  disabled={withdrawn}
                  onClick={() => navigate(`/events/${event.aliasId}/live/scoring/${item.entry.id}`)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-3 text-left first:mt-0",
                    withdrawn
                      ? "cursor-default opacity-60"
                      : isNext
                        ? "bg-primary/5 ring-1 ring-primary/30"
                        : "hover:bg-muted",
                  )}
                >
                  <div className="w-14 shrink-0">
                    <p className="text-sm font-medium text-foreground">{formatMinutes(item.start)}</p>
                    {item.dayDate !== isoToday && (
                      <p className="text-[10px] text-muted-foreground">{formatDate(item.dayDate)}</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{display.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {display.subtitle ? `${display.subtitle} · ` : ""}
                      {item.resourceName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isNext && (
                      <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        Próxima
                      </span>
                    )}
                    {item.submitted && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Concluída
                      </span>
                    )}
                    {contestationResolved && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Contestação resolvida
                      </span>
                    )}
                    {contested && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                        <AlertTriangle className="size-3.5" />
                        Contestação
                      </span>
                    )}
                    {withdrawn && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                        <XCircle className="size-3.5" />
                        Desistência
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

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
            {formatDate(event.startDate)} · {event.location}
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
          {isAdminOrAssessor && assignment.isJudge ? (
            <Tabs value={notesTab} onValueChange={(v) => setNotesTab(v as "mine" | "all")}>
              <TabsList className="mx-4 mt-4 w-[calc(100%-2rem)]">
                <TabsTrigger value="mine" className="flex-1">
                  Minhas súmulas
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1">
                  Todas as súmulas
                </TabsTrigger>
              </TabsList>
              <TabsContent value="mine">{judgeQueueContent}</TabsContent>
              <TabsContent value="all">
                <div className="p-4">
                  <AdminNotesOverview eventId={event.aliasId} eventName={event.name} />
                </div>
              </TabsContent>
            </Tabs>
          ) : isAdminOrAssessor ? (
            <div className="p-4">
              <AdminNotesOverview eventId={event.aliasId} eventName={event.name} />
            </div>
          ) : assignment.isJudge ? (
            judgeQueueContent
          ) : isAthlete ? (
            <div className="p-4">
              <AthleteNotesOverview eventId={event.aliasId} />
            </div>
          ) : (
            <div className="m-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {isSpectator
                ? "O conteúdo não está disponível para espectadores do evento."
                : "Você não está escalado como jurado neste evento."}
            </div>
          )}
      </main>

      <EventLiveBottomNav tabs={eventNavTabs} className="sticky bottom-0 z-20" />
    </div>

    <EventLiveNotesDesktopView
      event={event}
      profile={profile}
      onLogout={handleLogout}
      eventNavItems={eventNavTabs}
      assignment={assignment}
      isAdminOrAssessor={isAdminOrAssessor}
      isAthlete={isAthlete}
      functionLines={functionLines}
      myPresentations={myPresentations}
      contestedItems={contestedItems}
      nextIndex={nextIndex}
      completedCount={completedCount}
      isoToday={isoToday}
      nowLabel={nowLabel}
      todayPercent={todayPercent}
      onOpenFunctions={() => setFunctionsDialogOpen(true)}
    />

    <FunctionsSummaryDialog
      open={functionsDialogOpen}
      onOpenChange={setFunctionsDialogOpen}
      functions={functionLines}
    />
    </>
  );
}
