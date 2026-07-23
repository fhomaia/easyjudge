import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  Hourglass,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Play,
  Trophy,
  Users,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { BlinkingDot } from "@/components/BlinkingDot";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ENTRY_VISUALS,
  MOCK_ALERTS,
  StatTile,
  scheduleItemTitleParts,
  type EventNavTab,
} from "@/components/EventLiveShared";
import { formatDate } from "@/lib/formatDate";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { formatMinutes } from "@/lib/scheduleTime";
import { computeResourceNextStatus, toIsoDate, type EventLiveSchedule } from "@/lib/eventLiveSchedule";
import { cn } from "@/lib/utils";
import type { Event, ScheduleDay, UserProfile } from "@/api/client";

function formatStartedAt(startedAt: string, isoToday: string): string {
  const d = new Date(startedAt);
  const dateIso = toIsoDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return dateIso === isoToday
    ? `Iniciado hoje, ${hh}:${mm}`
    : `Iniciado em ${formatDate(dateIso)}, ${hh}:${mm}`;
}

interface EventLiveDesktopViewProps {
  event: Event;
  live: EventLiveSchedule;
  days: ScheduleDay[] | null;
  isoToday: string;
  nowMinutes: number;
  canStart: boolean;
  starting: boolean;
  judgeCount: number | null;
  onOpenJudges: () => void;
  onStart: () => void;
  onRevert: () => Promise<void>;
  onOpenFullSchedule: () => void;
  eventNavItems: EventNavTab[];
  profile: UserProfile | null;
  onLogout: () => void;
}

export function EventLiveDesktopView({
  event,
  live,
  days,
  isoToday,
  nowMinutes,
  canStart,
  starting,
  judgeCount,
  onOpenJudges,
  onStart,
  onRevert,
  onOpenFullSchedule,
  eventNavItems,
  profile,
  onLogout,
}: EventLiveDesktopViewProps) {
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);

  // Só dá pra reverter uma publicação (published -> created) — evento
  // "started" não tem esse caminho de volta ainda (decisão consciente,
  // ver EventsService.unpublishEvent). Admin e assessor podem reverter
  // (mesmo par de papéis que já pode editar as configurações do
  // evento, ver updateEvent no backend).
  const canRevert =
    event.currentUserRoles.some((r) => r === "admin" || r === "assessor") &&
    event.status === "published";

  const resourceStatuses = useMemo(
    () => computeResourceNextStatus(days ?? [], live, event.status === "started", isoToday, nowMinutes),
    [days, live, isoToday, nowMinutes, event.status],
  );

  const nextDisplay = live.next ? scheduleItemTitleParts(live.next) : null;
  const warmupTotal = live.next?.warmup ? live.next.warmup.end - live.next.warmup.start : 0;
  const warmupElapsed = live.next?.warmup
    ? Math.min(warmupTotal, Math.max(0, nowMinutes - live.next.warmup.start))
    : 0;

  const scheduleRows = live.next ? [live.next, ...live.upcoming] : live.upcoming;
  const visibleRows = showAllUpcoming ? scheduleRows : scheduleRows.slice(0, 6);

  return (
    <>
    <div className="hidden h-svh lg:flex">
      <AppSidebar profile={profile} onLogout={onLogout} eventNavItems={eventNavItems} />
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-card px-8 py-5">
        <div className="flex items-center justify-between gap-6">
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

          <div className="flex shrink-0 items-center gap-2">
            {/* Sem ação por enquanto — não há uma visão de linha do
                tempo nesta tela pra "ir até agora" rolar. */}
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Play className="size-4" />
              Ir para agora
            </button>
            {canRevert ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Mais opções"
                      className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setRevertDialogOpen(true)}
                    className="whitespace-nowrap"
                  >
                    Reverter publicação
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                aria-label="Mais opções"
                className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
              >
                <MoreHorizontal className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          {event.status === "started" ? (
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <BlinkingDot colorClassName="bg-emerald-500" />
              Evento em andamento
              {event.startedAt && (
                <span className="font-normal text-muted-foreground">
                  · {formatStartedAt(event.startedAt, isoToday)}
                </span>
              )}
            </span>
          ) : canStart ? (
            <button
              type="button"
              onClick={onStart}
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
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto p-8">
        <div className="grid shrink-0 grid-cols-4 gap-4">
          {/* PRÓXIMA APRESENTAÇÃO */}
          <div className="rounded-2xl border border-border bg-card p-4">
            {live.next ? (
              <>
                <p className="text-xs font-semibold tracking-wide text-violet-600">
                  {live.next.entry.type === "presentation" ? "PRÓXIMA APRESENTAÇÃO" : "A SEGUIR"}
                </p>
                <p className="mt-2 text-2xl font-bold text-violet-600">{formatMinutes(live.next.start)}</p>
                <p className="mt-1 truncate text-base font-semibold text-foreground">{nextDisplay?.title}</p>
                {nextDisplay?.subtitle && (
                  <p className="truncate text-sm text-muted-foreground">{nextDisplay.subtitle}</p>
                )}
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {live.next.resourceName}
                </p>
                {live.next.warmup &&
                  (live.next.dayDate === isoToday ? (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{
                            width: `${warmupTotal > 0 ? Math.min(100, (warmupElapsed / warmupTotal) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Warm-up: {formatMinutes(live.next.warmup.start)} - {formatMinutes(live.next.warmup.end)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Warm-up: {formatMinutes(live.next.warmup.start)} - {formatMinutes(live.next.warmup.end)}
                    </p>
                  ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {live.total === 0
                  ? "Nenhuma apresentação cadastrada no cronograma ainda."
                  : "Todas as apresentações já aconteceram."}
              </p>
            )}
          </div>

          {/* AQUECENDO */}
          <div className="rounded-2xl border border-border bg-amber-500/5 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600">
              <Flame className="size-3.5" />
              AQUECENDO
            </p>
            {live.nextWarmup ? (
              <>
                <p className="mt-2 truncate text-base font-semibold text-foreground">
                  {live.nextWarmup.teamName}
                </p>
                {live.nextWarmup.categoryName && (
                  <p className="truncate text-sm text-muted-foreground">{live.nextWarmup.categoryName}</p>
                )}
                {live.nextWarmup.presentationResourceName && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {live.nextWarmup.presentationResourceName}
                  </p>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {formatMinutes(live.nextWarmup.start)} - {formatMinutes(live.nextWarmup.end)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum aquecimento pendente no cronograma.</p>
            )}
          </div>

          {/* AGORA EM CADA PISTA */}
          <div className="rounded-2xl border border-border bg-emerald-500/5 p-4">
            <p className="text-xs font-semibold tracking-wide text-emerald-700">AGORA EM CADA PISTA</p>
            {resourceStatuses.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma pista configurada no cronograma.</p>
            ) : (
              <div className="mt-2.5 grid gap-3">
                {resourceStatuses.map((resource) => {
                  const Icon = resource.next
                    ? resource.next.isAutoWait
                      ? Hourglass
                      : ENTRY_VISUALS[resource.next.type].icon
                    : null;
                  return (
                    <div key={resource.resourceId} className="flex items-start gap-2 text-sm">
                      <span className="mt-[3px] size-2 shrink-0 rounded-full border border-emerald-500/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-foreground">{resource.resourceName}</span>
                          {resource.next && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatMinutes(resource.next.start)}
                              {resource.next.dayDate !== isoToday ? ` · ${formatDate(resource.next.dayDate)}` : ""}
                            </span>
                          )}
                        </div>
                        {resource.next ? (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            {Icon && <Icon className="size-3 shrink-0" />}
                            {resource.next.subtitle
                              ? `${resource.next.title} · ${resource.next.subtitle}`
                              : resource.next.title}
                          </p>
                        ) : (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Sem mais atividades agendadas.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ALERTAS */}
          <div className="rounded-2xl border border-border bg-red-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-red-600">
                <AlertTriangle className="size-3.5" />
                ALERTAS
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white">
                {MOCK_ALERTS.length}
              </span>
            </div>
            <div className="mt-2 divide-y divide-border">
              {MOCK_ALERTS.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className="flex w-full items-center gap-2 py-2 text-left first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{alert.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{alert.subtitle}</p>
                  </div>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            {/* Sem ação por enquanto — sem tela de alertas ainda. */}
            <button
              type="button"
              className="mt-1 text-xs font-medium text-red-600 hover:underline"
            >
              Ver todos os alertas
            </button>
          </div>
        </div>

        <div className="mt-4 grid flex-1 grid-cols-3 gap-4">
          <div className="col-span-2 flex flex-col rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="size-4" />
                CRONOGRAMA — PRÓXIMAS APRESENTAÇÕES
              </span>
              <button
                type="button"
                onClick={onOpenFullSchedule}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver cronograma completo
              </button>
            </div>

            {visibleRows.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
                {live.total === 0
                  ? "Nenhuma apresentação cadastrada no cronograma ainda."
                  : "Todas as apresentações já aconteceram."}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-border overflow-y-auto">
                {visibleRows.map((item, index) => {
                  const display = scheduleItemTitleParts(item);
                  const visual = ENTRY_VISUALS[item.entry.type];
                  const Icon = visual.icon;
                  const isNext = index === 0 && live.next?.entry.id === item.entry.id;
                  const warmupActive =
                    item.warmup && item.dayDate === isoToday
                      ? nowMinutes >= item.warmup.start && nowMinutes < item.warmup.end
                      : false;
                  return (
                    <div
                      key={item.entry.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          isNext ? "bg-violet-500" : "border border-muted-foreground/40",
                        )}
                      />
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-medium text-foreground">{formatMinutes(item.start)}</p>
                        {item.dayDate !== isoToday && (
                          <p className="text-[10px] text-muted-foreground">{formatDate(item.dayDate)}</p>
                        )}
                      </div>
                      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", visual.className)}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{display.title}</p>
                        {display.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{display.subtitle}</p>
                        )}
                      </div>
                      <span className="w-28 shrink-0 truncate rounded-full bg-primary/10 px-2.5 py-1 text-center text-xs font-medium text-primary">
                        {item.resourceName}
                      </span>
                      <span
                        className={cn(
                          "w-24 shrink-0 text-xs",
                          warmupActive ? "font-medium text-amber-600" : "text-muted-foreground",
                        )}
                      >
                        {item.warmup ? `${formatMinutes(item.warmup.start)} warm-up` : "–"}
                      </span>
                      <button
                        type="button"
                        aria-label="Mais opções"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {scheduleRows.length > visibleRows.length && (
              <button
                type="button"
                onClick={() => setShowAllUpcoming(true)}
                className="mt-3 w-full text-center text-xs font-medium text-primary hover:underline"
              >
                Ver mais apresentações
              </button>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">RESUMO DO EVENTO</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <StatTile
                  icon={CalendarDays}
                  iconClassName="bg-violet-500/10 text-violet-600"
                  barClassName="bg-violet-500"
                  value={`${live.completed} / ${live.total}`}
                  label="Apresentações realizadas"
                  progress={live.total > 0 ? live.completed / live.total : 0}
                />
                <StatTile
                  icon={Users}
                  iconClassName="bg-emerald-500/10 text-emerald-600"
                  value={judgeCount === null ? "—" : String(judgeCount)}
                  label="Jurados cadastrados"
                  onClick={onOpenJudges}
                />
                {/* Mockado — sem tracking de atraso real vs. planejado
                    no backend ainda (a pedido do usuário). */}
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

            {live.nextCategoryChange && (
              <div className="rounded-2xl border border-border bg-violet-500/5 p-4">
                <p className="text-xs font-semibold tracking-wide text-violet-600">PRÓXIMA CATEGORIA</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {live.nextCategoryChange.categoryName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {live.nextCategoryChange.dayDate === isoToday
                        ? `Em ${Math.max(0, Math.round(live.nextCategoryChange.start - nowMinutes))} min`
                        : formatDate(live.nextCategoryChange.dayDate)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>

    <ConfirmDialog
      open={revertDialogOpen}
      onOpenChange={setRevertDialogOpen}
      title="Reverter publicação?"
      description="O evento volta para o status Criado e você pode editar as configurações novamente. Ele deixa de ficar visível para os participantes até ser publicado de novo."
      confirmLabel="Reverter"
      confirmingLabel="Revertendo..."
      onConfirm={onRevert}
    />
    </>
  );
}
