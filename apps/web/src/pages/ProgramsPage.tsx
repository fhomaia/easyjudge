import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Lock,
  Mail,
  Pause,
  Play,
  MapPin,
  Plus,
  QrCode,
  Search,
  Star,
  Users,
  UserPlus,
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
import { isSelfRegistered, pluralize } from "@/lib/programAthletes";
import { RegistrationRequirementsSection } from "@/components/RegistrationRequirementsSection";
import { EventRequestsTab } from "@/components/EventRequestsTab";
import { ShareEventDialog } from "@/components/ShareEventDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RegistrationDeadlineFields } from "@/components/RegistrationDeadlineFields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isRegistrationOpen } from "@/lib/registrationWindow";
import { cn } from "@/lib/utils";
import {
  ApiError,
  eventsApi,
  programRegistrationAdminApi,
  programsApi,
  type Event,
  type EventRegistrationRequestView,
  type Program,
  type ProgramRegistrationIssues,
} from "@/api/client";

const PAGE_SIZE = 8;

// Lista de programas do evento em cards (2026-10-04). Gerenciar um
// programa (equipes, categorias, atletas) abre ProgramDetailPage.
type Tab = "registration" | "programs" | "requests";

export function ProgramsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[] | null>(null);
  // Abas: Configurações (?tab=registration: convite, prazo e dados/documentos
  // pedidos aos atletas; depois, pagamento) | Inscrições (lista de
  // programas, padrão, sem ?tab) | Solicitações (?tab=requests,
  // ?program=<id> filtra).
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const programFilter = searchParams.get("program");
  const [requests, setRequests] = useState<EventRegistrationRequestView[]>([]);
  // Evento (pro convite de inscrição: código/QR e prazo).
  const [event, setEvent] = useState<Event | null>(null);
  // Inscrições nunca liberadas (2026-10-11): o produtor passa primeiro
  // pela aba Configurações; as outras abas aparecem bloqueadas. Pausar
  // não bloqueia nada aqui.
  const tabsLocked = event !== null && event.registrationStatus === "not_started";
  const tab: Tab = tabsLocked
    ? "registration"
    : tabParam === "requests"
      ? "requests"
      : tabParam === "registration"
        ? "registration"
        : "programs";
  const [shareOpen, setShareOpen] = useState(false);
  const pendingRequests = requests.filter((r) => !r.resolvedAt).length;

  function showTab(next: Tab, program?: string) {
    setSearchParams(
      next === "requests"
        ? { tab: "requests", ...(program ? { program } : {}) }
        : next === "registration"
          ? { tab: "registration" }
          : {},
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [issues, setIssues] = useState<Record<string, ProgramRegistrationIssues>>({});
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

  // Aba Inscrições: todas as fichas, inclusive rascunhos, e as pendências
  // de cada uma (calculadas de uma vez no servidor).
  const loadPrograms = useCallback(() => {
    if (!id) return;
    programsApi
      .list(id, { includeDrafts: true })
      .then(setPrograms)
      .catch(() => setError("Não foi possível carregar os programas."));
    programRegistrationAdminApi
      .listIssues(id)
      .then(setIssues)
      .catch(() => setIssues({}));
  }, [id]);

  useEffect(loadPrograms, [loadPrograms]);

  function openProgram(programId: string) {
    navigate(`/events/${id}/programs/${programId}`);
  }

  const query = search.trim().toLowerCase();
  const filteredPrograms = (programs ?? [])
    .filter(
      (p) =>
        (statusFilter === "all" || registrationStatus(p) === statusFilter) &&
        (p.name.toLowerCase().includes(query) ||
          (p.teams ?? []).some((t) => t.name.toLowerCase().includes(query))),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(filteredPrograms.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPrograms = filteredPrograms.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Contadores só com fichas enviadas (rascunho ainda não participa).
  const submitted = (programs ?? []).filter((p) => p.submittedAt);
  const draftsCount = (programs?.length ?? 0) - submitted.length;
  const totalPrograms = programs?.length ?? 0;
  const totalTeams = submitted.reduce((sum, p) => sum + (p.teamsCount ?? 0), 0);
  const totalAthletes = submitted.reduce((sum, p) => sum + (p.athletesCount ?? 0), 0);

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
              <h1 className="text-2xl font-semibold text-foreground">Inscrições</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Programas, equipes e atletas do evento: receba as inscrições dos programas ou
                cadastre você mesmo.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-4" />
                  {pluralize(submitted.length, "programa", "programas")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  {pluralize(totalTeams, "equipe", "equipes")}
                </span>
                <span>{pluralize(totalAthletes, "atleta", "atletas")}</span>
                {draftsCount > 0 && (
                  <span>
                    {pluralize(draftsCount, "ficha em rascunho", "fichas em rascunho")}
                  </span>
                )}
              </div>
            </div>
            {/* "Inscrever programa" fica no bloco do topo da aba Inscrições
                (RegistrationModesInfo), não aqui (2026-11-10). */}
          </div>

          <div className="flex gap-6 border-b border-border">
            {(
              [
                ["registration", "Configurações"],
                ["programs", "Inscrições"],
                ["requests", "Solicitações"],
              ] as const
            ).map(([key, label]) => {
              const locked = tabsLocked && key !== "registration";
              return (
                <button
                  key={key}
                  type="button"
                  disabled={locked}
                  title={locked ? "Libere as inscrições na aba Configurações para usar esta aba." : undefined}
                  onClick={() => showTab(key)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors",
                    tab === key
                      ? "border-primary text-primary"
                      : locked
                        ? "cursor-not-allowed border-transparent text-muted-foreground/60"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {locked && <Lock className="size-3.5" />}
                  {label}
                  {key === "requests" && pendingRequests > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {pendingRequests}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === "registration" ? (
            // Configuração da inscrição: convite (compartilhar e prazo) e
            // dados/documentos pedidos aos atletas; depois, pagamento.
            <div className="grid gap-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Configure e libere as inscrições
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compartilhe o evento e escolha o que cada atleta precisa informar ou enviar.{" "}
                  {event?.registrationStatus === "not_started"
                    ? "Programas e atletas só conseguem se inscrever depois que você liberar as inscrições, no fim desta página, onde também escolhe o prazo."
                    : "Para pausar ou retomar as inscrições, use a seção no fim desta página."}
                </p>
              </div>
              {event?.eventCode && <RegistrationInvite onShare={() => setShareOpen(true)} />}
              {/* Antes da primeira liberação o prazo é escolhido junto com
                  ela (ReleaseSection); depois, editado aqui. */}
              {event && event.registrationStatus !== "not_started" && (
                <DeadlineSection event={event} onSaved={setEvent} />
              )}
              {id && event && (
                <RegistrationRequirementsSection
                  eventId={id}
                  registrationReleased={event.registrationStatus !== "not_started"}
                />
              )}
              {/* No fim: o produtor confere tudo acima antes de liberar. */}
              {event && <ReleaseSection event={event} onSaved={setEvent} />}
            </div>
          ) : tab === "requests" && id ? (
            <EventRequestsTab
              eventId={id}
              requests={requests}
              programFilter={programFilter}
              onClearFilter={() => showTab("requests")}
              onChanged={() => {
                loadRequests();
                loadPrograms();
              }}
            />
          ) : totalPrograms > 0 ? (
            <>
              <RegistrationModesInfo
                onEnroll={() => setCreateProgramOpen(true)}
                onShare={event?.eventCode ? () => setShareOpen(true) : null}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
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
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 sm:w-56">
                    <SelectValue>{(value: StatusFilter) => STATUS_FILTER_LABELS[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {STATUS_FILTER_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="-mb-2 text-sm text-muted-foreground">
                {pluralize(filteredPrograms.length, "programa", "programas")}
              </p>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                {paginatedPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    issues={issues[program.id] ?? null}
                    onShowIssues={() => navigate(`/events/${id}/programs/${program.id}?tab=issues`)}
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
            <RegistrationModesInfo
              onEnroll={() => setCreateProgramOpen(true)}
              onShare={event?.eventCode ? () => setShareOpen(true) : null}
              empty
            />
          )}

          {/* Só depois da primeira liberação das inscrições (2026-10-11). */}
          {event && event.registrationStatus !== "not_started" && (
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
          )}
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

// Topo da aba Inscrições (2026-11-10, pedido do usuário): as duas formas
// de ter competidores no evento, que podem ser combinadas. No celular, só
// o título, a frase e os dois botões; no computador, também os dois quadros
// com a explicação de cada forma.
function RegistrationModesInfo({
  onEnroll,
  onShare,
  empty = false,
}: {
  onEnroll: () => void;
  // null = evento ainda sem código para compartilhar.
  onShare: (() => void) | null;
  // Sem nenhuma inscrição ainda: texto de início.
  empty?: boolean;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">
            {empty ? "Nenhuma inscrição ainda" : "Como os competidores entram no evento"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você pode inscrever os competidores, esperar as fichas de inscrição enviadas por eles ou
            combinar os dois.
          </p>
        </div>
      </div>
      {/* Celular: só os botões. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <Button className="w-full" onClick={onEnroll}>
          <Plus data-icon="inline-start" />
          Inscrever programa
        </Button>
        {onShare && (
          <Button
            variant="outline"
            className="w-full border-primary/40 text-primary hover:bg-primary/10"
            onClick={onShare}
          >
            <QrCode data-icon="inline-start" />
            Compartilhar evento
          </Button>
        )}
      </div>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="size-4" />
            </div>
            <div className="grid min-h-9 content-center gap-1 text-sm">
              <p className="font-medium text-foreground">Você inscreve</p>
              <p className="text-muted-foreground">
                Cadastre os programas, as equipes e os atletas competidores. Ótimo para quem já tem
                a lista em mãos.
              </p>
            </div>
          </div>
          <Button className="mt-auto w-full sm:w-auto sm:self-start" onClick={onEnroll}>
            <Plus data-icon="inline-start" />
            Inscrever programa
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <QrCode className="size-4" />
            </div>
            <div className="grid min-h-9 content-center gap-1 text-sm">
              <p className="font-medium text-foreground">Os competidores se inscrevem</p>
              <p className="text-muted-foreground">
                Programas e atletas entram pelo link, QR ou código do evento, preenchem a ficha de
                inscrição e enviam. As fichas aparecem nesta lista.
              </p>
            </div>
          </div>
          {onShare && (
            <Button
              variant="outline"
              className="mt-auto w-full border-primary/40 text-primary hover:bg-primary/10 sm:w-auto sm:self-start"
              onClick={onShare}
            >
              <QrCode data-icon="inline-start" />
              Compartilhar evento
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

// Convite pra inscrição pelo próprio programa (2026-10-05): os programas
// entram pelo link/QR do evento, montam a ficha e enviam; a inscrição
// aparece aqui sozinha. O prazo fica na seção própria (DeadlineSection).
function RegistrationInvite({ onShare }: { onShare: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <div className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
          <QrCode className="size-5" />
        </div>
        <div className="grid gap-1 text-sm">
          <p className="font-semibold text-foreground">Receba inscrições dos programas</p>
          <p className="text-muted-foreground">
            Compartilhe o link ou o QR do evento para receber inscritos!
          </p>
        </div>
      </div>
      {/* Secundário, no mesmo estilo do "Abrir ficha de inscrição" dos cards: "Inscrever
          programa" é a ação principal da tela. */}
      <Button
        variant="outline"
        className="w-full shrink-0 border-primary/40 text-primary hover:bg-primary/10 sm:w-auto"
        onClick={onShare}
      >
        <QrCode data-icon="inline-start" />
        Compartilhar evento
      </Button>
    </div>
  );
}

// Liberar/pausar as inscrições (2026-10-11). Antes de liberar (ou com
// elas pausadas), programas e atletas veem o evento como "Em breve" e não
// conseguem se inscrever nem mexer na ficha. Só antes da primeira
// liberação as abas Inscrições e Solicitações ficam bloqueadas pro
// produtor.
function ReleaseSection({
  event,
  onSaved,
}: {
  event: Event;
  onSaved: (event: Event) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const status = event.registrationStatus;
  // Prazo escolhido na primeira liberação (2026-11-10): saiu do formulário
  // do evento, e "sem valor" não pode virar "sem data limite" sem o
  // produtor escolher. "" = ainda não escolhido; null = sem data limite.
  const [deadline, setDeadline] = useState<string | null>(event.registrationDeadline ?? "");
  const choosingDeadline = status === "not_started";
  const deadlineError =
    deadline === ""
      ? "Escolha o prazo de inscrição para liberar."
      : deadline !== null && deadline > event.startDate
        ? "O prazo não pode passar da data de início do evento."
        : null;
  const open = isRegistrationOpen(event);
  const next = status === "open" ? "paused" : "open";

  const badge =
    status === "not_started"
      ? { label: "Inscrições não liberadas", className: "bg-muted text-muted-foreground" }
      : status === "paused"
        ? {
            label: "Inscrições pausadas",
            className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          }
        : open
          ? {
              label: "Inscrições abertas",
              className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            }
          : {
              label: "Inscrições encerradas",
              className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            };

  const text =
    status === "not_started"
      ? "Confira as configurações acima e libere as inscrições quando estiver tudo pronto. Até lá, programas e atletas veem o evento como \"Em breve\", e as abas Inscrições e Solicitações ficam bloqueadas."
      : status === "paused"
        ? "Programas e atletas não conseguem se inscrever nem alterar as fichas, e veem o evento como \"Em breve\". Você continua acompanhando as inscrições e respondendo as solicitações."
        : open
          ? "Programas e atletas já podem se inscrever. Pausar impede novas inscrições e alterações até você retomar."
          : "O prazo de inscrição terminou. Para reabrir, mude o prazo acima.";

  const canStart = event.status === "created" || event.status === "published";

  return (
    <section
      className={cn(
        "grid gap-3 rounded-xl border p-4 sm:p-5",
        status === "open"
          ? "border-border/60 bg-card"
          : "border-amber-300/60 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-semibold text-foreground">Liberação das inscrições</h2>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", badge.className)}>
          {badge.label}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {choosingDeadline && canStart && (
        <div className="grid gap-2 rounded-lg border border-border/60 bg-card p-3 sm:p-4">
          <p className="text-sm font-medium text-foreground">Prazo de inscrição</p>
          <p className="text-xs text-muted-foreground">
            Os programas montam e enviam a ficha até as 23:59 (horário de Brasília) do dia
            escolhido. O prazo não pode passar da data de início do evento.
          </p>
          <RegistrationDeadlineFields value={deadline} onChange={setDeadline} startDate={event.startDate} />
          {deadline !== "" && deadlineError && (
            <p className="text-sm text-destructive">{deadlineError}</p>
          )}
        </div>
      )}
      {canStart && (status !== "open" || open) && (
        <div>
          {status === "open" ? (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
              <Pause data-icon="inline-start" />
              Pausar inscrições
            </Button>
          ) : (
            // Mesmo estilo do "Inscreva-se aqui!" do card da Home.
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={choosingDeadline && deadlineError !== null}
              title={choosingDeadline && deadlineError ? deadlineError : undefined}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Play className="size-3.5" />
              {status === "not_started" ? "Liberar inscrições" : "Retomar inscrições"}
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          next === "open"
            ? status === "paused"
              ? "Retomar inscrições?"
              : "Liberar inscrições?"
            : "Pausar inscrições?"
        }
        description={
          next === "open"
            ? choosingDeadline
              ? `Programas e atletas poderão se inscrever pelo link ou código do evento. ${deadlineSummary(deadline)}`
              : "Programas e atletas poderão se inscrever pelo link ou código do evento."
            : "Programas e atletas não vão conseguir se inscrever nem alterar as fichas até você retomar. O que já foi feito continua salvo."
        }
        confirmLabel={
          next === "open" ? (status === "paused" ? "Retomar" : "Liberar") : "Pausar"
        }
        confirmingLabel="Salvando..."
        confirmVariant="default"
        onConfirm={async () => {
          onSaved(
            await eventsApi.update(
              event.aliasId,
              choosingDeadline
                ? { registrationStatus: next, registrationDeadline: deadline || null }
                : { registrationStatus: next },
            ),
          );
        }}
      />
    </section>
  );
}

// Prazo de inscrição em destaque na aba Inscrições (2026-10-06): um dia
// (até 23:59 de Brasília, no máximo o início do evento) ou sem data
// limite. Salva assim que uma data válida é escolhida ou "Sem data limite"
// é marcado.
function DeadlineSection({
  event,
  onSaved,
}: {
  event: Event;
  onSaved: (event: Event) => void;
}) {
  // "" = sem data ainda (checkbox desmarcado esperando escolher).
  const [deadline, setDeadline] = useState<string | null>(event.registrationDeadline);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string | null) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      onSaved(await eventsApi.update(event.aliasId, { registrationDeadline: value }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <h2 className="font-semibold text-foreground">Prazo de inscrição</h2>
      <p className="text-sm text-muted-foreground">
        Os programas montam e enviam a ficha até as 23:59 (horário de Brasília) do dia escolhido.
        O prazo não pode passar da data de início do evento.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <RegistrationDeadlineFields
          value={deadline}
          startDate={event.startDate}
          disabled={saving}
          onChange={(value) => {
            setDeadline(value);
            if (value === "") setSaved(false);
            else void save(value);
          }}
        />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? "Salvando..." : saved ? "Salvo" : deadline === "" ? "Escolha a data." : ""}
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

function deadlineSummary(deadline: string | null): string {
  if (deadline === null) return "Sem data limite de inscrição.";
  const [y, m, d] = deadline.split("-");
  return `Inscrições até ${d}/${m}/${y}, 23:59 (horário de Brasília).`;
}

type RegistrationStatus = "draft" | "submitted" | "reopened";
type StatusFilter = "all" | RegistrationStatus;

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Todos os status",
  draft: "Rascunho",
  submitted: "Enviada",
  reopened: "Liberada para edição",
};

// Situação da ficha: rascunho (iniciada, não enviada), enviada ou
// devolvida pelo organizador pra edição.
function registrationStatus(program: Program): RegistrationStatus {
  if (!program.submittedAt) return "draft";
  return program.reopenedAt ? "reopened" : "submitted";
}

const STATUS_TAG_STYLES: Record<RegistrationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  reopened: "bg-primary/10 text-primary",
};

// Tags da ficha no cartão: status, quem inscreveu (organizador), pendências
// que impedem o envio
// (clicável: abre a aba Pendências da ficha) e documentos pendentes.
function RegistrationTags({
  program,
  issues,
  onShowIssues,
}: {
  program: Program;
  issues: ProgramRegistrationIssues | null;
  onShowIssues: () => void;
}) {
  const status = registrationStatus(program);
  const blocking = issues?.issues.filter((i) => i.blocking).length ?? 0;
  const documents = issues?.documentsPendingCount ?? 0;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TAG_STYLES[status])}>
        {STATUS_FILTER_LABELS[status]}
      </span>
      {/* Inscrição feita pelo organizador e nunca enviada pelo próprio
          programa (se ele envia pela ficha dele, a tag some). Rascunho
          nunca é do organizador: pode ter sido aberto pelo pedido de um
          atleta (2026-10-10). */}
      {!!program.submittedAt &&
        !isSelfRegistered(program) &&
        !(program.userId && program.submittedBy === program.userId) && (
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Inscrito pelo organizador
        </span>
      )}
      {/* Ficha aberta por atletas pra um programa sem conta: espera o
          programa se cadastrar com esse email. */}
      {!program.userId && !program.submittedAt && (
        <span
          title={`Atletas pediram inscrição por este programa. Ele foi avisado em ${program.email} e responde depois de criar a conta.`}
          className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          Programa sem conta
        </span>
      )}
      {(program.pendingAthleteRequestsCount ?? 0) > 0 && (
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">
          {program.pendingAthleteRequestsCount === 1
            ? "1 pedido de atleta aguardando o programa"
            : `${program.pendingAthleteRequestsCount} pedidos de atletas aguardando o programa`}
        </span>
      )}
      {blocking > 0 && (
        <button
          type="button"
          onClick={onShowIssues}
          className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/20"
        >
          {pluralize(blocking, "pendência", "pendências")}
        </button>
      )}
      {documents > 0 && (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          {documents === 1 ? "1 documento pendente" : `${documents} documentos pendentes`}
        </span>
      )}
    </div>
  );
}

const VISIBLE_TEAMS = 3;

// Linha do programa: identidade | números | equipes | Abrir ficha de inscrição. A partir de
// xl fica tudo numa linha (como o mock de 2026-10-05); abaixo disso empilha,
// com os números lado a lado e o botão ocupando a largura no celular.
function ProgramCard({
  program,
  issues,
  onShowIssues,
  onOpen,
  onShow,
  onShowRequests,
}: {
  program: Program;
  issues: ProgramRegistrationIssues | null;
  onShowIssues: () => void;
  onOpen: () => void;
  onShow: (mode: ProgramOverviewMode) => void;
  onShowRequests: () => void;
}) {
  const teams = [...(program.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const teamsCount = program.teamsCount ?? teams.length;
  const categoriesCount = programCategories(program).length;
  const visibleTeams = teams.slice(0, VISIBLE_TEAMS);
  const hiddenTeams = teams.length - visibleTeams.length;
  // Só o botão "Abrir ficha de inscrição" abre o programa; os números de atletas,
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
          <RegistrationTags program={program} issues={issues} onShowIssues={onShowIssues} />
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
        Abrir ficha de inscrição
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
