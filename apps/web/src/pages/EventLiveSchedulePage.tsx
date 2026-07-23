import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { ENTRY_VISUALS, EventLiveBottomNav, buildEventNavTabs } from "@/components/EventLiveShared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventSetupGuard } from "@/lib/useEventSetupGuard";
import { formatDate } from "@/lib/formatDate";
import { formatMinutes } from "@/lib/scheduleTime";
import { getScheduleEntryDisplay } from "@/lib/scheduleEntryDisplay";
import {
  computeFullSchedule,
  filterFullSchedule,
  type FullScheduleItem,
} from "@/lib/eventFullSchedule";
import { exportScheduleToExcel, exportScheduleToPdf } from "@/lib/scheduleExport";
import { cn } from "@/lib/utils";
import {
  eventsApi,
  scheduleApi,
  teamsApi,
  usersApi,
  type Event,
  type ScheduleDay,
  type ScheduleEntryType,
  type TeamWithProgram,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

const TYPE_ORDER: ScheduleEntryType[] = ["presentation", "warmup", "break", "ceremony", "award"];

const TYPE_LABELS: Record<ScheduleEntryType, string> = {
  presentation: "Apresentações",
  warmup: "Aquecimentos",
  break: "Intervalos",
  ceremony: "Aberturas",
  award: "Premiações",
};

export function EventLiveSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEventSetupGuard(id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [teams, setTeams] = useState<TeamWithProgram[] | null>(null);

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ScheduleEntryType>>(new Set(TYPE_ORDER));
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

  // Mesmo redirect da EventLiveDashboardPage — esta tela só faz sentido
  // pra um evento já publicado/em andamento/concluído.
  useEffect(() => {
    if (!event) return;
    if (event.status === "created") navigate(`/events/${event.id}/setup`, { replace: true });
  }, [event, navigate]);

  // Se o programa selecionado mudar e a equipe escolhida não pertencer
  // mais a ele, volta o filtro de equipe pra "todas" em vez de deixar um
  // filtro "impossível" (equipe de outro programa) selecionado.
  useEffect(() => {
    if (programId === "all" || teamId === "all") return;
    const team = teams?.find((t) => t.id === teamId);
    if (team && team.program.id !== programId) setTeamId("all");
  }, [programId, teamId, teams]);

  const fullSchedule = useMemo(() => computeFullSchedule(days ?? []), [days]);

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
          types: selectedTypes,
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

  function toggleType(type: ScheduleEntryType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (!event || !days || !teams) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const eventNavTabs = buildEventNavTabs({
    current: "cronograma",
    onNavigateHome: () => navigate(`/events/${event.id}/live`),
    onNavigateSchedule: () => navigate(`/events/${event.id}/live/schedule`),
  });

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} eventNavItems={eventNavTabs} />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 sm:pt-0">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Cronograma completo</h1>
              <p className="mt-1 text-sm text-muted-foreground">{event.name}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
                <Download className="size-4" />
                Baixar
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportScheduleToPdf(event.name, filteredItems, teamProgramNameMap)
                  }
                >
                  <FileText data-icon="inline-start" />
                  Baixar como PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportScheduleToExcel(event.name, filteredItems)}>
                  <FileSpreadsheet data-icon="inline-start" />
                  Baixar como Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-5 flex flex-col gap-3">
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
              {TYPE_ORDER.map((type) => {
                const visual = ENTRY_VISUALS[type];
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
                    {TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {groupedByDay.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {fullSchedule.length === 0
                  ? "Nenhuma apresentação cadastrada no cronograma ainda."
                  : "Nenhum item encontrado com esses filtros."}
              </p>
            ) : (
              <div className="grid gap-6">
                {groupedByDay.map(([dayDate, items]) => (
                  <div key={dayDate}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                      {formatDate(dayDate).toUpperCase()}
                    </p>
                    <div className="rounded-2xl border border-border bg-card p-2 sm:p-3">
                      <div className="divide-y divide-border">
                        {items.map((item) => {
                          const visual = ENTRY_VISUALS[item.entry.type];
                          const Icon = visual.icon;
                          const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
                          return (
                            <div
                              key={item.entry.id}
                              className="flex items-center gap-3 px-2 py-2.5 first:pt-1 last:pb-1"
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
                                <p className="truncate text-sm font-medium text-foreground">
                                  {display.title}
                                </p>
                                {display.subtitle && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {display.subtitle}
                                  </p>
                                )}
                              </div>
                              <span className="hidden shrink-0 truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:block">
                                {item.resourceName}
                              </span>
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

        <EventLiveBottomNav tabs={eventNavTabs} className="sm:hidden" />
      </main>
    </div>
  );
}
