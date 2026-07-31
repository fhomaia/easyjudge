import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Percent,
  Scale,
  Trophy,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminNotesOverview } from "@/components/scoring/AdminNotesOverview";
import { AthleteNotesOverview } from "@/components/scoring/AthleteNotesOverview";
import { MetricTile, type EventNavTab } from "@/components/EventLiveShared";
import { formatDate } from "@/lib/formatDate";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { formatMinutes } from "@/lib/scheduleTime";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";
import type { JudgePresentationItem } from "@/lib/judgeSchedule";
import { cn } from "@/lib/utils";
import type { Event, JudgeAssignmentsSummary, UserProfile } from "@/api/client";

interface EventLiveNotesDesktopViewProps {
  event: Event;
  profile: UserProfile | null;
  onLogout: () => void;
  eventNavItems: EventNavTab[];
  assignment: JudgeAssignmentsSummary;
  isAdminOrAssessor: boolean;
  isAthlete: boolean;
  functionLines: string[];
  myPresentations: JudgePresentationItem[];
  contestedItems: JudgePresentationItem[];
  nextIndex: number;
  completedCount: number;
  isoToday: string;
  nowLabel: string;
  todayPercent: number;
}

export function EventLiveNotesDesktopView({
  event,
  profile,
  onLogout,
  eventNavItems,
  assignment,
  isAdminOrAssessor,
  isAthlete,
  functionLines,
  myPresentations,
  contestedItems,
  nextIndex,
  completedCount,
  isoToday,
  nowLabel,
  todayPercent,
}: EventLiveNotesDesktopViewProps) {
  const navigate = useNavigate();
  // Separada em destaque (card próprio) além de aparecer na lista com a
  // badge "Próxima" — mesmo raciocínio do design anterior, a pedido do
  // usuário (repetida em destaque no topo, não removida da lista).
  const nextItem = nextIndex >= 0 ? myPresentations[nextIndex] : null;
  const nextDisplay = nextItem ? getScheduleEntryDisplay(nextItem.entry, nextItem.start, nextItem.end, []) : null;

  return (
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

            {assignment.isJudge && (
              <div className="flex shrink-0 items-center gap-3">
                <div className="grid grid-cols-4 gap-2">
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
                  />
                  <MetricTile
                    icon={Percent}
                    iconClassName="bg-amber-500/10 text-amber-600"
                    label="Progresso"
                    value={`${todayPercent}%`}
                    sub="Do dia"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Notificações"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Bell className="size-5" />
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {!assignment.isJudge ? (
            isAdminOrAssessor ? (
              <AdminNotesOverview eventId={event.aliasId} eventName={event.name} />
            ) : isAthlete ? (
              <AthleteNotesOverview eventId={event.aliasId} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Você não está escalado como jurado neste evento.
              </div>
            )
          ) : (
            <div>
              {nextItem ? (
                <div className="mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold tracking-wide text-white/70">PRÓXIMA APRESENTAÇÃO</p>
                    {nextItem.dayDate !== isoToday && (
                      <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">
                        {formatDate(nextItem.dayDate)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-2xl leading-tight font-bold">{nextDisplay?.title}</p>
                      {nextDisplay?.subtitle && <p className="truncate text-white/80">{nextDisplay.subtitle}</p>}
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
                        <MapPin className="size-4" />
                        {nextItem.resourceName} · {formatMinutes(nextItem.start)}
                      </p>
                      {nextItem.entry.contestationRequestedAt && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-white">
                          <AlertTriangle className="size-3.5" />
                          Contestação solicitada
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${event.aliasId}/live/scoring/${nextItem.entry.id}`)}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
                    >
                      Iniciar avaliação
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              ) : myPresentations.length > 0 ? (
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-6 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Você concluiu todas as suas apresentações.
                </div>
              ) : (
                <div className="mb-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhuma apresentação pendente pra você julgar.
                </div>
              )}

              {contestedItems.length > 0 && (
                <div className="mb-4 rounded-2xl border border-red-300/50 bg-red-500/5 p-2">
                  <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-red-600">CONTESTAÇÕES</p>
                  <div className="mt-1 divide-y divide-red-300/30">
                    {contestedItems.map((item) => {
                      const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
                      return (
                        <button
                          key={item.entry.id}
                          type="button"
                          onClick={() => navigate(`/events/${event.aliasId}/live/scoring/${item.entry.id}`)}
                          className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-red-500/10"
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

              <div className="rounded-2xl border border-border bg-card p-2">
              <p className="px-3 pt-3 text-xs font-semibold tracking-wide text-muted-foreground">
                MINHAS APRESENTAÇÕES
              </p>
              {myPresentations.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma apresentação pendente pra você julgar.
                </p>
              ) : (
                <div className="mt-1 divide-y divide-border">
                  {myPresentations.map((item, index) => {
                    const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
                    const isNext = index === nextIndex;
                    const contested = Boolean(item.entry.contestationRequestedAt);
                    const withdrawn = Boolean(item.entry.withdrawnAt);
                    return (
                      <button
                        key={item.entry.id}
                        type="button"
                        disabled={withdrawn}
                        onClick={() => navigate(`/events/${event.aliasId}/live/scoring/${item.entry.id}`)}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-xl p-3 text-left",
                          withdrawn
                            ? "cursor-default opacity-60"
                            : isNext
                              ? "bg-primary/5 ring-1 ring-primary/30"
                              : "hover:bg-muted",
                        )}
                      >
                        <div className="w-16 shrink-0">
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
                        <div className="flex shrink-0 items-center gap-2">
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
