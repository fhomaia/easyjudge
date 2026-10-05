import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CategoryTags } from "@/components/CategoryTags";
import {
  ArrowLeft,
  ChevronRight,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { ProgramsSetupShell } from "@/components/ProgramsSetupShell";
import { EventThumbnail } from "@/components/EventThumbnail";
import { EditProgramDialog } from "@/components/EditProgramDialog";
import { CreateTeamDialog } from "@/components/CreateTeamDialog";
import { ProgramAthleteDialog } from "@/components/ProgramAthleteDialog";
import { AthleteEntriesDialog } from "@/components/AthleteEntriesDialog";
import { TeamSituationBadge } from "@/components/TeamSituationBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/Pagination";
import { getAvatarColor } from "@/lib/avatarColor";
import { formatCpf } from "@/lib/masks";
import {
  athleteAge,
  athleteInitials,
  athleteName,
  entryKey,
  isSelfRegistered,
  pluralize,
  SELF_REGISTERED_WARNING,
  teamSituation,
} from "@/lib/programAthletes";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  programAthletesApi,
  programsApi,
  type ProgramAthlete,
  type ProgramWithTeams,
} from "@/api/client";

type Tab = "teams" | "athletes";
type AthleteFilter = "all" | "with" | "without";

const ATHLETES_PAGE_SIZE = 10;

// Tela de um programa no Setup (2026-10-04): equipes (cada uma com as
// próprias categorias) e atletas inscritos neste evento.
export function ProgramDetailPage() {
  const { id, programId } = useParams<{ id: string; programId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "athletes" ? "athletes" : "teams";

  const [program, setProgram] = useState<ProgramWithTeams | null>(null);
  const [athletes, setAthletes] = useState<ProgramAthlete[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editProgramOpen, setEditProgramOpen] = useState(false);
  const [deleteProgramOpen, setDeleteProgramOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!id || !programId) return;
    Promise.all([programsApi.get(id, programId), programAthletesApi.list(id, programId)])
      .then(([p, a]) => {
        setProgram(p);
        setAthletes(a);
      })
      .catch(() => setError("Não foi possível carregar o programa."));
  }, [id, programId]);

  useEffect(load, [load]);

  function setTab(next: Tab) {
    setSearchParams(next === "teams" ? {} : { tab: next }, { replace: true });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id || !programId) return;
    const updated = await programsApi.uploadLogo(id, programId, file);
    setProgram((prev) => (prev ? { ...prev, ...updated, teams: prev.teams } : prev));
  }

  async function handleDeleteProgram() {
    if (!id || !programId) return;
    await programsApi.remove(id, programId);
    navigate(`/events/${id}/programs`);
  }

  const categoriesCount = program?.teams.reduce((sum, t) => sum + t.categories.length, 0) ?? 0;

  return (
    <ProgramsSetupShell
      loading={(program === null || athletes === null) && !error}
      backLabel="Programas e equipes"
      backTo={`/events/${id}/programs`}
    >
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {program && athletes && id && programId && (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                aria-label="Alterar logo do programa"
                className="shrink-0"
              >
                <EventThumbnail
                  name={program.name}
                  logoUrl={program.logoUrl}
                  className="size-14 rounded-xl text-base sm:size-16"
                />
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 truncate text-2xl font-semibold text-foreground">
                    {program.name}
                  </h1>
                  {program.userId ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Vinculado
                    </span>
                  ) : (
                    <span
                      title="Nenhuma conta do tipo Programa está vinculada a este programa: a instituição não consegue ver as próprias equipes, notas e resultados. Use “Editar dados do programa” para vincular a conta ou corrigir o email."
                      className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                    >
                      Aguardando conta Programa
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {program.city} - {program.state}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{program.email}</span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <UserRound className="size-3.5" />
                    {pluralize(athletes.length, "atleta", "atletas")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {pluralize(program.teams.length, "equipe", "equipes")}
                  </span>
                  <span>{pluralize(categoriesCount, "categoria", "categorias")}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:shrink-0">
              {program.userId ? (
                <p
                  title="Este programa já está vinculado a uma conta própria: os dados são editados pelo próprio programa."
                  className="text-xs text-muted-foreground sm:max-w-48 sm:text-right"
                >
                  Gerenciado pela própria conta do programa
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditProgramOpen(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                  Editar dados do programa
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeleteProgramOpen(true)}
                aria-label="Excluir programa"
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-6 border-b border-border">
            {(
              [
                ["teams", "Equipes"],
                ["athletes", "Atletas"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "teams" ? (
            <TeamsTab
              program={program}
              athletes={athletes}
              onNewTeam={() => setCreateTeamOpen(true)}
              onOpenTeam={(teamId) => navigate(`/events/${id}/programs/${programId}/teams/${teamId}`)}
            />
          ) : (
            <AthletesTab
              eventId={id}
              program={program}
              athletes={athletes}
              onAthletesChange={setAthletes}
              onEntriesChanged={load}
            />
          )}
        </div>
      )}

      {id && program && (
        <EditProgramDialog
          eventId={id}
          program={editProgramOpen ? program : null}
          onOpenChange={(open) => !open && setEditProgramOpen(false)}
          onUpdated={(updated) =>
            setProgram((prev) => (prev ? { ...prev, ...updated, teams: prev.teams } : prev))
          }
        />
      )}

      {id && programId && (
        <CreateTeamDialog
          eventId={id}
          programId={programId}
          open={createTeamOpen}
          onOpenChange={setCreateTeamOpen}
          onCreated={(team) =>
            setProgram((prev) => (prev ? { ...prev, teams: [...prev.teams, team] } : prev))
          }
        />
      )}

      <ConfirmDialog
        open={deleteProgramOpen}
        onOpenChange={setDeleteProgramOpen}
        title="Excluir programa"
        description={`${
          program && isSelfRegistered(program)
            ? `${SELF_REGISTERED_WARNING} `
            : ""
        }Tem certeza que quer excluir "${program?.name}"? Todas as ${program?.teams.length ?? 0} equipes e os ${athletes?.length ?? 0} atletas dele também serão apagados. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDeleteProgram}
      />
    </ProgramsSetupShell>
  );
}

function TeamsTab({
  program,
  athletes,
  onNewTeam,
  onOpenTeam,
}: {
  program: ProgramWithTeams;
  athletes: ProgramAthlete[];
  onNewTeam: () => void;
  onOpenTeam: (teamId: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Equipes</h2>
          <p className="text-sm text-muted-foreground">
            {pluralize(program.teams.length, "equipe cadastrada", "equipes cadastradas")}. Cada
            equipe pode competir em uma ou mais categorias.
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={onNewTeam}>
          <Plus data-icon="inline-start" />
          Nova equipe
        </Button>
      </div>

      {program.teams.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          Nenhuma equipe cadastrada ainda.
        </p>
      ) : (
        <div className="grid gap-2">
          {program.teams.map((team) => {
            // Atletas distintos da equipe (somando as categorias).
            const athletesInTeam = athletes.filter((a) =>
              a.entries.some((e) => e.teamId === team.id),
            ).length;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onOpenTeam(team.id)}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40 sm:p-4"
              >
                <div
                  style={{ backgroundColor: getAvatarColor(team.id) }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                >
                  <Users className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-medium text-foreground">{team.name}</p>
                    <TeamSituationBadge situation={teamSituation(team)} />
                  </div>
                  <div className="mt-1.5">
                    <CategoryTags categories={team.categories} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {pluralize(team.categories.length, "categoria", "categorias")} ·{" "}
                    {pluralize(athletesInTeam, "atleta", "atletas")}
                  </p>
                </div>
                <span className="hidden shrink-0 text-sm font-medium text-primary sm:inline">
                  Gerenciar
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AthletesTab({
  eventId,
  program,
  athletes,
  onAthletesChange,
  onEntriesChanged,
}: {
  eventId: string;
  program: ProgramWithTeams;
  athletes: ProgramAthlete[];
  onAthletesChange: (athletes: ProgramAthlete[]) => void;
  // Contagens de atletas por categoria vêm do programa; recarrega depois
  // de mudar categorias de um atleta.
  onEntriesChanged: () => void;
}) {
  const isMobile = useIsMobile();
  const detailRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AthleteFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"categories" | "personal">("categories");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramAthlete | null>(null);
  const [entriesTarget, setEntriesTarget] = useState<ProgramAthlete | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramAthlete | null>(null);

  const withCount = athletes.filter((a) => a.entries.length > 0).length;
  const query = search.trim().toLowerCase();
  const filtered = athletes
    .filter((a) =>
      filter === "with" ? a.entries.length > 0 : filter === "without" ? a.entries.length === 0 : true,
    )
    .filter(
      (a) => athleteName(a).toLowerCase().includes(query) || a.email.toLowerCase().includes(query),
    )
    .sort((a, b) => athleteName(a).localeCompare(athleteName(b), "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(filtered.length / ATHLETES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * ATHLETES_PAGE_SIZE,
    currentPage * ATHLETES_PAGE_SIZE,
  );
  const selected = athletes.find((a) => a.id === selectedId) ?? null;
  // Celular em etapas (pedido do usuário, 2026-10-05): ou a lista, ou o
  // atleta escolhido com "Voltar" — empilhar os dois ficava longo demais
  // com muitos atletas. No computador continuam lado a lado.
  const showListStep = !isMobile || !selected;
  const showDetailStep = !isMobile || selected !== null;

  function select(athleteId: string) {
    setSelectedId(athleteId);
    setDetailTab("categories");
    if (isMobile) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  function upsert(athlete: ProgramAthlete) {
    const exists = athletes.some((a) => a.id === athlete.id);
    onAthletesChange(
      exists ? athletes.map((a) => (a.id === athlete.id ? athlete : a)) : [...athletes, athlete],
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await programAthletesApi.remove(eventId, program.id, deleteTarget.id);
    onAthletesChange(athletes.filter((a) => a.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    if (deleteTarget.entries.length > 0) onEntriesChanged();
  }

  const filterButtons: [AthleteFilter, string][] = [
    ["all", `Todos (${athletes.length})`],
    ["with", `Com categoria (${withCount})`],
    ["without", `Sem categoria (${athletes.length - withCount})`],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {showListStep && (
        <div className="grid min-w-0 content-start gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">Atletas ({athletes.length})</h2>
            <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Adicionar atleta
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar atleta..."
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {filterButtons.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                  filter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {athletes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum atleta cadastrado neste programa ainda.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum atleta encontrado.</p>
          ) : (
            <div className="grid gap-1">
              <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7.5rem] gap-3 px-2 text-xs text-muted-foreground sm:grid">
                <span>Nome</span>
                <span>Idade</span>
                <span>Categorias</span>
              </div>
              {paginated.map((athlete) => {
                const age = athleteAge(athlete.birthDate);
                return (
                  <button
                    key={athlete.id}
                    type="button"
                    onClick={() => select(athlete.id)}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors sm:grid-cols-[minmax(0,1fr)_5rem_7.5rem] ${
                      athlete.id === selectedId ? "bg-primary/[0.07]" : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <AthleteAvatar athlete={athlete} />
                      <span className="min-w-0">
                        <span className="block truncate text-foreground">{athleteName(athlete)}</span>
                        <span className="block truncate text-xs text-muted-foreground sm:hidden">
                          {age !== null ? `${age} anos · ` : ""}
                          {pluralize(athlete.entries.length, "categoria", "categorias")}
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-muted-foreground sm:block">
                      {age !== null ? `${age} anos` : "—"}
                    </span>
                    <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
                      <span
                        className={`size-1.5 rounded-full ${
                          athlete.entries.length > 0 ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {pluralize(athlete.entries.length, "categoria", "categorias")}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground sm:hidden" />
                  </button>
                );
              })}
            </div>
          )}

          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {showDetailStep && (
        <div ref={detailRef} className="grid min-w-0 scroll-mt-20 gap-3">
          {isMobile && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-2 justify-self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Todos os atletas
            </button>
          )}
          {selected ? (
            <AthleteDetail
              athlete={selected}
              program={program}
              tab={detailTab}
              onTabChange={setDetailTab}
              onEditEntries={() => setEntriesTarget(selected)}
              onEdit={() => setEditTarget(selected)}
              onDelete={() => setDeleteTarget(selected)}
            />
          ) : (
            <div className="hidden min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground lg:flex">
              Selecione um atleta pra ver as categorias dele.
            </div>
          )}
        </div>
      )}

      <ProgramAthleteDialog
        eventId={eventId}
        programId={program.id}
        open={createOpen || editTarget !== null}
        athlete={editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        onSaved={(athlete) => {
          upsert(athlete);
          setSelectedId(athlete.id);
        }}
      />

      <AthleteEntriesDialog
        eventId={eventId}
        programId={program.id}
        athlete={entriesTarget}
        teams={program.teams}
        onOpenChange={(open) => !open && setEntriesTarget(null)}
        onSaved={(athlete) => {
          upsert(athlete);
          onEntriesChanged();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir atleta"
        description={`Tem certeza que quer excluir "${deleteTarget ? athleteName(deleteTarget) : ""}"? Ele sai de todas as categorias deste programa. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AthleteAvatar({ athlete, large }: { athlete: ProgramAthlete; large?: boolean }) {
  return (
    <span
      style={{ backgroundColor: getAvatarColor(athlete.id) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-medium text-white ${
        large ? "size-14 text-lg" : "size-8 text-xs"
      }`}
    >
      {athleteInitials(athlete)}
    </span>
  );
}

function AthleteDetail({
  athlete,
  program,
  tab,
  onTabChange,
  onEditEntries,
  onEdit,
  onDelete,
}: {
  athlete: ProgramAthlete;
  program: ProgramWithTeams;
  tab: "categories" | "personal";
  onTabChange: (tab: "categories" | "personal") => void;
  onEditEntries: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const age = athleteAge(athlete.birthDate);
  const entries = new Set(athlete.entries.map((e) => entryKey(e.teamId, e.categoryId)));
  const pairs = program.teams.flatMap((team) =>
    team.categories.map((category) => ({ team, category })),
  );
  const athletePairs = pairs.filter(({ team, category }) => entries.has(entryKey(team.id, category.id)));

  return (
    <div className="grid min-w-0 gap-5 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <AthleteAvatar athlete={athlete} large />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">{athleteName(athlete)}</p>
          {age !== null && (
            <span className="mt-1 inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {age} anos
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar atleta"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Excluir atleta"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-border">
        {(
          [
            ["categories", "Categorias"],
            ["personal", "Dados pessoais"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "categories" ? (
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">
              Categorias do atleta{" "}
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {athlete.entries.length}
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={pairs.length === 0}
              onClick={onEditEntries}
            >
              <Pencil data-icon="inline-start" />
              Editar categorias
            </Button>
          </div>
          {pairs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma equipe deste programa está inscrita em categorias ainda.
            </p>
          ) : athletePairs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Este atleta ainda não está em nenhuma categoria.
            </p>
          ) : (
            <div className="grid gap-2">
              {athletePairs.map(({ team, category }) => (
                <div
                  key={entryKey(team.id, category.id)}
                  className="min-w-0 rounded-lg border border-border/60 p-3"
                >
                  <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Equipe {team.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <dl className="grid gap-3 text-sm">
          <PersonalField label="Nome completo" value={athleteName(athlete)} />
          <PersonalField label="Email" value={athlete.email} />
          <PersonalField label="CPF" value={athlete.cpf ? formatCpf(athlete.cpf) : null} />
          <PersonalField
            label="Nascimento"
            value={
              athlete.birthDate
                ? athlete.birthDate.split("-").reverse().join("/")
                : null
            }
          />
        </dl>
      )}
    </div>
  );
}

function PersonalField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground">{value ?? "Não informado"}</dd>
    </div>
  );
}
