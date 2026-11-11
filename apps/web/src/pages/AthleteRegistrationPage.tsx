import { RegulationDocumentsMenu } from "@/components/RegulationDocumentsMenu";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Info,
  MessageSquare,
  Plus,
  X,
  Users,
  XCircle,
  Send,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { EventThumbnail } from "@/components/EventThumbnail";
import { FormError } from "@/components/FormError";
import { CategoryStepPicker } from "@/components/CategoryStepPicker";
import {
  AthleteRequirementsPanel,
  type RequirementsAdapter,
} from "@/components/AthleteRequirementsPanel";
import { useAuthStore } from "@/store/auth";
import { closedRegistrationLabel, formatDeadline } from "@/lib/registrationWindow";
import { cn } from "@/lib/utils";
import {
  ApiError,
  athleteRegistrationApi,
  usersApi,
  type AthleteRegistrationEntry,
  type AthleteRegistrationEvent,
  type AthleteRequirementsView,
  type Category,
  type UserProfile,
} from "@/api/client";

// Itens obrigatórios que faltam (mesma regra da API, pendingRequirements).
function pendingItems(view: AthleteRequirementsView, includeOptionalDocs: boolean) {
  return view.items.filter((item) => {
    if (!item.applies || !item.requirement.required) return false;
    if (item.requirement.kind === "document") {
      if (view.allowSubmitWithoutDocuments && !includeOptionalDocs) return false;
      return !item.document || item.document.status === "contested";
    }
    return !item.value;
  });
}

// Chave estável de uma inscrição na tela: o programId nasce só quando o
// programa do elenco ganha ficha no evento.
const entryKey = (e: AthleteRegistrationEntry) => e.programUserId ?? e.programId;

// Pedido começado (qualquer situação) ou atleta já inscrito pelo programa.
const hasStarted = (e: AthleteRegistrationEntry) => !!e.request || e.categories.length > 0;

// Algo a resolver pelo atleta: correção pedida ou documento contestado.
const needsAction = (e: AthleteRegistrationEntry) =>
  (e.request?.status === "changes_requested" && !e.request.expired) || e.contestedCount > 0;

type Stage = "registration" | "approval" | "payment";

const STAGES: { key: Stage; label: string }[] = [
  { key: "registration", label: "Cadastro" },
  { key: "approval", label: "Aprovação" },
  { key: "payment", label: "Pagamento" },
];

// Etapa da inscrição neste programa (2026-10-10): Cadastro (montando ou
// corrigindo o pedido) -> Aprovação (pedido com o programa) -> Pagamento
// (aprovado, ou escalado direto pelo programa).
function stageOf(entry: AthleteRegistrationEntry): Stage {
  const status = entry.request?.status;
  if (status === "approved") return "payment";
  if (status === "submitted" || status === "correction_requested") return "approval";
  if (!entry.request && entry.categories.length > 0) return "payment";
  return "registration";
}

// Inscrição vista pelo atleta (pedido de inscrição, 2026-10-10): uma ficha
// por programa. O atleta escolhe as categorias, preenche dados e documentos
// e envia o pedido; o programa aprova (escolhendo a equipe), pede correção
// ou recusa. Dá pra pedir por mais de um programa e acrescentar um programa
// pelo email. Tudo salva na hora; documento novo fica na biblioteca.
export function AthleteRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AthleteRegistrationEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Aba do programa aberta (com dois ou mais programas).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    athleteRegistrationApi
      .get(id)
      .then(setView)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar a inscrição."),
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // "Seus programas": só os programas em que o atleta já começou um pedido
  // (ou em que o programa o inscreveu). Os outros vínculos dele vão para o
  // seletor de "por qual programa".
  const started = (view?.entries ?? []).filter(hasStarted);
  const choosable = (view?.entries ?? []).filter((e) => !hasStarted(e) && !e.programClosed);

  // Aberta: a escolhida; senão a primeira com algo a resolver; senão a
  // primeira.
  const active =
    started.find((e) => entryKey(e) === activeKey) ?? started.find(needsAction) ?? started[0];
  // Fixa a aba aberta: mudar a ordem ou a situação das fichas (ex.: ao
  // enviar um pedido) não troca de aba sozinho.
  const shownKey = active ? entryKey(active) : null;
  useEffect(() => {
    if (shownKey && shownKey !== activeKey) setActiveKey(shownKey);
  }, [shownKey, activeKey]);

  // Ficha ainda não enviada ao programa: o atleta pode excluir.
  const [discarding, setDiscarding] = useState<AthleteRegistrationEntry | null>(null);

  function handleChosen(next: AthleteRegistrationEvent, warning: string | null) {
    // Programa recém-escolhido abre na própria aba.
    const before = new Set(started.map(entryKey));
    const added = next.entries.find((e) => hasStarted(e) && !before.has(entryKey(e)));
    if (added) setActiveKey(entryKey(added));
    setView(next);
    setNotice(warning);
    setAddOpen(false);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={view === null && !error} />
        <div className="grid w-full grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-10 sm:py-10 lg:px-16">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 justify-self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Meus eventos
          </button>

          {error && <FormError message={error} />}

          {view && (
            <>
              <div className="flex min-w-0 items-center gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <EventThumbnail
                  name={view.name}
                  logoUrl={view.logoUrl}
                  className="size-14 shrink-0 rounded-xl text-base sm:size-16"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sua inscrição no evento</p>
                  <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                    {view.name}
                  </h1>
                  {/* Sem data limite: nada a mostrar. */}
                  {(!view.open || view.registrationDeadline) && (
                    <p
                      className={cn(
                        "mt-0.5 text-sm",
                        view.open
                          ? "text-muted-foreground"
                          : "font-medium text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {view.open
                        ? view.registrationDeadline
                          ? `Inscrições até ${formatDeadline(view.registrationDeadline)}, 23:59`
                          : null
                        : closedRegistrationLabel(view.registrationStatus)}
                    </p>
                  )}
                  <RegulationDocumentsMenu
                    documents={view.regulationDocuments ?? []}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Seus programas</h2>
                  <p className="text-sm text-muted-foreground">
                    Escolha o programa e as categorias em que irá competir.
                  </p>
                </div>
                {view.open && started.length === 1 && (
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => setAddOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Inscrever por outro programa
                  </Button>
                )}
              </div>

              {notice && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {notice}
                </p>
              )}

              {started.length === 0 ? (
                view.open ? (
                  <section className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                    <div className="grid gap-1">
                      <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Users className="size-4 text-muted-foreground" />
                        Por qual programa você vai competir?
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {choosable.length > 0
                          ? "Escolha um dos seus programas ou informe o email de outro."
                          : "Informe o email do programa (academia, escola ou universidade)."}
                      </p>
                    </div>
                    <ProgramChooser
                      eventId={view.eventId}
                      programs={choosable}
                      onDone={handleChosen}
                    />
                  </section>
                ) : (
                  <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border/60 px-4 py-10 text-center">
                    <Users className="size-6 text-muted-foreground" />
                    <p className="max-w-sm text-sm text-muted-foreground">
                      As inscrições deste evento estão encerradas.
                    </p>
                  </div>
                )
              ) : (
                <div className="grid gap-3">
                  {started.length > 1 && (
                    <ProgramTabs
                      entries={started}
                      activeKey={entryKey(active)}
                      onSelect={setActiveKey}
                      onAdd={view.open ? () => setAddOpen(true) : undefined}
                      onDiscard={setDiscarding}
                    />
                  )}
                  <EntryCard
                    key={entryKey(active)}
                    eventId={view.eventId}
                    open={view.open}
                    categories={view.categories ?? []}
                    maxCategories={view.maxCategoriesPerAthlete ?? null}
                    entry={active}
                    onView={setView}
                    onDiscard={
                      started.length === 1 && canDiscard(active) ? () => setDiscarding(active) : undefined
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={discarding !== null}
        onOpenChange={(o) => !o && setDiscarding(null)}
        title="Excluir ficha"
        description={`A ficha para o ${discarding?.programName ?? "programa"} será excluída, com as categorias escolhidas e os dados e documentos preenchidos nela. O programa não recebeu nada.`}
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={async () => {
          if (!discarding || !view) return;
          setView(await athleteRegistrationApi.discardRequest(view.eventId, discarding.athleteId));
          setDiscarding(null);
        }}
      />

      {view && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md sm:p-8">
            <div className="grid gap-1">
              <DialogTitle>Inscrever por outro programa</DialogTitle>
              <DialogDescription>
                {choosable.length > 0
                  ? "Escolha um dos seus programas ou informe o email de outro."
                  : "Informe o email do programa (academia, escola ou universidade) pelo qual você vai competir."}
              </DialogDescription>
            </div>
            {addOpen && (
              <ProgramChooser
                eventId={view.eventId}
                programs={choosable}
                onDone={handleChosen}
                onCancel={() => setAddOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EntryCard({
  eventId,
  open,
  categories,
  maxCategories,
  entry,
  onView,
  onDiscard,
}: {
  eventId: string;
  open: boolean;
  categories: Category[];
  maxCategories: number | null;
  entry: AthleteRegistrationEntry;
  onView: (view: AthleteRegistrationEvent) => void;
  // Sem abas (um programa só): o X de excluir a ficha fica no cabeçalho.
  onDiscard?: () => void;
}) {
  const [requirements, setRequirements] = useState(entry.requirements);
  // Salvar as categorias devolve os dados pedidos já recalculados.
  useEffect(() => setRequirements(entry.requirements), [entry.requirements]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>(entry.request?.categoryIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = entryKey(entry);

  const adapter = useMemo<RequirementsAdapter>(
    () => ({
      list: async () => {
        const next = await athleteRegistrationApi.get(eventId);
        const own = next.entries.find((e) => entryKey(e) === key);
        if (!own) throw new ApiError("Inscrição não encontrada.", 404);
        return own.requirements;
      },
      set: (requirementId, value) =>
        athleteRegistrationApi.set(eventId, entry.athleteId, requirementId, value),
      uploadDocument: (requirementId, files, libraryIds) =>
        athleteRegistrationApi.uploadDocument(eventId, entry.athleteId, requirementId, files, libraryIds),
      removeDocument: (requirementId) =>
        athleteRegistrationApi.removeDocument(eventId, entry.athleteId, requirementId),
      openFile: (requirementId, index, fileName) =>
        athleteRegistrationApi.openFile(eventId, entry.athleteId, requirementId, index, fileName),
      useLibrary: true,
    }),
    [eventId, entry.athleteId, key],
  );

  const request = entry.request;
  const stage = stageOf(entry);
  const expired = !!request?.expired;
  // Montando o pedido (inclusive depois de correção pedida ou recusa).
  const canEditRequest = open && !entry.programClosed && stage === "registration";
  const missing = pendingItems(requirements, false);
  const laterDocs = requirements.allowSubmitWithoutDocuments
    ? pendingItems(requirements, true).filter((i) => i.requirement.kind === "document")
    : [];
  const pendingLabels = [...missing, ...laterDocs].map((i) => i.requirement.label.toLowerCase());
  const categoryName = (cid: string) => categories.find((c) => c.id === cid)?.name ?? "Categoria";

  // Salva em fila, sempre a seleção mais recente: a lista não trava
  // durante o salvamento (travar fazia piscar) e cliques rápidos não chegam
  // fora de ordem no servidor.
  const pendingIdsRef = useRef<string[] | null>(null);
  const savingRef = useRef(false);
  async function saveRequest(nextIds: string[]) {
    pendingIdsRef.current = nextIds;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      while (pendingIdsRef.current) {
        const ids = pendingIdsRef.current;
        pendingIdsRef.current = null;
        const next = await athleteRegistrationApi.saveRequest(eventId, entry.athleteId, {
          categoryIds: ids,
        });
        // Só aplica a resposta do último clique.
        if (!pendingIdsRef.current) onView(next);
      }
    } catch (err) {
      pendingIdsRef.current = null;
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Seleção mais recente, mesmo entre cliques antes de a tela atualizar.
  const latestIdsRef = useRef(categoryIds);
  function toggleCategory(cid: string) {
    const current = latestIdsRef.current;
    if (!current.includes(cid) && maxCategories !== null && current.length >= maxCategories) return;
    const next = current.includes(cid) ? current.filter((x) => x !== cid) : [...current, cid];
    latestIdsRef.current = next;
    setCategoryIds(next);
    void saveRequest(next);
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-all">{entry.programName}</span>
          {/* Sem conta, o nome é o próprio email (troca no cadastro). */}
          {!entry.programHasAccount && (
            <span className="shrink-0 text-sm font-normal text-muted-foreground">
              (ainda sem conta)
            </span>
          )}
          {onDiscard && <DiscardButton programName={entry.programName} onClick={onDiscard} />}
        </p>
        <StageSteps stage={stage} />
      </div>

      <StatusMessage entry={entry} stage={stage} open={open} />

      {/* Categorias: o atleta escolhe; a equipe é o programa que define na
          aprovação. */}
      <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {stage === "payment" ? "Suas categorias" : "Categorias em que quer competir"}
          </p>
          <p className="text-xs text-muted-foreground">
            {stage === "payment"
              ? `Definidas pelo ${entry.programName}. Para mudar algo, fale com o programa.`
              : canEditRequest
                ? `Adicione uma ou mais. Sua requisição será aprovada previamente pelo representante do programa ${entry.programName} antes de passar para a etapa de pagamento.`
                : "Categorias do seu pedido."}
          </p>
        </div>
        {stage === "payment" ? (
          <>
            <ChipList
              labels={entry.categories.map((c) => `${c.teamName} · ${c.categoryName}`)}
              empty="Nenhuma categoria."
            />
            {/* Aprovada: as categorias só mudam com pedido de correção. */}
            {request?.status === "approved" && open && !entry.programClosed && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto sm:justify-self-start"
                onClick={() => setCorrectionOpen(true)}
              >
                <MessageSquare data-icon="inline-start" />
                Pedir correção
              </Button>
            )}
          </>
        ) : canEditRequest ? (
          <CategoryStepPicker
            categories={categories}
            selected={categoryIds}
            max={maxCategories}
            birthDate={requirements.birthDate ?? null}
            onToggle={toggleCategory}
          />
        ) : (
          <ChipList labels={categoryIds.map(categoryName)} empty="Nenhuma categoria escolhida." />
        )}

        <FormError message={error} />
      </div>

      <dl>
        <AthleteRequirementsPanel
          adapter={adapter}
          initialView={entry.requirements}
          onChanged={setRequirements}
        />
      </dl>

      {canEditRequest && !expired && (
        <div className="grid gap-2">
          {categoryIds.length === 0 ? (
            <PendingBox labels={["escolha ao menos uma categoria"]} />
          ) : missing.length > 0 ? (
            <PendingBox labels={missing.map((i) => i.requirement.label.toLowerCase())} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tudo pronto! Envie o pedido para o {entry.programName} aprovar.
            </p>
          )}
          <Button
            // Habilitado: mesmo degradê do "Inscreva-se aqui!", pra chamar
            // atenção (pedido do usuário, 2026-11-10).
            className={cn(
              "h-10 w-full rounded-full px-6 sm:w-auto sm:justify-self-end",
              !(saving || categoryIds.length === 0 || missing.length > 0) &&
                "bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md hover:opacity-90",
            )}
            disabled={saving || categoryIds.length === 0 || missing.length > 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Send data-icon="inline-start" />
            {request?.status === "changes_requested" ? "Reenviar pedido" : "Enviar pedido"}
          </Button>
        </div>
      )}
      {!canEditRequest && open && pendingLabels.length > 0 && requirements.documentsEditable && (
        <PendingBox labels={pendingLabels} />
      )}

      <CorrectionDialog
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        programName={entry.programName}
        onSend={async (message) =>
          onView(await athleteRegistrationApi.requestCorrection(eventId, entry.athleteId, message))
        }
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Enviar pedido de inscrição"
        description={`O ${entry.programName} vai receber seu pedido com ${categoryIds.length === 1 ? "1 categoria" : `${categoryIds.length} categorias`}, seus dados e documentos. Depois de enviado, só o programa pode mudar o pedido.`}
        confirmLabel="Enviar"
        confirmingLabel="Enviando..."
        confirmVariant="default"
        onConfirm={async () => {
          onView(await athleteRegistrationApi.submit(eventId, entry.athleteId));
          setConfirmOpen(false);
        }}
      />
    </section>
  );
}

// Inscrição aprovada: o atleta pede ao programa uma mudança nas categorias.
function CorrectionDialog({
  open,
  onOpenChange,
  programName,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programName: string;
  onSend: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setError(null);
    }
  }, [open]);

  async function send() {
    setSaving(true);
    setError(null);
    try {
      await onSend(message.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>Pedir correção</DialogTitle>
          <DialogDescription>
            {`Diga ao ${programName} o que você quer mudar. Sua inscrição volta para a etapa de aprovação até o programa responder.`}
          </DialogDescription>
        </div>
        <Textarea
          autoFocus
          value={message}
          maxLength={2000}
          placeholder="Ex.: quero sair do Team Cheer N3."
          onChange={(e) => setMessage(e.target.value)}
        />
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void send()} disabled={saving || !message.trim()}>
            {saving ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StageSteps({ stage }: { stage: Stage }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="flex items-center gap-1.5 text-xs">
      {STAGES.map((s, index) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {index > 0 && <span className="h-px w-3 bg-border sm:w-5" />}
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
              index < current && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              index === current && "bg-primary text-primary-foreground",
              index > current && "bg-muted text-muted-foreground",
            )}
          >
            {index < current && <Check className="size-3" />}
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Situação do pedido em uma frase (com o recado do programa quando há).
function StatusMessage({
  entry,
  stage,
  open,
}: {
  entry: AthleteRegistrationEntry;
  stage: Stage;
  open: boolean;
}) {
  const request = entry.request;
  const program = entry.programName;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

  if (stage === "payment") {
    return (
      <Box tone="success" icon={CheckCircle2}>
        {request
          ? `Inscrição aprovada pelo ${program}. A próxima etapa é o pagamento: você será avisado quando estiver disponível.`
          : `O ${program} inscreveu você neste evento. A próxima etapa é o pagamento: você será avisado quando estiver disponível.`}
      </Box>
    );
  }
  if (request?.expired) {
    return (
      <Box tone="warning" icon={Clock}>
        O prazo de inscrição acabou antes de o pedido ser respondido.
      </Box>
    );
  }
  if (request?.status === "correction_requested") {
    return (
      <Box tone="warning" icon={Clock} message={request.note}>
        {`Pedido de correção enviado em ${date(request.submittedAt)}. Aguardando o ${program}, que pode aprovar com as mudanças ou manter a inscrição como está. Depois disso, ela segue para a etapa de pagamento.`}
      </Box>
    );
  }
  if (stage === "approval") {
    return (
      <Box tone="warning" icon={Clock}>
        {`Pedido enviado em ${date(request?.submittedAt ?? null)}. Aguardando a aprovação do ${program}. Depois de aprovado, sua inscrição é liberada para a etapa de pagamento.`}
        {!entry.programHasAccount &&
          ` O ${program} ainda não tem conta na Cheer Cup: avisamos por email e o pedido fica aguardando o cadastro.`}
      </Box>
    );
  }
  if (entry.programClosed) {
    return (
      <Box tone="warning" icon={Info}>
        Este programa já fechou a inscrição neste evento.
      </Box>
    );
  }
  if (!open) {
    return (
      <Box tone="warning" icon={Info}>
        As inscrições deste evento estão encerradas.
      </Box>
    );
  }
  if (request?.status === "changes_requested") {
    return (
      <Box tone="warning" icon={AlertTriangle} message={request.responseMessage}>
        {`O ${program} pediu uma correção. Ajuste e envie de novo.`}
      </Box>
    );
  }
  if (request?.status === "rejected") {
    return (
      <Box tone="danger" icon={XCircle} message={request.responseMessage}>
        {`O ${program} recusou seu pedido. Você pode fazer um novo pedido.`}
      </Box>
    );
  }
  return null;
}

const BOX_TONES = {
  success: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  info: "bg-primary/5 text-foreground",
  warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
};

function Box({
  tone,
  icon: Icon,
  message,
  children,
}: {
  tone: keyof typeof BOX_TONES;
  icon: typeof Info;
  message?: string | null;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm", BOX_TONES[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        <p>{children}</p>
        {message && <p className="whitespace-pre-line text-foreground/80">"{message}"</p>}
      </div>
    </div>
  );
}

function ChipList({ labels, empty }: { labels: string[]; empty: string }) {
  if (labels.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// Uma aba por programa (com dois ou mais): nome, etapa e bolinha vermelha
// quando há algo a resolver. "+ Outro programa" no fim. No celular a linha
// rola para o lado e a aba tocada vai para o centro.
function ProgramTabs({
  entries,
  activeKey,
  onSelect,
  onAdd,
  onDiscard,
}: {
  entries: AthleteRegistrationEntry[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAdd?: () => void;
  onDiscard: (entry: AthleteRegistrationEntry) => void;
}) {
  return (
    <div className="scrollbar-none flex overflow-x-auto border-b border-border" role="tablist">
      {entries.map((entry) => {
        const key = entryKey(entry);
        const selected = key === activeKey;
        return (
          <div
            key={key}
            className={cn(
              "flex shrink-0 items-center border-b-2",
              selected ? "border-primary" : "border-transparent",
            )}
          >
          <button
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={(e) => {
              onSelect(key);
              e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }}
            className={cn(
              "py-2.5 pl-4 text-left",
              canDiscard(entry) ? "pr-1" : "pr-4",
              selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex max-w-56 items-center gap-1.5 text-sm font-medium">
              <span className="truncate">{entry.programName}</span>
              {needsAction(entry) && (
                <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label="Algo a resolver" />
              )}
            </span>
          </button>
          {canDiscard(entry) && (
            <DiscardButton programName={entry.programName} onClick={() => onDiscard(entry)} />
          )}
          </div>
        );
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" />
          Outro programa
        </button>
      )}
    </div>
  );
}

function canDiscard(entry: AthleteRegistrationEntry) {
  return entry.request?.status === "draft";
}

function DiscardButton({ programName, onClick }: { programName: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Excluir ficha"
      aria-label={`Excluir ficha do ${programName}`}
      className="mr-2 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <X className="size-3.5" />
    </button>
  );
}

const OTHER_PROGRAM = "__other__";

// Escolhe o programa do pedido: um dos programas do atleta (seletor, com
// "Outro programa") ou, sem nenhum, direto o email. Programa sem conta é
// avisado por email e responde depois de criar a conta.
function ProgramChooser({
  eventId,
  programs,
  onDone,
  onCancel,
}: {
  eventId: string;
  programs: AthleteRegistrationEntry[];
  onDone: (view: AthleteRegistrationEvent, warning: string | null) => void;
  onCancel?: () => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const askEmail = programs.length === 0 || choice === OTHER_PROGRAM;
  const chosen = programs.find((p) => entryKey(p) === choice) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (chosen) {
        // Abre o pedido (rascunho, sem categorias) com o programa escolhido.
        onDone(await athleteRegistrationApi.saveRequest(eventId, chosen.athleteId, { categoryIds: [] }), null);
      } else {
        const result = await athleteRegistrationApi.addProgram(eventId, { email: email.trim() });
        onDone(result.registration, result.warning);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível continuar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {programs.length > 0 && (
        <Select value={choice} onValueChange={(value) => setChoice(value ?? null)}>
          <SelectTrigger className="w-full" aria-label="Programa">
            <SelectValue>
              {(value: string | null) =>
                !value
                  ? "Escolha o programa"
                  : value === OTHER_PROGRAM
                    ? "Outro programa"
                    : (programs.find((p) => entryKey(p) === value)?.programName ?? "Escolha o programa")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={entryKey(p)} value={entryKey(p)}>
                {p.programName}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_PROGRAM}>Outro programa (informar email)</SelectItem>
          </SelectContent>
        </Select>
      )}
      {askEmail && (
        <Input
          type="email"
          required
          autoFocus={programs.length > 0}
          aria-label="Email do programa"
          placeholder="email@programa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
      <FormError message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={saving || (askEmail ? !email.trim() : !chosen)}>
          {saving ? "Abrindo..." : "Continuar"}
        </Button>
      </div>
    </form>
  );
}

// Pendências em amarelo, uma por tópico.
function PendingBox({ labels }: { labels: string[] }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        <p className="font-medium">Pendências:</p>
        <ul className="list-disc space-y-0.5 pl-5">
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
