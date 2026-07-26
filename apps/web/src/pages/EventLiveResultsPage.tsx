import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, MapPin, Medal, Star, Trophy, Users } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { EventLiveBottomNav, buildEventNavTabs } from "@/components/EventLiveShared";
import { useEventLiveGuard } from "@/lib/useEventLiveGuard";
import { resolveCenterTab } from "@/lib/eventNavPriority";
import { formatEventDateRange } from "@/lib/formatDateRange";
import { formatPercent, formatPoints } from "@/lib/formatNumber";
import { FORMAT_LABELS } from "@/lib/categoryLabels";
import { cn } from "@/lib/utils";
import {
  adminScoringApi,
  eventsApi,
  usersApi,
  type Event,
  type EventResults,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

type ResultsTab = "categoria" | "equipe" | "programa";

const CATEGORY_COLORS = [
  { bg: "bg-violet-500/10", text: "text-violet-600" },
  { bg: "bg-emerald-500/10", text: "text-emerald-600" },
  { bg: "bg-amber-500/10", text: "text-amber-600" },
  { bg: "bg-blue-500/10", text: "text-blue-600" },
  { bg: "bg-rose-500/10", text: "text-rose-600" },
];

export function EventLiveResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventLiveGuard(id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [results, setResults] = useState<EventResults | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>("categoria");

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
  }, [id]);

  const isAdminOrAssessor = event
    ? event.currentUserRoles.some((r) => r === "admin" || r === "assessor")
    : false;

  useEffect(() => {
    if (!id || !isAdminOrAssessor) return;
    adminScoringApi.getResults(id).then(setResults);
  }, [id, isAdminOrAssessor]);

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
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 sm:py-6">
          {!isAdminOrAssessor ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Você não tem acesso a esta página.
            </div>
          ) : !results ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <h2 className="text-xl font-bold text-foreground">Resultados</h2>

              <div className="mt-4 flex items-center gap-1 border-b border-border">
                {(
                  [
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

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-foreground">
                          {results.topOverall.teamName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {results.topOverall.categoryName}
                        </p>
                      </div>
                      <p className="shrink-0 text-2xl font-bold text-violet-600">
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
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-foreground">
                          {results.topTeamCheer.teamName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {results.topTeamCheer.categoryName}
                        </p>
                      </div>
                      <p className="shrink-0 text-2xl font-bold text-emerald-600">
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
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-foreground">
                          {results.topProgram.programName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">Total de pontos</p>
                      </div>
                      <p className="shrink-0 text-2xl font-bold text-amber-600">
                        {formatPoints(results.topProgram.totalPoints)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Sem apresentações pontuadas ainda.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 mb-6 rounded-2xl border border-border bg-card">
                {activeTab === "categoria" && (
                  <div>
                    <p className="px-4 pt-4 text-sm font-bold text-foreground">Resultados por categoria</p>
                    {results.categories.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma apresentação totalmente pontuada ainda.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="mt-3 w-full min-w-[720px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted-foreground">
                              <th className="px-4 pb-2 font-semibold">Categoria</th>
                              <th className="px-4 pb-2 font-semibold">Modalidade</th>
                              <th className="px-4 pb-2 font-semibold">Equipes</th>
                              <th className="px-4 pb-2 font-semibold">Maior percentual</th>
                              <th className="px-4 pb-2 font-semibold">Maior pontuação</th>
                              <th className="px-4 pb-2 font-semibold">Média geral</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {results.categories.map((category, index) => {
                              const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                              return (
                                <tr key={category.categoryId}>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={cn(
                                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                          color.bg,
                                          color.text,
                                        )}
                                      >
                                        <Medal className="size-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-foreground">{category.categoryName}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {category.teamCount} apresentaç{category.teamCount === 1 ? "ão" : "ões"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {FORMAT_LABELS[category.categoryFormat]}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">{category.teamCount}</td>
                                  <td className="px-4 py-3">
                                    {category.topByPercentage && (
                                      <>
                                        <p className={cn("font-bold", color.text)}>
                                          {formatPercent(category.topByPercentage.percentage)}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {category.topByPercentage.teamName}
                                        </p>
                                      </>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {category.topByScore && (
                                      <>
                                        <p className={cn("font-bold", color.text)}>
                                          {formatPoints(category.topByScore.finalResult)}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {category.topByScore.teamName}
                                        </p>
                                      </>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {formatPercent(category.averagePercentage)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                      Percentuais calculados com base na pontuação máxima da categoria.
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
                            <span className="w-7 shrink-0 text-sm font-semibold text-muted-foreground">
                              {index + 1}º
                            </span>
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
                            <span className="w-7 shrink-0 text-sm font-semibold text-muted-foreground">
                              {index + 1}º
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{program.programName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {program.presentationCount} apresentaç{program.presentationCount === 1 ? "ão" : "ões"}
                              </p>
                            </div>
                            <p className="shrink-0 font-bold text-amber-600">{formatPoints(program.totalPoints)}</p>
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
          )}
        </div>
      </main>

      <EventLiveBottomNav tabs={eventNavTabs} className="sm:hidden" />
    </div>
  );
}
