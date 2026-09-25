import { useCallback, useEffect, useMemo, useState } from "react";
import { useMinimumLoading } from "@/lib/useMinimumLoading";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRightLeft,
  Building2,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  MoreVertical,
  Play,
  Search,
  Square,
  Trophy,
  XCircle,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import {
  ENTRY_VISUALS,
  EventLiveBottomNav,
  buildEventNavTabs,
  scheduleItemTitleParts,
} from "@/components/EventLiveShared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MovePresentationDialog } from "@/components/MovePresentationDialog";
import { WithdrawPresentationDialog } from "@/components/WithdrawPresentationDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { REALTIME_FALLBACK_POLL_MS, useEventLiveSocket } from "@/lib/useEventLiveSocket";
import { resolveCenterTab, resolveNotesHref } from "@/lib/eventNavPriority";
import { formatDate } from "@/lib/formatDate";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { formatMinutes } from "@/lib/scheduleTime";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";
import {
  computeFullSchedule,
  filterFullSchedule,
  scheduleFilterCategory,
  type ScheduleFilterCategory,
  type FullScheduleItem,
} from "@/lib/eventFullSchedule";
import { computeEventLiveSchedule, liveNextLabel } from "@/lib/eventLiveSchedule";
import { LivePulseDot } from "@/components/LivePulseDot";
import { exportScheduleToExcel, exportScheduleToPdf } from "@/lib/scheduleExport";
import { cn } from "@/lib/utils";
import { useExpandedIds } from "@/lib/useExpandedIds";
import {
  eventsApi,
  notificationsApi,
  scheduleApi,
  scoringApi,
  teamScoringApi,
  teamsApi,
  usersApi,
  type Event,
  type ScheduleDay,
  type ScheduleEntryType,
  type TeamWithProgram,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

const FILTER_ORDER: ScheduleFilterCategory[] = ["presentation", "warmup", "special", "break"];

const FILTER_LABELS: Record<ScheduleFilterCategory, string> = {
  presentation: "Apresentações",
  warmup: "Aquecimentos",
  special: "Eventos especiais",
  break: "Intervalos",
};

// Ícone/cor do chip: "Eventos especiais" usa o visual de abertura.
const FILTER_VISUALS: Record<ScheduleFilterCategory, (typeof ENTRY_VISUALS)[ScheduleEntryType]> = {
  presentation: ENTRY_VISUALS.presentation,
  warmup: ENTRY_VISUALS.warmup,
  special: ENTRY_VISUALS.ceremony,
  break: ENTRY_VISUALS.break,
};

export function EventLiveSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id, { allowSpectator: true });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const scheduleRows = useExpandedIds();
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [teams, setTeams] = useState<TeamWithProgram[] | null>(null);
  const [completedEntryIds, setCompletedEntryIds] = useState<string[]>([]);
  const [startedEntryIds, setStartedEntryIds] = useState<string[]>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState<number | null>(null);
  const [myTeamIds, setMyTeamIds] = useState<string[] | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<FullScheduleItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FullScheduleItem | null>(null);
  // Evento especial: sinalizar início/fim, sempre com confirmação (sem
  // desfazer — pedido do usuário).
  const [signalTarget, setSignalTarget] = useState<{
    item: FullScheduleItem;
    action: "start" | "end";
  } | null>(null);

  const [search, setSearch] = useState("");
  // "Intervalos" (só as esperas automáticas) começa oculto por padrão
  // pra todo mundo (2026-07-27, a pedido do usuário) — só admin/assessor
  // conseguem reexibi-lo (ver botão de filtro abaixo, escondido pra quem
  // não é). Eventos especiais (batalhas, almoço etc.) têm chip próprio.
  const [selectedTypes, setSelectedTypes] = useState<Set<ScheduleFilterCategory>>(
    new Set(FILTER_ORDER.filter((t) => t !== "break")),
  );
  const [teamId, setTeamId] = useState("all");
  const [programId, setProgramId] = useState("all");

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
    scheduleApi.listDays(id).then(setDays).catch(() => setDays([]));
    teamsApi.listForEvent(id).then(setTeams).catch(() => setTeams([]));
  }, [id]);

  // Badge da aba "Notificações" (ver EventLiveShared) — atualizado via
  // WebSocket junto com o resto desta tela (ver useEventLiveSocket
  // abaixo), sem precisar de um polling próprio.
  const refreshUnreadCount = useCallback(() => {
    if (!id) return;
    notificationsApi
      .list(id)
      .then((res) => setNotificationsUnreadCount(res.unreadCount))
      .catch(() => setNotificationsUnreadCount(null));
  }, [id]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // "Acontecendo agora" — mesmo sinal real (ScoringService.
  // getCompletedPresentationIds) e mesma regra de ordem usada na tela de
  // Início (ver lib/eventLiveSchedule.ts), pra ficar alinhado: aqui só
  // reaproveita pra destacar a linha/gerar o card, não recalcula nada
  // diferente. Atualizado via WebSocket; o `setInterval` é só rede de
  // segurança (ver REALTIME_FALLBACK_POLL_MS).
  const refreshCompletedPresentations = useCallback(() => {
    if (!id) return;
    scoringApi.getCompletedPresentations(id).then(setCompletedEntryIds).catch(() => {});
  }, [id]);

  // Apresentações já iniciadas por algum jurado (primeiro "Iniciar" do
  // cronômetro) — só elas viram "Acontecendo agora"; antes disso o card
  // mostra "Próxima apresentação".
  const refreshStartedPresentations = useCallback(() => {
    if (!id) return;
    scoringApi
      .getStartedPresentations(id)
      .then((rows) => setStartedEntryIds(rows.map((r) => r.scheduleEntryId)))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const refresh = () => {
      refreshCompletedPresentations();
      refreshStartedPresentations();
    };
    refresh();
    const interval = setInterval(refresh, REALTIME_FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [id, refreshCompletedPresentations, refreshStartedPresentations]);

  // Sinal do backend (ver CLAUDE.md "Tempo real") — uma notificação nova
  // pode significar apresentação movida/concluída/desistência/
  // contestação, então recarrega o cronograma inteiro (mesma função já
  // usada depois de uma desistência confirmada, ver refreshDays abaixo)
  // além do badge e do "acontecendo agora".
  useEventLiveSocket(id, {
    onNotification: () => {
      refreshDays();
      refreshUnreadCount();
      refreshCompletedPresentations();
      refreshStartedPresentations();
    },
    onEventStatusChanged: () => {
      if (!id) return;
      eventsApi.get(id).then(setEvent).catch(() => {});
    },
  });

  // Mesmo redirect da EventLiveDashboardPage — esta tela só faz sentido
  // pra um evento já publicado/em andamento/concluído.
  useEffect(() => {
    if (!event) return;
    if (event.status === "created") navigate(`/events/${event.aliasId}/setup`, { replace: true });
  }, [event, navigate]);

  // Só pra decidir em quais linhas um Programa vê "Sinalizar
  // desistência" (só das próprias equipes) — admin/assessor não precisa
  // disso, vê em qualquer apresentação.
  useEffect(() => {
    if (!id || !event?.currentUserRoles.includes("program")) return;
    teamScoringApi
      .getMyTeamIds(id)
      .then(setMyTeamIds)
      .catch(() => setMyTeamIds(null));
  }, [id, event]);

  // Se o programa selecionado mudar e a equipe escolhida não pertencer
  // mais a ele, volta o filtro de equipe pra "todas" em vez de deixar um
  // filtro "impossível" (equipe de outro programa) selecionado.
  useEffect(() => {
    if (programId === "all" || teamId === "all") return;
    const team = teams?.find((t) => t.id === teamId);
    if (team && team.program.id !== programId) setTeamId("all");
  }, [programId, teamId, teams]);

  const fullSchedule = useMemo(() => computeFullSchedule(days ?? []), [days]);

  const withdrawnPresentationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const day of days ?? []) {
      for (const resource of day.resources) {
        for (const entry of resource.entries) {
          if (entry.type === "presentation" && entry.withdrawnAt) ids.add(entry.id);
        }
      }
    }
    return ids;
  }, [days]);

  const completedEntryIdSet = useMemo(() => new Set(completedEntryIds), [completedEntryIds]);
  const live = useMemo(
    () => computeEventLiveSchedule(days ?? [], completedEntryIdSet, new Set(startedEntryIds)),
    [days, completedEntryIdSet, startedEntryIds],
  );
  const currentItem = live.next;
  const currentEntryId = currentItem?.entry.id ?? null;
  const currentDisplay = currentItem ? scheduleItemTitleParts(currentItem) : null;

  const teamProgramMap = useMemo(() => {
    const map = new Map<string, string>();
    (teams ?? []).forEach((t) => map.set(t.id, t.program.id));
    return map;
  }, [teams]);

  // Mesmo mapa de `teamProgramMap`, mas de id pra nome — usado só pela
  // coluna "Programa" do PDF exportado (ver scheduleExport.ts), que
  // mostra o nome, não o id.
  const teamProgramNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (teams ?? []).forEach((t) => map.set(t.id, t.program.name));
    return map;
  }, [teams]);

  const programOptions = useMemo(() => {
    const map = new Map<string, string>();
    (teams ?? []).forEach((t) => map.set(t.program.id, t.program.name));
    return Array.from(map.entries())
      .map(([progId, name]) => ({ id: progId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [teams]);

  const teamOptions = useMemo(() => {
    return (teams ?? [])
      .filter((t) => programId === "all" || t.program.id === programId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [teams, programId]);

  const filteredItems = useMemo(
    () =>
      filterFullSchedule(
        fullSchedule,
        {
          categories: selectedTypes,
          teamId: teamId === "all" ? null : teamId,
          programId: programId === "all" ? null : programId,
          search,
        },
        teamProgramMap,
      ),
    [fullSchedule, selectedTypes, teamId, programId, search, teamProgramMap],
  );

  const groupedByDay = useMemo(() => {
    const map = new Map<string, FullScheduleItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.dayDate) ?? [];
      list.push(item);
      map.set(item.dayDate, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function toggleType(type: ScheduleFilterCategory) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Recarrega o cronograma depois de uma desistência confirmada — a
  // apresentação some/fica marcada dependendo da escolha do admin (ver
  // WithdrawPresentationDialog), mais simples que atualizar o estado
  // local na mão em duas variações.
  function refreshDays() {
    if (!id) return;
    scheduleApi.listDays(id).then(setDays).catch(() => {});
  }

  // Sem try/catch: o ConfirmDialog mostra o erro e mantém o popup aberto.
  async function handleSignalConfirm() {
    if (!id || !signalTarget) return;
    const { item, action } = signalTarget;
    await scheduleApi.signalSpecialEvent(id, item.dayId, item.entry.id, action);
    refreshDays();
  }

  async function handleWithdrawConfirm(removeFromSchedule: boolean) {
    if (!id || !withdrawTarget) return;
    await scoringApi.withdrawPresentation(id, withdrawTarget.entry.id, { removeFromSchedule });
    refreshDays();
  }

  async function handleMoveConfirm(resourceId: string, order: number) {
    if (!id || !moveTarget) return;
    await scheduleApi.moveEntry(id, moveTarget.dayId, moveTarget.entry.id, { resourceId, order });
    refreshDays();
  }

  // Meio segundo no mínimo (useMinimumLoading), pro raio não piscar.
  const showLoading = useMinimumLoading(!event || !days || !teams);
  if (showLoading || !event || !days || !teams) {
    return (
      <RouteLoadingFallback />
    );
  }

  const isAdminOrAssessor = event.currentUserRoles.some((r) => r === "admin" || r === "assessor");
  const isProgram = event.currentUserRoles.includes("program");
  const myTeamIdSet = new Set(myTeamIds ?? []);

  const eventNavTabs = buildEventNavTabs({
    current: "cronograma",
    event,
    onNavigateHome: () => navigate(`/events/${event.aliasId}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.aliasId}/live/schedule`),
    onNavigateNotes: () => navigate(resolveNotesHref(event.aliasId, event.currentUserRoles)),
    onNavigateResults: () => navigate(`/events/${event.aliasId}/live/results`),
    onNavigateNotifications: () => navigate(`/events/${event.aliasId}/live/notifications`),
    notificationsUnreadCount: notificationsUnreadCount ?? undefined,
    centerTab: resolveCenterTab(event.currentUserRoles),
  });

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} eventNavItems={eventNavTabs} />

      <main className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto pt-14 sm:pt-0">
        <header className="border-b border-border bg-card px-4 py-5 sm:px-8">
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

        {/* Antes era `flex-1 overflow-hidden` com só a lista abaixo
            rolando por dentro (`min-h-0 flex-1 overflow-y-auto`) —
            cabeçalho fixo + lista com scroll próprio. Bug real em
            produção (2026-08-05, evento com nome/filtros grandes o
            bastante num celular pequeno): o cabeçalho (título+filtros+
            "acontecendo agora") sozinho já podia consumir a viewport
            inteira, sobrando 0px pra lista — como tudo ao redor tinha
            `overflow-hidden`, o resto do cronograma ficava
            inacessível, sem scroll nenhum pra alcançar. Trocado pra
            fluxo normal (`main` com `overflow-y-auto`, sem `flex-1`/
            `overflow-hidden` aninhados) — a página inteira rola junto,
            perde o "cabeçalho fixo" mas garante que dá sempre pra
            chegar no resto do conteúdo. */}
        <div className="flex w-full flex-col px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Cronograma completo</h2>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
                <Download className="size-4" />
                Baixar
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportScheduleToPdf(event.name, filteredItems, teamProgramNameMap, withdrawnPresentationIds)
                  }
                >
                  <FileText data-icon="inline-start" />
                  Baixar como PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportScheduleToExcel(event.name, filteredItems, withdrawnPresentationIds)}>
                  <FileSpreadsheet data-icon="inline-start" />
                  Baixar como Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por equipe, categoria..."
                className="pl-11"
              />
            </div>

            <div className="flex flex-row gap-3">
              <Select value={programId} onValueChange={(value) => setProgramId(value ?? "all")}>
                <SelectTrigger className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <SelectValue>
                    {(value: string) =>
                      value === "all"
                        ? "Programas"
                        : (programOptions.find((p) => p.id === value)?.name ?? value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Programas</SelectItem>
                  {programOptions.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={teamId} onValueChange={(value) => setTeamId(value ?? "all")}>
                <SelectTrigger className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <SelectValue>
                    {(value: string) =>
                      value === "all"
                        ? "Equipes"
                        : (teamOptions.find((t) => t.id === value)?.name ?? value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Equipes</SelectItem>
                  {teamOptions.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_ORDER.filter((type) => type !== "break" || isAdminOrAssessor).map((type) => {
                const visual = FILTER_VISUALS[type];
                const Icon = visual.icon;
                const selected = selectedTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? cn("border-transparent", visual.className)
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {FILTER_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {currentItem && currentDisplay && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                {(() => {
                  const Icon = ENTRY_VISUALS[currentItem.entry.type].icon;
                  return <Icon className="size-5" />;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-violet-600">
                  {live.nextIsLive && <LivePulseDot />}
                  {live.nextIsLive ? "ACONTECENDO AGORA" : liveNextLabel(live)}
                </p>
                <p className="truncate text-base font-semibold text-foreground">{currentDisplay.title}</p>
                {currentDisplay.subtitle && (
                  <p className="truncate text-sm text-muted-foreground">{currentDisplay.subtitle}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-foreground">{formatMinutes(currentItem.start)}</p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {currentItem.resourceName}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            {groupedByDay.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {fullSchedule.length === 0
                  ? "Nenhuma apresentação cadastrada no cronograma ainda."
                  : "Nenhum item encontrado com esses filtros."}
              </p>
            ) : (
              <div className="grid min-w-0 gap-6">
                {groupedByDay.map(([dayDate, items]) => (
                  <div key={dayDate} className="min-w-0">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                      {formatDate(dayDate).toUpperCase()}
                    </p>
                    <div className="rounded-2xl border border-border bg-card p-2 sm:p-3">
                      <div className="divide-y divide-border">
                        {items.map((item) => {
                          const visual = ENTRY_VISUALS[item.entry.type];
                          const Icon = visual.icon;
                          const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
                          const isCurrent = item.entry.id === currentEntryId;
                          // Aquecimento de apresentação desistida segue o
                          // mesmo visual dela (esmaecido + selo).
                          const withdrawn =
                            Boolean(item.entry.withdrawnAt) ||
                            (item.entry.type === "warmup" &&
                              withdrawnPresentationIds.has(item.entry.linkedEntryId ?? ""));
                          const canWithdraw =
                            item.entry.type === "presentation" &&
                            !withdrawn &&
                            (isAdminOrAssessor ||
                              (isProgram && myTeamIdSet.has(item.entry.teamId ?? "")));
                          // Só admin/assessor (pedido explícito do
                          // usuário) — mudar equipe de programa não
                          // decide onde a própria apresentação entra no
                          // cronograma, só sinaliza desistência.
                          const canMove =
                            item.entry.type === "presentation" && !withdrawn && isAdminOrAssessor;
                          // Evento especial (Almoço, Premiação...): admin/
                          // assessor sinaliza início/fim com o evento iniciado.
                          const isSpecial = scheduleFilterCategory(item.entry) === "special";
                          const canSignalStart =
                            isSpecial && isAdminOrAssessor && event.status === "started" && !item.entry.startedAt;
                          const canSignalEnd =
                            isSpecial &&
                            isAdminOrAssessor &&
                            event.status === "started" &&
                            Boolean(item.entry.startedAt) &&
                            !item.entry.endedAt;
                          const expanded = scheduleRows.isExpanded(item.entry.id);
                          return (
                            <div
                              key={item.entry.id}
                              role="button"
                              tabIndex={0}
                              aria-expanded={expanded}
                              onClick={() => scheduleRows.toggle(item.entry.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  scheduleRows.toggle(item.entry.id);
                                }
                              }}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 first:pt-1 last:pb-1",
                                isCurrent && "bg-violet-500/5 ring-1 ring-violet-500/30",
                                withdrawn && "opacity-60",
                              )}
                            >
                              <div className="w-14 shrink-0">
                                <p className="text-sm font-medium text-foreground">
                                  {formatMinutes(item.start)}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                  visual.className,
                                )}
                              >
                                <Icon className="size-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "flex items-center gap-1.5 text-sm font-medium text-foreground",
                                    expanded ? "flex-wrap break-words" : "truncate",
                                  )}
                                >
                                  {display.title}
                                  {isCurrent && (
                                    <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                                      {live.nextIsLive ? "AGORA" : "PRÓXIMA"}
                                    </span>
                                  )}
                                </p>
                                {display.subtitle && (
                                  <p
                                    className={cn(
                                      "text-xs text-muted-foreground",
                                      expanded ? "break-words" : "truncate",
                                    )}
                                  >
                                    {display.subtitle}
                                  </p>
                                )}
                                {/* No celular a pista não cabe na linha (o selo à
                                    direita só aparece a partir de `sm`), então
                                    vem junto com o texto completo ao abrir. */}
                                {expanded && (
                                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
                                    <MapPin className="size-3" />
                                    {item.resourceName}
                                  </p>
                                )}
                              </div>
                              {withdrawn && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
                                  <XCircle className="size-3.5" />
                                  Desistência
                                </span>
                              )}
                              <span className="hidden shrink-0 truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:block">
                                {item.resourceName}
                              </span>
                              {isSpecial && item.entry.endedAt && (
                                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                  Encerrado
                                </span>
                              )}
                              {(canWithdraw || canMove || canSignalStart || canSignalEnd) && (
                                // Menu "⋯" não abre/fecha a linha.
                                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <button
                                        type="button"
                                        aria-label="Mais opções"
                                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                      />
                                    }
                                  >
                                    <MoreVertical className="size-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {canMove && (
                                      <DropdownMenuItem onClick={() => setMoveTarget(item)}>
                                        <ArrowRightLeft data-icon="inline-start" />
                                        Mover apresentação
                                      </DropdownMenuItem>
                                    )}
                                    {canWithdraw && (
                                      <DropdownMenuItem onClick={() => setWithdrawTarget(item)}>
                                        <XCircle data-icon="inline-start" />
                                        Sinalizar desistência
                                      </DropdownMenuItem>
                                    )}
                                    {canSignalStart && (
                                      <DropdownMenuItem onClick={() => setSignalTarget({ item, action: "start" })}>
                                        <Play data-icon="inline-start" />
                                        Sinalizar início
                                      </DropdownMenuItem>
                                    )}
                                    {canSignalEnd && (
                                      <DropdownMenuItem onClick={() => setSignalTarget({ item, action: "end" })}>
                                        <Square data-icon="inline-start" />
                                        Encerrar
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <EventLiveBottomNav tabs={eventNavTabs} className="sticky bottom-0 z-20 sm:hidden" />
      </main>

      <WithdrawPresentationDialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        teamName={withdrawTarget?.entry.teamName ?? "Equipe"}
        canRemoveFromSchedule={isAdminOrAssessor}
        onConfirm={handleWithdrawConfirm}
      />

      <ConfirmDialog
        open={signalTarget !== null}
        onOpenChange={(open) => !open && setSignalTarget(null)}
        title={
          signalTarget?.action === "end"
            ? `Encerrar ${signalTarget.item.entry.label ?? "evento"}?`
            : `Sinalizar início de ${signalTarget?.item.entry.label ?? "evento"}?`
        }
        description={
          signalTarget?.action === "end"
            ? "Todos do evento serão avisados que terminou. Não é possível desfazer."
            : "Todos do evento serão avisados que começou, e ele passa a aparecer como acontecendo agora. Não é possível desfazer."
        }
        confirmLabel={signalTarget?.action === "end" ? "Encerrar" : "Sinalizar início"}
        confirmingLabel="Salvando..."
        onConfirm={handleSignalConfirm}
      />

      <MovePresentationDialog
        item={moveTarget}
        day={days.find((d) => d.id === moveTarget?.dayId) ?? null}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        onConfirm={handleMoveConfirm}
      />
    </div>
  );
}
