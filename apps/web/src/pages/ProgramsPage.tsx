import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Search,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { ProgramsSetupShell } from "@/components/ProgramsSetupShell";
import { EventThumbnail } from "@/components/EventThumbnail";
import { CreateProgramDialog } from "@/components/CreateProgramDialog";
import {
  ProgramOverviewDialog,
  programCategories,
  type ProgramOverviewMode,
} from "@/components/ProgramOverviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/Pagination";
import { pluralize } from "@/lib/programAthletes";
import { EventRequestsTab } from "@/components/EventRequestsTab";
import { ShareEventDialog } from "@/components/ShareEventDialog";
import { DatePicker } from "@/components/DatePicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDeadline, isRegistrationOpen } from "@/lib/registrationWindow";
import { cn } from "@/lib/utils";
import {
  ApiError,
  eventsApi,
  programRegistrationAdminApi,
  programsApi,
  type Event,
  type EventRegistrationRequestView,
  type Program,
} from "@/api/client";

const PAGE_SIZE = 8;

// Lista de programas do evento em cards (2026-10-04). Gerenciar um
// programa (equipes, categorias, atletas) abre ProgramDetailPage.
export function ProgramsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[] | null>(null);
  // Abas: Programas | Solicitações (?tab=requests, ?program=<id> filtra).
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "requests" ? "requests" : "programs";
  const programFilter = searchParams.get("program");
  const [requests, setRequests] = useState<EventRegistrationRequestView[]>([]);
  // Evento (pro convite de inscrição: código/QR e prazo).
  const [event, setEvent] = useState<Event | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const pendingRequests = requests.filter((r) => !r.resolvedAt).length;

  function showTab(next: "programs" | "requests", program?: string) {
    setSearchParams(
      next === "requests" ? { tab: "requests", ...(program ? { program } : {}) } : {},
      { replace: true },
    );
  }

  function loadRequests() {
    if (!id) return;
    programRegistrationAdminApi
      .listEventRequests(id)
      .then(setRequests)
      .catch(() => setRequests([]));
  }
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [overview, setOverview] = useState<{
    program: Program;
    mode: ProgramOverviewMode;
  } | null>(null);

  useEffect(loadRequests, [id]);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then(setEvent).catch(() => setEvent(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    programsApi
      .list(id)
      .then(setPrograms)
      .catch(() => setError("Não foi possível carregar os programas."));
  }, [id]);

  function openProgram(programId: string) {
    navigate(`/events/${id}/programs/${programId}`);
  }

  const query = search.trim().toLowerCase();
  const filteredPrograms = (programs ?? [])
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.teams ?? []).some((t) => t.name.toLowerCase().includes(query)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(filteredPrograms.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPrograms = filteredPrograms.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const totalPrograms = programs?.length ?? 0;
  const totalTeams = (programs ?? []).reduce((sum, p) => sum + (p.teamsCount ?? 0), 0);
  const totalAthletes = (programs ?? []).reduce((sum, p) => sum + (p.athletesCount ?? 0), 0);

  return (
    <ProgramsSetupShell
      loading={programs === null && !error}
      backLabel="Sair"
      backTo={`/events/${id}/setup`}
      fillHeight
    >
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {programs !== null && (
        // Coluna que ocupa a tela: o banner (mt-auto) fica no fim da tela
        // quando a lista é curta e logo depois dela quando é longa.
        // `[&>*]:min-w-0` faz o papel do minmax(0,1fr) das outras telas.
        <div className="mt-6 flex flex-1 flex-col gap-6 [&>*]:min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-foreground">Programas e equipes</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gerencie os programas participantes, suas equipes e atletas.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-4" />
                  {pluralize(totalPrograms, "programa", "programas")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  {pluralize(totalTeams, "equipe", "equipes")}
                </span>
                <span>{pluralize(totalAthletes, "atleta", "atletas")}</span>
              </div>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setCreateProgramOpen(true)}>
              <Plus data-icon="inline-start" />
              Cadastrar programa
            </Button>
          </div>

          {event?.eventCode && (
            <RegistrationInvite
              event={event}
              onShare={() => setShareOpen(true)}
              onEventChange={setEvent}
            />
          )}

          <div className="flex gap-6 border-b border-border">
            {(
              [
                ["programs", "Programas"],
                ["requests", "Solicitações"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => showTab(key)}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {key === "requests" && pendingRequests > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {pendingRequests}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "requests" && id ? (
            <EventRequestsTab
              eventId={id}
              requests={requests}
              programFilter={programFilter}
              onClearFilter={() => showTab("requests")}
              onChanged={() => {
                loadRequests();
                programsApi.list(id).then(setPrograms).catch(() => {});
              }}
            />
          ) : totalPrograms > 0 ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar programa ou equipe..."
                  className="pl-11"
                />
              </div>

              <p className="-mb-2 text-sm text-muted-foreground">
                {pluralize(filteredPrograms.length, "programa", "programas")}
              </p>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                {paginatedPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    onOpen={() => openProgram(program.id)}
                    onShow={(mode) => setOverview({ program, mode })}
                    onShowRequests={() => showTab("requests", program.id)}
                  />
                ))}
                {filteredPrograms.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum programa encontrado.
                  </p>
                )}
              </div>

              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </>
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Button size="lg" onClick={() => setCreateProgramOpen(true)}>
                <Plus data-icon="inline-start" />
                Novo programa
              </Button>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-4 rounded-xl border border-amber-300/60 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/20 dark:bg-amber-500/10">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
                <Star className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Próxima etapa recomendada</p>
                <p className="text-sm text-muted-foreground">
                  Agora monte o cronograma do evento, definindo a ordem de apresentação de cada
                  equipe.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/events/${id}/schedule`)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Ir para cronograma
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      <ProgramOverviewDialog
        eventId={id ?? ""}
        program={overview?.program ?? null}
        mode={overview?.mode ?? "teams"}
        onOpenChange={(open) => {
          if (!open) setOverview(null);
        }}
      />

      <ShareEventDialog event={shareOpen ? event : null} onOpenChange={setShareOpen} />

      {id && (
        <CreateProgramDialog
          eventId={id}
          open={createProgramOpen}
          onOpenChange={setCreateProgramOpen}
          onCreated={(program) => openProgram(program.id)}
        />
      )}
    </ProgramsSetupShell>
  );
}

// Convite pra inscrição pelo próprio programa (2026-10-05): os programas
// entram pelo link/QR do evento, montam a ficha e enviam; a inscrição
// aparece aqui sozinha. Selo de abertas/encerradas e data limite editável
// ali mesmo (DeadlineDialog).
function RegistrationInvite({
  event,
  onShare,
  onEventChange,
}: {
  event: Event;
  onShare: () => void;
  onEventChange: (event: Event) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const open = isRegistrationOpen(event);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <div className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
          <QrCode className="size-5" />
        </div>
        <div className="grid gap-1 text-sm">
          <p className="font-semibold text-foreground">Receba inscrições dos programas</p>
          {/* Celular: explicação recolhida atrás de "Como funciona?" (o bloco
              ficava carregado); desktop sempre mostra. */}
          <p className={cn("text-muted-foreground", !showHelp && "hidden sm:block")}>
            Compartilhe o link ou o QR do evento. O programa entra com a conta dele, monta a ficha
            (equipes, categorias e atletas) e envia.
          </p>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="justify-self-start text-xs font-medium text-primary hover:underline sm:hidden"
          >
            {showHelp ? "Ocultar" : "Como funciona?"}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                open
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              )}
            >
              {open ? "Inscrições abertas" : "Inscrições encerradas"}
            </span>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {event.registrationDeadline
                ? `Data limite: ${formatDeadline(event.registrationDeadline)}, 23:59`
                : "Sem data limite"}
              <Pencil className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
      {/* Secundário, no mesmo estilo do "Gerenciar" dos cards: "Cadastrar
          programa" é a ação principal da tela. */}
      <Button
        variant="outline"
        className="w-full shrink-0 border-primary/40 text-primary hover:bg-primary/10 sm:w-auto"
        onClick={onShare}
      >
        <QrCode data-icon="inline-start" />
        Compartilhar evento
      </Button>
      <DeadlineDialog
        event={editOpen ? event : null}
        onOpenChange={setEditOpen}
        onSaved={onEventChange}
      />
    </div>
  );
}

// Editar só a data limite das inscrições (mesma regra do "Dados do
// evento": um dia até o início do evento, ou sem data limite).
function DeadlineDialog({
  event,
  onOpenChange,
  onSaved,
}: {
  event: Event | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (event: Event) => void;
}) {
  const [deadline, setDeadline] = useState<string | null>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setDeadline(event.registrationDeadline);
    setError(null);
  }, [event]);

  async function save() {
    if (!event) return;
    if (deadline === "") {
      setError('Escolha a data ou marque "Sem data limite".');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await eventsApi.update(event.aliasId, { registrationDeadline: deadline }));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const [y, m, d] = (event?.startDate ?? "").split("-").map(Number);
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-sm">
        <DialogTitle>Data limite das inscrições</DialogTitle>
        <DatePicker
          value={deadline ?? ""}
          onChange={setDeadline}
          maxDate={y && m && d ? new Date(y, m - 1, d) : undefined}
          disabled={deadline === null}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={deadline === null}
            onCheckedChange={(value) => setDeadline(value === true ? null : "")}
          />
          Sem data limite
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const VISIBLE_TEAMS = 3;

// Linha do programa: identidade | números | equipes | Gerenciar. A partir de
// xl fica tudo numa linha (como o mock de 2026-10-05); abaixo disso empilha,
// com os números lado a lado e o botão ocupando a largura no celular.
function ProgramCard({
  program,
  onOpen,
  onShow,
  onShowRequests,
}: {
  program: Program;
  onOpen: () => void;
  onShow: (mode: ProgramOverviewMode) => void;
  onShowRequests: () => void;
}) {
  const teams = [...(program.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const teamsCount = program.teamsCount ?? teams.length;
  const categoriesCount = programCategories(program).length;
  const visibleTeams = teams.slice(0, VISIBLE_TEAMS);
  const hiddenTeams = teams.length - visibleTeams.length;
  // Só o botão "Gerenciar" abre o programa; os números de atletas,
  // equipes e categorias abrem popups de consulta (pedido do usuário, 2026-10-05).
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border border-border/60 bg-card p-4 text-left sm:p-5 xl:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto] xl:items-start xl:gap-0">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4 xl:pr-6">
        <EventThumbnail
          name={program.name}
          logoUrl={program.logoUrl}
          className="size-14 shrink-0 rounded-full text-sm sm:size-16"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">{program.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {program.city} - {program.state}
            </span>
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{program.email}</span>
          </p>
          {!program.userId && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              Aguardando conta Programa
            </p>
          )}
          {(program.pendingRequestsCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={onShowRequests}
              className="mt-1.5 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
            >
              {program.pendingRequestsCount === 1
                ? "1 solicitação pendente"
                : `${program.pendingRequestsCount} solicitações pendentes`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60 rounded-lg bg-muted/40 py-3 xl:self-stretch xl:rounded-none xl:border-x xl:border-border/60 xl:bg-transparent xl:py-1">
        <Stat
          value={program.athletesCount ?? 0}
          singular="atleta"
          plural="atletas"
          icon={Users}
          onClick={() => onShow("athletes")}
        />
        <Stat
          value={teamsCount}
          singular="equipe"
          plural="equipes"
          icon={UsersRound}
          onClick={() => onShow("teams")}
        />
        <Stat
          value={categoriesCount}
          singular="categoria"
          plural="categorias"
          icon={Star}
          onClick={() => onShow("categories")}
        />
      </div>

      <div className="min-w-0 border-t border-border/60 pt-3 xl:border-t-0 xl:px-6 xl:pt-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          Equipes
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {teamsCount}
          </span>
        </p>
        {visibleTeams.length > 0 ? (
          <ul className="mt-2 grid gap-1.5">
            {visibleTeams.map((team) => (
              <li key={team.id} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="size-2 shrink-0 rounded-full bg-primary" />
                <span className="truncate text-foreground">{team.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ({pluralize(team.categories.length, "categoria", "categorias")})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma equipe cadastrada.</p>
        )}
        {hiddenTeams > 0 && (
          <button
            type="button"
            onClick={() => onShow("teams")}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            + {pluralize(hiddenTeams, "equipe", "equipes")}
          </button>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full border-primary/40 text-primary hover:bg-primary/10 sm:w-auto sm:justify-self-end xl:justify-self-auto"
        onClick={onOpen}
      >
        Gerenciar
      </Button>
    </div>
  );
}

function Stat({
  value,
  singular,
  plural,
  icon: Icon,
  onClick,
}: {
  value: number;
  singular: string;
  plural: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-xl font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{value === 1 ? singular : plural}</span>
      <Icon className="mt-1 size-4 text-muted-foreground" />
    </>
  );
  const className = "flex flex-col items-center gap-0.5 px-2 text-center xl:w-24";
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver ${plural}`}
      className={`${className} rounded-md transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary [&:hover_span:first-child]:text-primary`}
    >
      {content}
    </button>
  );
}
