import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Bell, CalendarDays, ChevronRight, Clock, MapPin, Menu, Trophy, Users } from "lucide-react";
import { BlinkingDot } from "@/components/BlinkingDot";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { EventLiveDesktopView } from "@/components/EventLiveDesktopView";
import { JudgesSummaryDialog } from "@/components/JudgesSummaryDialog";
import {
  ENTRY_VISUALS,
  EventLiveBottomNav,
  MOCK_ALERTS,
  StatTile,
  buildEventNavTabs,
  countdownLabel,
  scheduleItemTitleParts,
} from "@/components/EventLiveShared";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { formatDate } from "@/lib/formatDate";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { formatMinutes } from "@/lib/scheduleTime";
import { computeEventLiveSchedule, toIsoDate } from "@/lib/eventLiveSchedule";
import { cn } from "@/lib/utils";
import {
  ApiError,
  eventsApi,
  judgesApi,
  scheduleApi,
  usersApi,
  type Event,
  type Judge,
  type ScheduleDay,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function EventLiveDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventSetupGuard(id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [judges, setJudges] = useState<Judge[] | null>(null);
  const [judgesDialogOpen, setJudgesDialogOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    scheduleApi.listDays(id).then(setDays).catch(() => setDays([]));
    judgesApi
      .list(id)
      .then(setJudges)
      .catch(() => setJudges(null));
  }, [id]);

  // Essa tela é só pra evento publicado/em andamento — "created" volta
  // pro setup, "completed" ainda não tem uma tela própria de resumo
  // pós-evento, então volta pra Home por enquanto.
  useEffect(() => {
    if (!event) return;
    if (event.status === "created") navigate(`/events/${event.id}/setup`, { replace: true });
    else if (event.status === "completed") navigate("/", { replace: true });
  }, [event, navigate]);

  // Sem WebSocket ainda (ver "Próximos passos" do projeto) — o horário
  // "agora" é recalculado periodicamente pra manter a contagem
  // regressiva e a barra de aquecimento razoavelmente atualizadas.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const live = useMemo(
    () => (days && event ? computeEventLiveSchedule(days, event.status === "started", now) : null),
    [days, event, now],
  );
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isoToday = toIsoDate(now);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleStart() {
    if (!event) return;
    setStarting(true);
    try {
      const updated = await eventsApi.start(event.id);
      setEvent(updated);
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
    const updated = await eventsApi.unpublish(event.id);
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

  const eventNavTabs = buildEventNavTabs({
    current: "inicio",
    onNavigateHome: () => navigate(`/events/${event.id}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.id}/live/schedule`),
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
          className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Bell className="size-5" />
          {MOCK_ALERTS.length > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              {MOCK_ALERTS.length}
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

            {/* Sem ação por enquanto — não há uma visão de linha do
                tempo nesta tela pra "ir até agora" rolar. */}
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
            >
              <Clock className="size-4" />
              Ir para agora
            </button>
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
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                <AlertTriangle className="size-4" />
                ALERTAS
              </span>
              {/* Mockado — ver comentário no topo do arquivo. Sem ação
                  por enquanto. */}
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted"
              >
                Ver todos ({MOCK_ALERTS.length})
              </button>
            </div>
            <div className="mt-1 divide-y divide-border">
              {MOCK_ALERTS.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{alert.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{alert.subtitle}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
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
              value={judges === null ? "—" : String(judges.length)}
              label="Jurados cadastrados"
              onClick={() => setJudgesDialogOpen(true)}
            />
            {/* Mockado — sem tracking de atraso real vs. planejado no
                backend ainda (a pedido do usuário). */}
            <StatTile
              icon={Clock}
              iconClassName="bg-amber-500/10 text-amber-600"
              barClassName="bg-amber-500"
              value="+4 min"
              label="Atraso atual"
              progress={0.3}
            />
            <StatTile
              icon={Trophy}
              iconClassName="bg-blue-500/10 text-blue-600"
              barClassName="bg-blue-500"
              value="0"
              label="Resultados publicados"
              progress={0}
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
      judgeCount={judges === null ? null : judges.length}
      onOpenJudges={() => setJudgesDialogOpen(true)}
      onStart={handleStart}
      onRevert={handleRevert}
      onOpenFullSchedule={() => navigate(`/events/${event.id}/live/schedule`)}
      eventNavItems={eventNavTabs}
      profile={profile}
      onLogout={handleLogout}
    />

    <JudgesSummaryDialog open={judgesDialogOpen} onOpenChange={setJudgesDialogOpen} judges={judges} />
    </>
  );
}
