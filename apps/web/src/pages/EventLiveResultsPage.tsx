import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, CalendarDays, ChevronDown, MapPin, Medal, Star, Trophy, Users } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { EventLiveBottomNav, buildEventNavTabs } from "@/components/EventLiveShared";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { resolveCenterTab } from "@/lib/eventNavPriority";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { formatPercent, formatPoints } from "@/lib/formatNumber";
import { FORMAT_LABELS } from "@/lib/categoryLabels";
import { cn } from "@/lib/utils";
import {
  eventsApi,
  resultsApi,
  usersApi,
  type Event,
  type EventResults,
  type EventResultsResponse,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

type ResultsTab = "ranking" | "categoria" | "equipe" | "programa";

const CATEGORY_COLORS = [
  { bg: "bg-violet-500/10", text: "text-violet-600" },
  { bg: "bg-emerald-500/10", text: "text-emerald-600" },
  { bg: "bg-amber-500/10", text: "text-amber-600" },
  { bg: "bg-blue-500/10", text: "text-blue-600" },
  { bg: "bg-rose-500/10", text: "text-rose-600" },
];

const MEDAL_COLORS = ["text-yellow-400", "text-slate-400", "text-amber-700"];

// Os 3 cards de destaque (maior percentual geral/Team Cheer, programa
// com mais pontos) — no desktop ficam sempre visíveis acima das abas;
// no mobile viram o conteúdo da aba "Ranking geral" (primeira aba, ver
// EventLiveResultsPage). Extraído pra não duplicar o JSX nos dois
// lugares.
function ResultsMetricsGrid({ results }: { results: EventResults }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-violet-300/40 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
            <Star className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-violet-600">Maior percentual geral</p>
            <p className="truncate text-xs text-muted-foreground">Entre todas as categorias</p>
          </div>
        </div>
        {results.topOverall ? (
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{results.topOverall.teamName}</p>
              <p className="truncate text-xs text-muted-foreground">{results.topOverall.categoryName}</p>
            </div>
            <p className="text-2xl font-bold text-violet-600 sm:shrink-0">
              {formatPercent(results.topOverall.percentage)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Sem apresentações pontuadas ainda.</p>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <Users className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-emerald-600">Maior percentual - Team Cheer</p>
            <p className="truncate text-xs text-muted-foreground">Considerando apenas Team Cheer</p>
          </div>
        </div>
        {results.topTeamCheer ? (
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{results.topTeamCheer.teamName}</p>
              <p className="truncate text-xs text-muted-foreground">{results.topTeamCheer.categoryName}</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600 sm:shrink-0">
              {formatPercent(results.topTeamCheer.percentage)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Sem apresentações Team Cheer pontuadas ainda.</p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-300/40 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
            <Trophy className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-amber-600">Programa com mais pontos</p>
            <p className="truncate text-xs text-muted-foreground">Soma de todas as apresentações</p>
          </div>
        </div>
        {results.topProgram ? (
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{results.topProgram.programName}</p>
              <p className="truncate text-xs text-muted-foreground">Total de pontos</p>
            </div>
            <p className="text-2xl font-bold text-amber-600 sm:shrink-0">
              {formatPoints(results.topProgram.totalPoints)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Sem apresentações pontuadas ainda.</p>
        )}
      </div>
    </div>
  );
}

export function EventLiveResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id, { allowSpectator: true });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [resultsResponse, setResultsResponse] = useState<EventResultsResponse | null>(null);
  // "Ranking geral" (métricas de destaque, ver ResultsMetricsGrid) é a
  // primeira aba em qualquer tamanho de tela.
  const [activeTab, setActiveTab] = useState<ResultsTab>("ranking");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    resultsApi.get(id).then(setResultsResponse);
  }, [id]);

  const results = resultsResponse?.results ?? null;

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
    current: "resultados",
    onNavigateHome: () => navigate(`/events/${event.id}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.id}/live/schedule`),
    onNavigateNotes: () => navigate(`/events/${event.id}/live/notes`),
    onNavigateResults: () => navigate(`/events/${event.id}/live/results`),
    centerTab: resolveCenterTab(event.currentUserRoles),
  });

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} eventNavItems={eventNavTabs} />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 sm:pt-0">
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

        <div className="flex w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 sm:py-6">
          {!resultsResponse ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : !resultsResponse.released ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
              <Trophy className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Resultados ainda não liberados</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Em breve você poderá consultar os resultados do campeonato aqui.
              </p>
            </div>
          ) : results ? (
            <div className="flex-1 overflow-y-auto">
              <h2 className="text-xl font-bold text-foreground">Resultados</h2>

              <div className="mt-4 flex items-center gap-1 border-b border-border">
                {(
                  [
                    ["ranking", "Ranking geral"],
                    ["categoria", "Por categoria"],
                    ["equipe", "Por equipe"],
                    ["programa", "Por programa"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      "border-b-2 px-4 py-2.5 text-sm font-medium",
                      activeTab === key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-6 mb-6 rounded-2xl border border-border bg-card">
                {activeTab === "ranking" && (
                  <div className="p-4">
                    <p className="pb-3 text-sm font-bold text-foreground">Ranking geral</p>
                    <ResultsMetricsGrid results={results} />
                  </div>
                )}

                {activeTab === "categoria" && (
                  <div>
                    <p className="px-4 pt-4 text-sm font-bold text-foreground">Resultados por categoria</p>
                    {results.categories.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma apresentação totalmente pontuada ainda.
                      </p>
                    ) : (
                      <div className="mt-3 divide-y divide-border">
                        {results.categories.map((category, index) => {
                          const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                          const isExpanded = expandedCategories.has(category.categoryId);
                          return (
                            <div key={category.categoryId}>
                              <button
                                type="button"
                                onClick={() => toggleCategory(category.categoryId)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                              >
                                <div
                                  className={cn(
                                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                    color.bg,
                                    color.text,
                                  )}
                                >
                                  <Medal className="size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-foreground">{category.categoryName}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {FORMAT_LABELS[category.categoryFormat]} · {category.teamCount} apresentaç
                                    {category.teamCount === 1 ? "ão" : "ões"}
                                  </p>
                                </div>
                                {category.presentations.length > 0 && (
                                  <div className="hidden w-36 shrink-0 flex-col gap-0.5 sm:flex">
                                    {category.presentations.slice(0, 3).map((p, rank) => (
                                      <p
                                        key={p.scheduleEntryId}
                                        className="flex items-center justify-end gap-1 truncate text-xs font-semibold text-foreground"
                                      >
                                        <span className="truncate">{p.teamName}</span>
                                        <Medal className={cn("size-3.5 shrink-0", MEDAL_COLORS[rank])} />
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {category.topByScore && (
                                  <div className="hidden shrink-0 text-right sm:block">
                                    <p className={cn("font-bold", color.text)}>
                                      {formatPoints(category.topByScore.finalResult)}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">pontuação</p>
                                  </div>
                                )}
                                {category.topByPercentage && (
                                  <div className="shrink-0 text-right">
                                    <p className={cn("font-bold", color.text)}>
                                      {formatPercent(category.topByPercentage.percentage)}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">aproveitamento</p>
                                  </div>
                                )}
                                <ChevronDown
                                  className={cn(
                                    "size-4 shrink-0 text-muted-foreground transition-transform",
                                    isExpanded && "rotate-180",
                                  )}
                                />
                              </button>

                              {isExpanded && (
                                <div className="divide-y divide-border border-t border-border bg-muted/20">
                                  {category.presentations.map((p, rank) => (
                                    <div
                                      key={p.scheduleEntryId}
                                      className="flex items-center gap-3 py-2.5 pr-4 pl-14"
                                    >
                                      <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">
                                        {rank + 1}º
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{p.teamName}</p>
                                        <p className="truncate text-xs text-muted-foreground">{p.programName}</p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-sm font-semibold text-foreground">
                                          {formatPoints(p.finalResult)} pts
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatPercent(p.percentage)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                      Percentuais calculados com base na pontuação máxima da categoria. Toque numa categoria pra ver a
                      colocação de todas as equipes.
                    </p>
                  </div>
                )}

                {activeTab === "equipe" && (
                  <div>
                    <p className="px-4 pt-4 text-sm font-bold text-foreground">Ranking por equipe</p>
                    {results.presentations.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma apresentação totalmente pontuada ainda.
                      </p>
                    ) : (
                      <div className="mt-3 divide-y divide-border">
                        {results.presentations.map((p, index) => (
                          <div key={p.scheduleEntryId} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex w-9 shrink-0 items-center gap-1">
                              {index < 3 && <Trophy className={cn("size-4 shrink-0", MEDAL_COLORS[index])} />}
                              <span className="text-sm font-semibold text-muted-foreground">{index + 1}º</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{p.teamName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {p.categoryName} · {p.programName}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-bold text-primary">{formatPercent(p.percentage)}</p>
                              <p className="text-xs text-muted-foreground">{formatPoints(p.finalResult)} pts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "programa" && (
                  <div>
                    <p className="px-4 pt-4 text-sm font-bold text-foreground">Ranking por programa</p>
                    {results.programs.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma apresentação totalmente pontuada ainda.
                      </p>
                    ) : (
                      <div className="mt-3 divide-y divide-border">
                        {results.programs.map((program, index) => (
                          <div key={program.programId} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex w-9 shrink-0 items-center gap-1">
                              {index < 3 && <Trophy className={cn("size-4 shrink-0", MEDAL_COLORS[index])} />}
                              <span className="text-sm font-semibold text-muted-foreground">{index + 1}º</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{program.programName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {program.presentationCount} apresentaç{program.presentationCount === 1 ? "ão" : "ões"}
                              </p>
                            </div>
                            <p className="shrink-0 font-bold text-amber-600">
                              {formatPoints(program.totalPoints)} pts
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p className="mb-4 text-right text-xs text-muted-foreground">
                Última atualização: hoje às{" "}
                {new Date(results.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ) : null}
        </div>

        <EventLiveBottomNav tabs={eventNavTabs} className="sm:hidden" />
      </main>
    </div>
  );
}
