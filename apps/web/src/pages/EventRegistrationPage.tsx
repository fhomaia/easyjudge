import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  GripVertical,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { EventCelebrationOverlay } from "@/components/EventCelebrationOverlay";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationsUnreadStore } from "@/store/notificationsUnread";
import { PageLoadingOverlay } from "@/components/PageLoadingOverlay";
import { EventThumbnail } from "@/components/EventThumbnail";
import { FormError } from "@/components/FormError";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DatePicker } from "@/components/DatePicker";
import { TruncatedText } from "@/components/TruncatedText";
import { AthleteRequirementsPanel } from "@/components/AthleteRequirementsPanel";
import { CreateTeamDialog } from "@/components/CreateTeamDialog";
import { EditTeamDialog } from "@/components/EditTeamDialog";
import { CreateAthleteDialog } from "@/components/CreateAthleteDialog";
import { AthleteChecklist } from "@/components/AthleteChecklist";
import { RegistrationIssueGroups, issueSubject } from "@/components/RegistrationIssueGroups";
import {
  CategoryFilters,
  EMPTY_CATEGORY_FILTER,
  filterCategories,
  groupCategoriesByModality,
  type CategoryFilterState,
} from "@/components/CategoryFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RegistrationRequestItem } from "@/components/RegistrationRequestItem";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getAvatarColor } from "@/lib/avatarColor";
import { formatDeadline } from "@/lib/registrationWindow";
import { athleteInitials, athleteName, pluralize } from "@/lib/programAthletes";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import {
  ApiError,
  athletesApi,
  programAthletesApi,
  registrationApi,
  teamsApi,
  usersApi,
  type AthleteLinkView,
  type Category,
  type CategoryRules,
  type ProgramAthlete,
  type ProgramRegistrationView,
  type RegistrationIssue,
  type RegistrationRequestType,
  type Team,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

type Tab = "registration" | "athletes";

// Popup de atletas de uma equipe numa categoria em que ela já está.
interface PairTarget {
  team: Team;
  category: Category;
}

// Inscrição de um evento pela própria conta Programa (2026-10-05, segunda
// versão a pedido do usuário): uma tela só, com cabeçalho do programa e
// duas abas. "Inscrição": equipes do programa (com atalhos de equipes de
// outros eventos) e, abaixo, as categorias do evento; arrastar a equipe
// pra categoria (ou tocar na equipe e marcar categorias) e escolher os
// atletas de cada equipe+categoria. "Atletas": o elenco do programa; só
// quem está em alguma categoria participa do evento. Tudo salva na hora;
// depois do prazo vira consulta.
export function EventRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const accountRole = useAuthStore((s) => s.role);
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ProgramRegistrationView | null>(null);
  const [eventAthletes, setEventAthletes] = useState<ProgramAthlete[]>([]);
  const [roster, setRoster] = useState<AthleteLinkView[]>([]);
  const [tab, setTab] = useState<Tab>("registration");
  const [error, setError] = useState<string | null>(null);
  const unreadHere = useNotificationsUnreadStore((s) => (id ? (s.byEvent[id] ?? 0) : 0));
  const [actionError, setActionError] = useState<string | null>(null);

  const [locationOpen, setLocationOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [teamTarget, setTeamTarget] = useState<Team | null>(null);
  const [renameTarget, setRenameTarget] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [pairTarget, setPairTarget] = useState<PairTarget | null>(null);
  // Popup "Dados da inscrição" de um atleta do evento (aba Configurações do
  // produtor define o que é pedido).
  const [dataTarget, setDataTarget] = useState<{ athleteId: string; name: string } | null>(null);
  // Tirar a equipe de uma categoria (× no cartão ou arrastar pra fora);
  // `to` = soltou em outra categoria (mover).
  const [unassignTarget, setUnassignTarget] = useState<{
    team: Team;
    from: Category;
    to: Category | null;
  } | null>(null);
  const [athleteTarget, setAthleteTarget] = useState<AthleteLinkView | null>(null);
  const [createAthleteOpen, setCreateAthleteOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<AthleteLinkView | null>(null);
  // Mesma comemoração (fumaça + frase) de publicar evento, ao enviar a ficha.
  const [celebration, setCelebration] = useState<"submit" | "resubmit" | null>(null);
  const [draggingTeam, setDraggingTeam] = useState<Team | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterState>(EMPTY_CATEGORY_FILTER);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (accountRole && accountRole !== "program") navigate("/", { replace: true });
  }, [accountRole, navigate]);

  const applyView = useCallback(
    async (next: ProgramRegistrationView) => {
      setView(next);
      if (id && next.program) setEventAthletes(await programAthletesApi.list(id, next.program.id));
    },
    [id],
  );

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [next, links] = await Promise.all([registrationApi.get(id), athletesApi.list()]);
      setRoster(links);
      await applyView(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a inscrição.");
    }
  }, [id, applyView]);

  useEffect(() => {
    void load();
  }, [load]);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  // Celular: segurar o dedo parado pra arrastar (mesmo padrão do Cronograma).
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } });
  const sensors = useSensors(isMobile ? touchSensor : pointerSensor);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Roda uma ação mostrando o erro da API no topo da aba.
  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    }
  }

  // A inscrição só nasce na primeira equipe (abrir a tela não inscreve).
  async function ensureProgramId(): Promise<string | null> {
    if (!id || !view) return null;
    if (view.program) return view.program.id;
    if (!view.profile.city || !view.profile.state) {
      setLocationOpen(true);
      return null;
    }
    const next = await registrationApi.register(id);
    await applyView(next);
    return next.program?.id ?? null;
  }

  function handleNewTeam() {
    void run(async () => {
      if (await ensureProgramId()) setCreateTeamOpen(true);
    });
  }

  function handleReuseTeam(name: string) {
    void run(async () => {
      const programId = await ensureProgramId();
      if (!programId || !id) return;
      await teamsApi.create(id, programId, { name });
      await load();
    });
  }

  // Ids arrastáveis: `team.id` (lista de equipes) ou
  // `pair:<teamId>:<categoryId>` (equipe dentro de uma categoria).
  function parseDragId(dragId: string | number) {
    const raw = String(dragId);
    const [teamId, fromCategoryId] = raw.startsWith("pair:") ? raw.slice(5).split(":") : [raw, null];
    return {
      team: view?.program?.teams.find((t) => t.id === teamId) ?? null,
      from: fromCategoryId ? (view?.categories.find((c) => c.id === fromCategoryId) ?? null) : null,
    };
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingTeam(parseDragId(event.active.id).team);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTeam(null);
    const { team, from } = parseDragId(event.active.id);
    const category = view?.categories.find((c) => `cat:${c.id}` === event.over?.id) ?? null;
    if (!team || !id) return;

    // Equipe arrastada de dentro de uma categoria: soltar fora dela tira
    // (ou move, se caiu em outra categoria), com confirmação.
    if (from) {
      if (category?.id === from.id) return;
      setUnassignTarget({
        team,
        from,
        to: category && !team.categories.some((c) => c.id === category.id) ? category : null,
      });
      return;
    }

    // Da lista: soltar já inscreve a equipe na categoria (fica "Atletas
    // pendentes" até escolher os atletas) e abre o popup de atletas.
    if (!category) return;
    if (team.categories.some((c) => c.id === category.id)) {
      setPairTarget({ team, category });
      return;
    }
    void run(async () => {
      const next = await registrationApi.setTeamCategories(id, team.id, [
        ...team.categories.map((c) => c.id),
        category.id,
      ]);
      await applyView(next);
      const updated = next.program?.teams.find((t) => t.id === team.id);
      if (updated) setPairTarget({ team: updated, category });
    });
  }

  const program = view?.program ?? null;
  // Rascunho no prazo, ou ficha liberada pelo organizador (API decide).
  const editable = view?.canEdit === true;
  const categoryGroups = groupCategoriesByModality(
    filterCategories(view?.categories ?? [], categoryFilter),
  );
  const usableRoster = roster.filter((l) => l.confirmed && !l.emailIsProgramAccount && l.email);
  const pendingRoster = roster.filter((l) => !l.confirmed).length;

  return (
    <div className="flex h-dvh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="relative flex-1 overflow-y-auto pt-14 sm:pt-0">
        <PageLoadingOverlay loading={view === null && !error} />
        <div className="grid w-full grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-10 sm:py-10 lg:px-16">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Meus eventos
            </button>
            {/* Mesmo selo do Painel de jurados: tudo na ficha salva na hora.
                Só enquanto dá pra editar. */}
            <div className="flex items-center gap-3">
              {view?.canEdit && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Salvo automaticamente
                </span>
              )}
              {/* Avisos do organizador pro programa (ex.: ficha liberada). */}
              <NotificationBell unreadCount={unreadHere} />
            </div>
          </div>

          {error && !view && <p className="text-sm text-destructive">{error}</p>}

          {view && (
            <>
              <ProgramHeader view={view} onCompleteLocation={() => setLocationOpen(true)} />

              {program ? (
                <RegistrationStatusPanel
                  placement="top"
                  view={view}
                  onSubmit={async () => {
                    if (!id) return;
                    const resubmit = !!program.submittedAt;
                    await applyView(await registrationApi.submit(id));
                    setCelebration(resubmit ? "resubmit" : "submit");
                  }}
                  onRequest={async (type, message) => {
                    if (!id) return;
                    await applyView(await registrationApi.createRequest(id, type, message));
                  }}
                  onOpenData={setDataTarget}
                  onSetBirthDate={async (issue, birthDate) => {
                    if (!id) return;
                    // A data fica no elenco (vale pra todos os eventos);
                    // atleta cadastrado pelo produtor, sem vínculo, fica no
                    // atleta do evento.
                    if (issue.linkId) await athletesApi.setBirthDate(issue.linkId, birthDate);
                    else if (issue.athleteId) {
                      await programAthletesApi.update(id, program.id, issue.athleteId, { birthDate });
                    }
                    await load();
                  }}
                />
              ) : (
                !editable && (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
                    As inscrições deste evento estão encerradas.
                  </div>
                )
              )}

              <div className="flex gap-6 border-b border-border">
                {(
                  [
                    ["registration", "Inscrição"],
                    ["athletes", "Atletas"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      "-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors",
                      tab === key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <FormError message={actionError} />

              <LockedOverlay
                locked={!editable && !!program?.submittedAt}
                label={
                  view.canRequest
                    ? "Ficha enviada: edição bloqueada. Para mudar algo, envie um pedido ao organizador."
                    : "Ficha enviada: edição bloqueada."
                }
              >
                {tab === "registration" ? (
                  <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <section className="grid gap-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">Equipes</h2>
                          <p className="text-sm text-muted-foreground">
                            {editable
                              ? isMobile
                                ? "Adicione as equipes que vão participar. Toque numa equipe para escolher as categorias, ou segure e arraste até a categoria."
                                : "Adicione as equipes que vão participar. Arraste cada equipe até a categoria em que ela compete, ou clique na equipe para escolher as categorias."
                              : "Equipes inscritas pelo seu programa."}
                          </p>
                        </div>
                        {editable && (
                          <Button className="w-full sm:w-auto" onClick={handleNewTeam}>
                            <Plus data-icon="inline-start" />
                            Nova equipe
                          </Button>
                        )}
                      </div>

                      {editable && view.previousTeamNames.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Equipes de outros eventos:</span>
                          {view.previousTeamNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => handleReuseTeam(name)}
                              className="flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                            >
                              <Plus className="size-3" />
                              {name}
                            </button>
                          ))}
                        </div>
                      )}

                      {!program || program.teams.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                          Nenhuma equipe ainda.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {program.teams.map((team) => (
                            <TeamChip
                              key={team.id}
                              team={team}
                              draggable={editable}
                              onClick={() => editable && setTeamTarget(team)}
                            />
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="grid gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">Categorias do evento</h2>
                        <p className="text-sm text-muted-foreground">
                          {editable
                            ? "Toque numa equipe dentro da categoria para escolher os atletas dela."
                            : "Equipes e atletas em cada categoria."}
                        </p>
                      </div>
                      {view.categories.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                          O organizador ainda não cadastrou categorias.
                        </p>
                      ) : (
                        <>
                          <CategoryFilters
                            categories={view.categories}
                            criteria={view.categoryCriteria}
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                          />
                          {categoryGroups.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              Nenhuma categoria encontrada.
                            </p>
                          ) : (
                            categoryGroups.map((group) => (
                              <div key={group.key} className="grid gap-2">
                                <h3 className="text-sm font-semibold text-foreground">
                                  {group.label}{" "}
                                  <span className="font-normal text-muted-foreground">
                                    ({group.categories.length})
                                  </span>
                                </h3>
                                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  {group.categories.map((category) => (
                                    <CategoryDropCard
                                      key={category.id}
                                      category={category}
                                      teams={(program?.teams ?? []).filter((t) =>
                                        t.categories.some((c) => c.id === category.id),
                                      )}
                                      dragging={draggingTeam !== null}
                                      editable={editable}
                                      issues={(view.issues ?? []).filter(
                                        (i) => i.categoryId === category.id,
                                      )}
                                      onOpenPair={(team) => setPairTarget({ team, category })}
                                      onRemove={(team) =>
                                        setUnassignTarget({ team, from: category, to: null })
                                      }
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </section>

                    {/* Sem animação de volta ao soltar (parecia erro). */}
                    <DragOverlay dropAnimation={null}>
                      {draggingTeam && <TeamChip team={draggingTeam} overlay />}
                    </DragOverlay>
                  </DndContext>
                ) : (
                  <AthletesTab
                    view={view}
                    roster={usableRoster}
                    pendingCount={pendingRoster}
                    eventAthletes={eventAthletes}
                    editable={editable}
                    onAdd={() => setCreateAthleteOpen(true)}
                    onEditEntries={setAthleteTarget}
                    onOpenData={setDataTarget}
                  />
                )}
              </LockedOverlay>

              {/* Rascunho/ficha liberada: o envio fica no fim, depois de
                  montar a ficha (no topo só uma faixa curta). */}
              {program && (
                <RegistrationStatusPanel
                  placement="bottom"
                  view={view}
                  onSubmit={async () => {
                    if (!id) return;
                    const resubmit = !!program.submittedAt;
                    await applyView(await registrationApi.submit(id));
                    setCelebration(resubmit ? "resubmit" : "submit");
                  }}
                  onRequest={async (type, message) => {
                    if (!id) return;
                    await applyView(await registrationApi.createRequest(id, type, message));
                  }}
                  onOpenData={setDataTarget}
                  onSetBirthDate={async (issue, birthDate) => {
                    if (!id) return;
                    // A data fica no elenco (vale pra todos os eventos);
                    // atleta cadastrado pelo produtor, sem vínculo, fica no
                    // atleta do evento.
                    if (issue.linkId) await athletesApi.setBirthDate(issue.linkId, birthDate);
                    else if (issue.athleteId) {
                      await programAthletesApi.update(id, program.id, issue.athleteId, { birthDate });
                    }
                    await load();
                  }}
                />
              )}
            </>
          )}
        </div>
      </main>

      <EventCelebrationOverlay
        open={celebration !== null}
        title={celebration === "resubmit" ? "Inscrição reenviada!" : "Inscrição enviada!"}
        subtitle={
          celebration === "resubmit"
            ? "O organizador já recebeu sua ficha atualizada."
            : "Suas equipes estão na disputa. Bring it on!"
        }
        actionLabel="Voltar para Meus eventos"
        onAction={() => navigate("/")}
      />

      {view && id && (
        <>
          <LocationDialog
            open={locationOpen}
            view={view}
            onOpenChange={setLocationOpen}
            onSaved={async (next) => {
              await applyView(next);
              setLocationOpen(false);
            }}
          />
          {program && (
            <>
              <CreateTeamDialog
                eventId={id}
                programId={program.id}
                open={createTeamOpen}
                onOpenChange={setCreateTeamOpen}
                onCreated={() => void load()}
              />
              <EditTeamDialog
                eventId={id}
                programId={program.id}
                team={renameTarget}
                onOpenChange={(open) => !open && setRenameTarget(null)}
                onUpdated={() => void load()}
              />
            </>
          )}
          <TeamCategoriesDialog
            team={teamTarget}
            categories={view.categories}
            onOpenChange={(open) => !open && setTeamTarget(null)}
            onRename={(team) => {
              setTeamTarget(null);
              setRenameTarget(team);
            }}
            onDelete={(team) => {
              setTeamTarget(null);
              setDeleteTarget(team);
            }}
            onSave={async (team, categoryIds) =>
              applyView(await registrationApi.setTeamCategories(id, team.id, categoryIds))
            }
          />
          <DialogShell
            open={dataTarget !== null}
            onOpenChange={(open) => !open && setDataTarget(null)}
            title={dataTarget ? `Dados da inscrição: ${dataTarget.name}` : ""}
            description="O que o organizador pede de cada atleta. O próprio atleta também pode completar pela conta dele."
          >
            {dataTarget && program && (
              <AthleteRequirementsPanel
                eventId={id}
                programId={program.id}
                athleteId={dataTarget.athleteId}
                readOnly={!editable}
                onChanged={() => void load()}
              />
            )}
            <Button
              variant="outline"
              className="justify-self-end"
              onClick={() => setDataTarget(null)}
            >
              Fechar
            </Button>
          </DialogShell>
          <PairAthletesDialog
            target={pairTarget}
            roster={usableRoster}
            birthDates={view.rosterBirthDates ?? {}}
            onSetBirthDate={async (linkId, birthDate) => {
              await athletesApi.setBirthDate(linkId, birthDate);
              await load();
            }}
            eventAthletes={eventAthletes}
            onOpenChange={(open) => {
              if (!open) {
                setPairTarget(null);
                setCreatedLink(null);
              }
            }}
            onNewAthlete={() => setCreateAthleteOpen(true)}
            createdLink={createdLink}
            readOnly={!editable}
            onSave={async (target, linkIds) =>
              applyView(
                await registrationApi.setPairAthletes(id, target.team.id, target.category.id, linkIds),
              )
            }
            onRemoveFromCategory={async (target) =>
              applyView(
                await registrationApi.setTeamCategories(
                  id,
                  target.team.id,
                  target.team.categories.filter((c) => c.id !== target.category.id).map((c) => c.id),
                ),
              )
            }
          />
          <AthleteEntriesPicker
            athlete={athleteTarget}
            teams={program?.teams ?? []}
            categories={view.categories}
            birthDate={athleteTarget ? (view.rosterBirthDates?.[athleteTarget.id] ?? null) : null}
            onSetBirthDate={async (linkId, birthDate) => {
              await athletesApi.setBirthDate(linkId, birthDate);
              await load();
            }}
            eventAthletes={eventAthletes}
            onOpenChange={(open) => !open && setAthleteTarget(null)}
            onSave={async (link, entries) =>
              applyView(await registrationApi.setAthleteEntries(id, link.id, entries))
            }
          />
          <CreateAthleteDialog
            open={createAthleteOpen}
            onOpenChange={setCreateAthleteOpen}
            onCreated={(link) => {
              setRoster((prev) => [link, ...prev]);
              // Criado de dentro do popup de atletas: já marca lá.
              if (pairTarget) setCreatedLink(link);
            }}
          />
          <ConfirmDialog
            open={unassignTarget !== null}
            onOpenChange={(open) => !open && setUnassignTarget(null)}
            title={unassignTarget?.to ? "Mover equipe" : "Tirar da categoria"}
            description={
              unassignTarget?.to
                ? `Mover a equipe ${unassignTarget.team.name} de "${unassignTarget.from.name}" para "${unassignTarget.to.name}"? Os atletas escolhidos vão junto.`
                : `Tirar a equipe ${unassignTarget?.team.name} de "${unassignTarget?.from.name}"? Os atletas escolhidos nessa categoria saem dela.`
            }
            confirmLabel={unassignTarget?.to ? "Mover" : "Tirar"}
            confirmingLabel={unassignTarget?.to ? "Movendo..." : "Tirando..."}
            onConfirm={async () => {
              if (!unassignTarget) return;
              const { team, from, to } = unassignTarget;
              if (to) {
                await applyView(await registrationApi.moveTeamCategory(id, team.id, from.id, to.id));
                return;
              }
              const ids = team.categories.map((c) => c.id).filter((cid) => cid !== from.id);
              await applyView(await registrationApi.setTeamCategories(id, team.id, ids));
            }}
          />
          <ConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            title="Excluir equipe"
            description={`Excluir a equipe "${deleteTarget?.name}" da inscrição? Ela sai de todas as categorias.`}
            confirmLabel="Excluir"
            confirmingLabel="Excluindo..."
            onConfirm={async () => {
              if (!deleteTarget || !program) return;
              // Tirar das categorias antes tira do evento os atletas que só
              // estavam nela (a exclusão da equipe sozinha não faz isso).
              await registrationApi.setTeamCategories(id, deleteTarget.id, []);
              await teamsApi.remove(id, program.id, deleteTarget.id);
              await load();
            }}
          />
        </>
      )}
    </div>
  );
}

function ProgramHeader({
  view,
  onCompleteLocation,
}: {
  view: ProgramRegistrationView;
  onCompleteLocation: () => void;
}) {
  const { profile, event } = view;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      {/* Evento em destaque (é nele que o programa está se inscrevendo). */}
      <div className="flex min-w-0 items-center gap-4">
        <EventThumbnail
          name={event.name}
          logoUrl={event.logoUrl}
          className="size-14 shrink-0 rounded-xl text-base sm:size-16"
        />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Inscrição no evento</p>
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{event.name}</h1>
          {/* Sem data limite: nada a mostrar. */}
          {(!view.open || event.registrationDeadline) && (
          <p
            className={cn(
              "mt-0.5 text-sm",
              view.open ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-400",
            )}
          >
            {view.open
              ? event.registrationDeadline
                ? `Inscrições até ${formatDeadline(event.registrationDeadline)}, 23:59`
                : null
              : "Inscrições encerradas"}
          </p>
          )}
        </div>
      </div>
      {/* Programa dono da ficha. */}
      <div className="flex min-w-0 items-center gap-3 border-t border-border/60 pt-3 lg:max-w-sm lg:border-t-0 lg:pt-0">
        <EventThumbnail
          name={profile.name}
          logoUrl={profile.logoUrl}
          className="size-12 shrink-0 rounded-full text-sm"
        />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-foreground">{profile.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
            {profile.city && profile.state ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {profile.city} - {profile.state}
              </span>
            ) : (
              <button
                type="button"
                onClick={onCompleteLocation}
                className="flex items-center gap-1.5 font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                <MapPin className="size-3.5" />
                Informe a cidade e a UF
              </button>
            )}
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail className="size-3.5 shrink-0" />
              <TruncatedText text={profile.email} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ficha enviada: tudo legível (sem camada nem desfoque, pro programa
// conferir no que está inscrito); um selo com cadeado no topo deixa claro
// que a edição está bloqueada.
function LockedOverlay({
  locked,
  label,
  children,
}: {
  locked: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2 justify-self-start rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
        <Lock className="size-4 shrink-0 text-muted-foreground" />
        {label}
      </div>
      {/* Sem `inert`: com a ficha travada os botões de editar já somem, e
          clicar numa equipe dentro da categoria abre os atletas só pra ver. */}
      <div className="grid gap-6">{children}</div>
    </div>
  );
}

// Situação da ficha, no topo da tela:
// - rascunho: "Enviar inscrição" (o organizador só vê depois);
// - enviada: travada; "Solicitar alteração"/"Solicitar cancelamento" e a
//   lista de pedidos;
// - liberada pelo organizador: editável, "Reenviar inscrição".
function RegistrationStatusPanel({
  placement,
  view,
  onSubmit,
  onRequest,
  onSetBirthDate,
  onOpenData,
}: {
  // Rascunho e ficha liberada: faixa curta no topo e painel completo
  // (pendências + enviar) no fim. Ficha enviada: só no topo.
  placement: "top" | "bottom";
  view: ProgramRegistrationView;
  onSubmit: () => Promise<void>;
  onRequest: (type: RegistrationRequestType, message: string) => Promise<void>;
  onSetBirthDate: (issue: RegistrationIssue, birthDate: string) => Promise<void>;
  onOpenData: (target: { athleteId: string; name: string }) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestType, setRequestType] = useState<RegistrationRequestType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const program = view.program!;
  const deadline = view.event.registrationDeadline;
  const teamsInCategories = program.teams.filter((t) => t.categories.length > 0).length;
  const teamsWithout = program.teams.length - teamsInCategories;
  const reopened = !!program.submittedAt && !!program.reopenedAt;
  const pairsCount = program.teams.reduce((sum, t) => sum + t.categories.length, 0);
  const blockingIssues = view.issues.filter((i) => i.blocking);
  const warningIssues = view.issues.filter((i) => !i.blocking);
  const pendingNames = program.teams.flatMap((t) =>
    t.categories.filter((c) => (c.athletesCount ?? 0) === 0).map((c) => `${t.name} em ${c.name}`),
  );
  // O que ainda impede o envio (a API também barra).
  // Lista com marcadores (no celular a frase corrida ficava embolada).
  const sendBlocker =
    teamsInCategories === 0 ? (
      "Para enviar, coloque ao menos uma equipe em uma categoria."
    ) : pendingNames.length > 0 ? (
      <>
        Para enviar, escolha os atletas de:
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {pendingNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </>
    ) : blockingIssues.length > 0 ? (
      <IssuesList
        title="Para enviar, corrija:"
        issues={blockingIssues}
        teams={program.teams}
        onSetBirthDate={onSetBirthDate}
        onOpenData={onOpenData}
      />
    ) : null;
  // Documentos dos atletas que podem ser enviados depois (o produtor
  // permitiu enviar a ficha sem todos os documentos).
  const pendingLater =
    warningIssues.length > 0 ? (
      <IssuesList
        title={
          program.submittedAt && !reopened
            ? "Documentos que os atletas ainda precisam enviar até o prazo:"
            : "Documentos que os atletas ainda precisam enviar (pode enviar a ficha antes, até o prazo):"
        }
        issues={warningIssues}
        teams={program.teams}
        onSetBirthDate={onSetBirthDate}
        onOpenData={onOpenData}
      />
    ) : null;
  // Resumo da confirmação de envio, em linhas (ConfirmDialog respeita \n).
  const submitSummary = [
    `Você vai inscrever ${pluralize(teamsInCategories, "equipe", "equipes")} em ${pluralize(pairsCount, "categoria", "categorias")}.`,
    teamsWithout > 0
      ? `\nAtenção: ${pluralize(teamsWithout, "equipe", "equipes")} sem categoria não ${teamsWithout === 1 ? "será inscrita" : "serão inscritas"}.`
      : "",
    "\nDepois de enviar, você não poderá mais alterar a ficha. Para mudar algo, peça ao organizador.",
  ]
    .filter(Boolean)
    .join("\n");

  const submitButton = view.canEdit && (
    <>
      <Button
        className="w-full shrink-0 sm:w-auto"
        disabled={
          teamsInCategories === 0 || pendingNames.length > 0 || blockingIssues.length > 0
        }
        onClick={() => setConfirmOpen(true)}
      >
        <Send data-icon="inline-start" />
        {reopened ? "Reenviar inscrição" : "Enviar inscrição"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={reopened ? "Reenviar inscrição" : "Enviar inscrição"}
        description={submitSummary}
        confirmLabel="Enviar"
        confirmingLabel="Enviando..."
        confirmVariant="default"
        onConfirm={async () => {
          setError(null);
          try {
            await onSubmit();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente novamente.");
          }
        }}
      />
    </>
  );

  // Ficha ainda sendo montada (rascunho ou devolvida pelo organizador).
  const building = view.canEdit && (!program.submittedAt || reopened);
  if (placement === "bottom" && !building) return null;
  if (placement === "top" && building) {
    const pendingCount =
      (teamsInCategories === 0 ? 1 : 0) + pendingNames.length + blockingIssues.length;
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium text-foreground">
            {reopened ? "Ficha liberada para edição" : "Ficha em rascunho"}
          </span>
          <span className="text-muted-foreground">
            {" · "}
            {pendingCount > 0
              ? `${pluralize(pendingCount, "pendência", "pendências")} para enviar`
              : "pronta para enviar"}
          </span>
        </p>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("registration-submit")
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          className="self-start text-sm font-medium text-primary hover:underline sm:self-auto"
        >
          {pendingCount > 0 ? "Ver pendências" : "Ir para o envio"}
        </button>
      </div>
    );
  }

  if (!program.submittedAt) {
    if (!view.canEdit) {
      return (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
          As inscrições se encerraram antes de você enviar a ficha. Ela não foi enviada ao
          organizador.
        </div>
      );
    }
    return (
      <div
        id="registration-submit"
        className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between"
      >
        <div className="text-sm">
          <p className="font-medium text-foreground">Ficha em rascunho</p>
          <p className="text-muted-foreground">
            Monte equipes, categorias e atletas e envie quando terminar
            {deadline ? ` (até ${formatDeadline(deadline)})` : ""}. Após o envio será necessário
            abrir uma solicitação ao produtor do evento para fazer alterações.
          </p>
          {sendBlocker && (
            <div className="mt-1 font-medium text-amber-700 dark:text-amber-400">{sendBlocker}</div>
          )}
          {pendingLater && (
            <div className="mt-2 text-muted-foreground">{pendingLater}</div>
          )}
          {error && <p className="mt-1 text-destructive">{error}</p>}
        </div>
        {submitButton}
      </div>
    );
  }

  if (reopened && view.canEdit) {
    return (
      <div
        id="registration-submit"
        className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between"
      >
        <div className="text-sm">
          <p className="font-medium text-foreground">O organizador liberou sua ficha para edição</p>
          <p className="text-muted-foreground">
            Faça as mudanças e reenvie a inscrição. Ao reenviar, ela trava de novo.
          </p>
          {sendBlocker && (
            <div className="mt-1 font-medium text-amber-700 dark:text-amber-400">{sendBlocker}</div>
          )}
          {pendingLater && (
            <div className="mt-2 text-muted-foreground">{pendingLater}</div>
          )}
          {error && <p className="mt-1 text-destructive">{error}</p>}
        </div>
        {submitButton}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-sm dark:border-emerald-400/20 dark:bg-emerald-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-foreground">
              Inscrição enviada em {new Date(program.submittedAt).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-muted-foreground">
              {view.canRequest
                ? "A ficha não pode mais ser alterada. Para mudar algo ou cancelar, envie um pedido ao organizador."
                : "A ficha não pode mais ser alterada."}
            </p>
          </div>
        </div>
        {view.canRequest && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setRequestType("change")}>
              <MessageSquare data-icon="inline-start" />
              Solicitar alteração
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setRequestType("cancel")}
            >
              Solicitar cancelamento
            </Button>
          </div>
        )}
      </div>

      {/* Enviada sem todos os documentos: o que ainda falta. */}
      {pendingLater && view.open && (
        <div className="border-t border-emerald-300/50 pt-3 text-muted-foreground dark:border-emerald-400/20">
          {pendingLater}
        </div>
      )}

      {view.requests.length > 0 && (
        <div className="grid gap-2 border-t border-emerald-300/50 pt-3 dark:border-emerald-400/20">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Seus pedidos
          </p>
          {view.requests.map((r) => (
            <RegistrationRequestItem key={r.id} request={r} />
          ))}
        </div>
      )}

      <RequestDialog
        type={requestType}
        onOpenChange={(open) => !open && setRequestType(null)}
        onSend={onRequest}
      />
    </div>
  );
}

function RequestDialog({
  type,
  onOpenChange,
  onSend,
}: {
  type: RegistrationRequestType | null;
  onOpenChange: (open: boolean) => void;
  onSend: (type: RegistrationRequestType, message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const { saving, error, setError, save } = useSaver(onOpenChange);

  useEffect(() => {
    if (!type) return;
    setMessage("");
    setError(null);
  }, [type, setError]);

  return (
    <DialogShell
      open={type !== null}
      onOpenChange={onOpenChange}
      title={type === "cancel" ? "Solicitar cancelamento" : "Solicitar alteração"}
      description={
        type === "cancel"
          ? "O organizador recebe seu pedido por notificação."
          : "Descreva o que precisa mudar (equipes, categorias, atletas). O organizador recebe por notificação e por email."
      }
    >
      <Textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={5}
        aria-label={type === "cancel" ? "Justificativa (opcional)" : "O que precisa mudar"}
        placeholder={
          type === "cancel"
            ? "Justificativa (opcional)"
            : "Ex.: incluir a equipe Thunder no Group Stunt Nível 2"
        }
      />
      <FormError message={error} />
      <SaveRow
        saving={saving}
        saveLabel="Enviar pedido"
        onCancel={() => onOpenChange(false)}
        onSave={() => {
          if (!type) return;
          // Alteração precisa dizer o quê; cancelamento aceita sem texto.
          if (type === "change" && !message.trim()) {
            setError("Descreva o que precisa mudar.");
            return;
          }
          void save(() => onSend(type, message.trim()));
        }}
      />
    </DialogShell>
  );
}

// Visual de uma equipe (lista de equipes e dentro de cada categoria).
// `onRemove` mostra um × ao lado (botão irmão, não dentro do principal).
function TeamCardView({
  team,
  subtitle,
  grip = false,
  className,
  buttonRef,
  onRemove,
  ...props
}: {
  team: Team;
  subtitle: ReactNode;
  grip?: boolean;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  onRemove?: () => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  return (
    <div
      className={cn(
        "flex max-w-full items-center rounded-lg border border-border/60 bg-card shadow-sm transition-colors hover:border-primary/40",
        className,
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        {...props}
        className={cn(
          "flex min-w-0 touch-manipulation items-center gap-2 py-2 pl-2 text-left",
          onRemove ? "pr-1" : "pr-3",
          props.disabled ? "cursor-default" : "",
        )}
      >
        {grip && <GripVertical className="size-4 shrink-0 text-muted-foreground" />}
        <span
          style={{ backgroundColor: getAvatarColor(team.id) }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
        >
          <Users className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{team.name}</span>
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Tirar ${team.name} desta categoria`}
          className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function TeamChip({
  team,
  draggable = false,
  overlay = false,
  onClick,
}: {
  team: Team;
  draggable?: boolean;
  overlay?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: team.id,
    disabled: !draggable || overlay,
  });
  return (
    <TeamCardView
      team={team}
      grip={draggable}
      buttonRef={overlay ? undefined : setNodeRef}
      onClick={onClick}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={cn(
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "cursor-grabbing border-primary shadow-lg",
      )}
      subtitle={
        team.categories.length === 0
          ? "Sem categoria"
          : pluralize(team.categories.length, "categoria", "categorias")
      }
    />
  );
}

function CategoryDropCard({
  category,
  teams,
  dragging,
  editable,
  issues,
  onOpenPair,
  onRemove,
}: {
  category: Category;
  teams: Team[];
  dragging: boolean;
  editable: boolean;
  // Problemas das regras desta categoria (ver RegistrationIssue).
  issues: RegistrationIssue[];
  onOpenPair: (team: Team) => void;
  onRemove: (team: Team) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${category.id}`, disabled: !editable });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-w-0 content-start gap-2 rounded-xl border bg-card p-4 transition-colors",
        isOver
          ? "border-primary bg-primary/5"
          : dragging
            ? "border-dashed border-primary/40"
            : "border-border/60",
      )}
    >
      <p className="font-medium text-foreground">{category.name}</p>
      {rulesText(category) && (
        <p className="text-xs text-muted-foreground">{rulesText(category)}</p>
      )}
      {teams.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {editable ? "Arraste uma equipe para cá." : "Nenhuma equipe."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {teams.map((team) => {
            const count = team.categories.find((c) => c.id === category.id)?.athletesCount ?? 0;
            return (
              <PairTeamCard
                key={team.id}
                team={team}
                category={category}
                editable={editable}
                onClick={() => onOpenPair(team)}
                onRemove={() => onRemove(team)}
                subtitle={
                  count === 0 ? (
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      Atletas pendentes
                    </span>
                  ) : issues.some((i) => i.teamId === team.id) ? (
                    <span className="font-medium text-destructive">
                      {pluralize(count, "atleta", "atletas")} · fora da regra
                    </span>
                  ) : (
                    pluralize(count, "atleta", "atletas")
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Grupos do popup de atletas de uma categoria com regra de idade.
const ELIGIBILITY = {
  eligible: "Elegíveis",
  unknown: "Sem data de nascimento",
  outside: "Fora da faixa etária",
};

// Idade completa na data (aniversário na própria data conta); mesma conta
// da API (ProgramRegistrationService).
function ageAt(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

function hasAgeRule(rules: CategoryRules): boolean {
  return (rules.minAge != null || rules.maxAge != null) && !!rules.ageCutoffDate;
}

// Motivo de o atleta não poder entrar na categoria pela idade; null =
// elegível. Mesmas mensagens da API (ProgramRegistrationService).
function ageProblem(rules: CategoryRules, birthDate: string | null): string | null {
  if (!hasAgeRule(rules)) return null;
  if (!birthDate) return "Data de nascimento obrigatória para a categoria.";
  const age = ageAt(birthDate, rules.ageCutoffDate as string);
  if (rules.minAge != null && age < rules.minAge) {
    return `Não tem a idade mínima (${rules.minAge} anos).`;
  }
  if (rules.maxAge != null && age > rules.maxAge) {
    return `Idade superior ao máximo permitido (${rules.maxAge} anos).`;
  }
  return null;
}

// "16 a 24 atletas · 15 a 18 anos (idade em 01/12/2026)"; null sem regra.
function rulesText(category: Category): string | null {
  const r = category.rules;
  if (!r) return null;
  const range = (min: number | null, max: number | null, unit: string) =>
    min != null && max != null
      ? `${min} a ${max} ${unit}`
      : min != null
        ? `${min}+ ${unit}`
        : max != null
          ? `até ${max} ${unit}`
          : null;
  const athletes = range(r.minAthletes, r.maxAthletes, "atletas");
  const ages = range(r.minAge, r.maxAge, "anos");
  const parts = [
    athletes,
    ages && r.ageCutoffDate
      ? `${ages} (idade em ${r.ageCutoffDate.split("-").reverse().join("/")})`
      : ages,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// Regras da categoria em itens (popup de atletas): "Número de atletas: 2
// a 3", "Idade: até 12 anos", "Idade conferida em: 30/06/2026".
function rulesItems(category: Category): string[] {
  const r = category.rules;
  if (!r) return [];
  const range = (min: number | null, max: number | null, unit: string) =>
    min != null && max != null
      ? `${min} a ${max} ${unit}`
      : min != null
        ? `${min} ${unit} ou mais`
        : max != null
          ? `até ${max} ${unit}`
          : null;
  const athletes = range(r.minAthletes, r.maxAthletes, "atletas");
  const ages = range(r.minAge, r.maxAge, "anos");
  return [
    athletes && `Número de atletas: ${athletes}`,
    ages && `Idade: ${ages}`,
    ages && r.ageCutoffDate && `Idade conferida em: ${r.ageCutoffDate.split("-").reverse().join("/")}`,
  ].filter((item): item is string => !!item);
}

// Pendências que impedem o envio, agrupadas (RegistrationIssueGroups).
// Atleta sem data de nascimento ganha o campo ali mesmo.
function IssuesList({
  title,
  issues,
  teams,
  onSetBirthDate,
  onOpenData,
}: {
  title: string;
  issues: RegistrationIssue[];
  teams: Team[];
  onSetBirthDate: (issue: RegistrationIssue, birthDate: string) => Promise<void>;
  onOpenData: (target: { athleteId: string; name: string }) => void;
}) {
  return (
    <>
      {title}
      <div className="mt-2">
        <RegistrationIssueGroups
          issues={issues}
          teams={teams}
          renderActions={(issue) => (
            <>
              {issue.kind === "missing_birth_date" && (issue.linkId || issue.athleteId) && (
                <BirthDateFix onSave={(date) => onSetBirthDate(issue, date)} />
              )}
              {(issue.kind === "missing_requirement" || issue.kind === "missing_document") &&
                issue.athleteId && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenData({
                        athleteId: issue.athleteId as string,
                        name: issueSubject(issue.message),
                      })
                    }
                    className="ml-2 text-xs font-medium text-primary hover:underline"
                  >
                    {issue.kind === "missing_document" ? "Enviar" : "Preencher"}
                  </button>
                )}
            </>
          )}
        />
      </div>
    </>
  );
}

function BirthDateFix({
  onSave,
  compact = false,
}: {
  onSave: (date: string) => Promise<void>;
  // Dentro da lista de atletas: começa só com o botão "Informar data".
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-primary hover:underline"
      >
        Informar data de nascimento
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-normal">
      <div className="w-44">
        <DatePicker
          value={date}
          onChange={setDate}
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 100, 0, 1)}
          maxDate={new Date()}
        />
      </div>
      <Button
        size="sm"
        disabled={!date || saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await onSave(date);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Salvando..." : "Salvar data"}
      </Button>
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}

// Equipe dentro de uma categoria: clique abre os atletas; × ou arrastar
// pra fora tira (ver handleDragEnd).
function PairTeamCard({
  team,
  category,
  editable,
  subtitle,
  onClick,
  onRemove,
}: {
  team: Team;
  category: Category;
  editable: boolean;
  subtitle: ReactNode;
  onClick: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pair:${team.id}:${category.id}`,
    disabled: !editable,
  });
  return (
    <TeamCardView
      team={team}
      subtitle={subtitle}
      grip={editable}
      buttonRef={setNodeRef}
      onClick={onClick}
      onRemove={editable ? onRemove : undefined}
      {...attributes}
      {...listeners}
      className={cn(editable && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    />
  );
}

function AthletesTab({
  view,
  roster,
  pendingCount,
  eventAthletes,
  editable,
  onAdd,
  onEditEntries,
  onOpenData,
}: {
  view: ProgramRegistrationView;
  roster: AthleteLinkView[];
  pendingCount: number;
  eventAthletes: ProgramAthlete[];
  editable: boolean;
  onAdd: () => void;
  onEditEntries: (link: AthleteLinkView) => void;
  onOpenData: (target: { athleteId: string; name: string }) => void;
}) {
  const teams = view.program?.teams ?? [];
  const hasPairs = teams.some((t) => t.categories.length > 0);
  const sorted = [...roster].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "pt-BR"),
  );
  const competing = sorted.filter((l) => entriesOf(l, eventAthletes).length > 0);
  // Atletas que enviaram a própria inscrição (pela conta deles) mas ainda
  // não estão em nenhuma categoria: o programa precisa encaixá-los.
  const waiting = sorted.filter(
    (l) =>
      entriesOf(l, eventAthletes).length === 0 &&
      eventAthletes.some(
        (a) => a.email.toLowerCase() === l.email.toLowerCase() && !!a.athleteSubmittedAt,
      ),
  );
  // Abas: quem compete (com a situação dos dados), quem enviou e espera
  // categoria, e o elenco todo (onde se adiciona atleta).
  const [subTab, setSubTab] = useState<"competing" | "waiting" | "all">("competing");

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Atletas</h2>
          <p className="text-sm text-muted-foreground">Atletas vinculados ao seu programa.</p>
        </div>
        {editable && subTab === "all" && (
          <Button className="w-full sm:w-auto" onClick={onAdd}>
            <Plus data-icon="inline-start" />
            Adicionar atleta
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["competing", `Atletas competindo (${competing.length})`],
            ["waiting", `Sem categoria (${waiting.length})`],
            ["all", `Todos os atletas (${sorted.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              subTab === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {pendingCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {pendingCount === 1
            ? "1 pedido de vínculo esperando sua confirmação"
            : `${pendingCount} pedidos de vínculo esperando sua confirmação`}{" "}
          em{" "}
          <Link to="/athletes" className="font-medium text-primary hover:underline">
            Gerenciar atletas
          </Link>
          .
        </p>
      )}
      {editable && !hasPairs && roster.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Coloque suas equipes nas categorias (aba Inscrição) para escolher os atletas.
        </p>
      )}

      {subTab === "competing" ? (
      <AthleteRosterSection
        athletes={competing}
        teams={teams}
        eventAthletes={eventAthletes}
        editable={editable && hasPairs}
        onEditEntries={onEditEntries}
        onOpenData={onOpenData}
        issues={view.issues ?? []}
        emptyMessage="Nenhum atleta em categoria ainda."
      />
      ) : subTab === "waiting" ? (
      <AthleteRosterSection
        athletes={waiting}
        teams={teams}
        eventAthletes={eventAthletes}
        editable={editable && hasPairs}
        onEditEntries={onEditEntries}
        onOpenData={onOpenData}
        issues={view.issues ?? []}
        emptyMessage="Nenhum atleta enviou a inscrição sem estar numa categoria."
      />
      ) : (
      <AthleteRosterSection
        athletes={sorted}
        teams={teams}
        eventAthletes={eventAthletes}
        editable={editable && hasPairs}
        onEditEntries={onEditEntries}
        onOpenData={onOpenData}
        issues={view.issues ?? []}
        emptyMessage="Seu elenco ainda não tem atletas."
      />
      )}
    </section>
  );
}

// Uma lista de atletas do elenco com busca própria por nome ou email.
function AthleteRosterSection({
  athletes,
  teams,
  eventAthletes,
  editable,
  onEditEntries,
  onOpenData,
  issues,
  emptyMessage,
}: {
  athletes: AthleteLinkView[];
  teams: Team[];
  eventAthletes: ProgramAthlete[];
  editable: boolean;
  onEditEntries: (link: AthleteLinkView) => void;
  onOpenData: (target: { athleteId: string; name: string }) => void;
  issues: RegistrationIssue[];
  emptyMessage: string;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const shown = athletes.filter(
    (l) =>
      !query ||
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query),
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {athletes.length > 0 && (
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="pl-9"
            />
          </div>
        )}
      </div>

      {athletes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum atleta encontrado.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2">
          {shown.map((link) => {
            const entries = entriesOf(link, eventAthletes);
            const eventAthlete = eventAthletes.find(
              (a) => a.email.toLowerCase() === link.email.toLowerCase(),
            );
            const missingData = eventAthlete
              ? issues.filter(
                  (i) =>
                    (i.kind === "missing_requirement" || i.kind === "missing_document") &&
                    i.athleteId === eventAthlete.id,
                ).length
              : 0;
            return (
              <div
                key={link.id}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-border/60 bg-card p-3"
              >
                <span
                  style={{ backgroundColor: getAvatarColor(link.id) }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                >
                  {`${link.firstName[0] ?? ""}${link.lastName[0] ?? ""}`.toUpperCase() || "?"}
                </span>
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{`${link.firstName} ${link.lastName}`.trim()}</span>
                      {/* Dados e documentos obrigatórios (só de quem compete). */}
                      {eventAthlete && entries.length > 0 && (
                        <span
                          title={
                            missingData > 0
                              ? `${missingData} ${missingData === 1 ? "item pendente" : "itens pendentes"}`
                              : undefined
                          }
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            missingData > 0
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {missingData > 0 ? "Dados incompletos" : "Dados completos"}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{link.email}</p>
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {eventAthlete?.athleteSubmittedAt
                        ? "Enviou a inscrição e está sem categoria"
                        : "Não participa deste evento"}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map((e) => {
                        const team = teams.find((t) => t.id === e.teamId);
                        const category = team?.categories.find((c) => c.id === e.categoryId);
                        if (!team || !category) return null;
                        return (
                          <span
                            key={`${e.teamId}:${e.categoryId}`}
                            className="max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                          >
                            {category.name} · {team.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {editable && (
                      <button
                        type="button"
                        onClick={() => onEditEntries(link)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Escolher categorias
                      </button>
                    )}
                    {/* Também pra quem enviou a inscrição sem categoria: ver o
                        que ele mandou. */}
                    {eventAthlete && (entries.length > 0 || !!eventAthlete.athleteSubmittedAt) && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenData({
                            athleteId: eventAthlete.id,
                            name: `${link.firstName} ${link.lastName}`.trim(),
                          })
                        }
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        Dados e documentos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Equipe+categoria de um atleta do elenco no evento (casamento por email).
function entriesOf(link: AthleteLinkView, eventAthletes: ProgramAthlete[]) {
  const email = link.email.toLowerCase();
  return eventAthletes.find((a) => a.email.toLowerCase() === email)?.entries ?? [];
}

function LocationDialog({
  open,
  view,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  view: ProgramRegistrationView;
  onOpenChange: (open: boolean) => void;
  onSaved: (view: ProgramRegistrationView) => Promise<void>;
}) {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCity(view.profile.city ?? "");
    setState(view.profile.state ?? "");
    setError(null);
  }, [open, view.profile.city, view.profile.state]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSaved(
        await registrationApi.register(view.event.id, { city: city.trim(), state: state.toUpperCase() }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-md">
        <div className="grid gap-1">
          <DialogTitle>Onde fica o seu programa?</DialogTitle>
          <DialogDescription>
            Precisamos da cidade e da UF para inscrever o programa no evento.
          </DialogDescription>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
            <Input
              autoFocus
              aria-label="Cidade"
              placeholder="Cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              required
            />
            <Input
              aria-label="UF"
              placeholder="UF"
              value={state}
              onChange={(e) => setState(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
              minLength={2}
              maxLength={2}
              required
            />
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <div className="grid gap-1">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function SaveRow({
  saving,
  onCancel,
  onSave,
  extra,
  saveLabel = "Salvar",
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  extra?: ReactNode;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">{extra}</div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Salvando..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}

// Salvar de popup: fecha no sucesso, mostra o erro da API se falhar.
function useSaver(onOpenChange: (open: boolean) => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(action: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await action();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, setError, save };
}

function TeamCategoriesDialog({
  team,
  categories,
  onOpenChange,
  onRename,
  onDelete,
  onSave,
}: {
  team: Team | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onRename: (team: Team) => void;
  onDelete: (team: Team) => void;
  onSave: (team: Team, categoryIds: string[]) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { saving, error, setError, save } = useSaver(onOpenChange);

  useEffect(() => {
    if (!team) return;
    setSelected(new Set(team.categories.map((c) => c.id)));
    setError(null);
  }, [team, setError]);

  return (
    <DialogShell
      open={team !== null}
      onOpenChange={onOpenChange}
      title={team?.name ?? ""}
      description="Marque as categorias em que esta equipe vai competir."
    >
      <AthleteChecklist
        items={categories.map((c) => ({ id: c.id, label: c.name }))}
        selected={selected}
        onChange={setSelected}
        searchPlaceholder="Buscar categoria..."
        emptyMessage="O organizador ainda não cadastrou categorias."
        countNoun={{ singular: "categoria selecionada", plural: "categorias selecionadas" }}
      />
      <FormError message={error} />
      {team && (
        <SaveRow
          saving={saving}
          onCancel={() => onOpenChange(false)}
          onSave={() => void save(() => onSave(team, [...selected]))}
          extra={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRename(team)}>
                Renomear
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(team)}
              >
                Excluir equipe
              </Button>
            </>
          }
        />
      )}
    </DialogShell>
  );
}

function PairAthletesDialog({
  target,
  roster,
  birthDates,
  onSetBirthDate,
  eventAthletes,
  onOpenChange,
  onNewAthlete,
  onSave,
  onRemoveFromCategory,
  createdLink,
  readOnly = false,
}: {
  target: PairTarget | null;
  roster: AthleteLinkView[];
  // Data de nascimento por vínculo do elenco (separa os elegíveis).
  birthDates: Record<string, string | null>;
  onSetBirthDate: (linkId: string, birthDate: string) => Promise<void>;
  eventAthletes: ProgramAthlete[];
  // Ficha travada: só mostra quem está inscrito nesta equipe+categoria.
  readOnly?: boolean;
  onOpenChange: (open: boolean) => void;
  onNewAthlete: () => void;
  // Atleta recém-criado pelo "Novo atleta" deste popup: já entra marcado.
  createdLink: AthleteLinkView | null;
  onSave: (target: PairTarget, linkIds: string[]) => Promise<unknown>;
  onRemoveFromCategory: (target: PairTarget) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { saving, error, setError, save } = useSaver(onOpenChange);

  useEffect(() => {
    if (!target) return;
    const inPair = new Set(
      eventAthletes
        .filter((a) =>
          a.entries.some((e) => e.teamId === target.team.id && e.categoryId === target.category.id),
        )
        .map((a) => a.email.toLowerCase()),
    );
    setSelected(new Set(roster.filter((l) => inPair.has(l.email.toLowerCase())).map((l) => l.id)));
    setError(null);
    // `roster`/`eventAthletes` de fora de propósito: atleta criado com o
    // popup aberto não pode zerar a seleção em andamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, setError]);

  useEffect(() => {
    if (createdLink) setSelected((prev) => new Set(prev).add(createdLink.id));
  }, [createdLink]);

  if (readOnly) {
    const inPair = target
      ? eventAthletes
          .filter((a) =>
            a.entries.some(
              (e) => e.teamId === target.team.id && e.categoryId === target.category.id,
            ),
          )
          .sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "pt-BR"),
          )
      : [];
    return (
      <DialogShell
        open={target !== null}
        onOpenChange={onOpenChange}
        title={target ? `${target.team.name} em ${target.category.name}` : ""}
        description={pluralize(inPair.length, "atleta inscrito", "atletas inscritos")}
      >
        {inPair.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum atleta inscrito.</p>
        ) : (
          <ul className="grid gap-1">
            {inPair.map((a) => (
              <li key={a.id} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-1.5">
                <span
                  style={{ backgroundColor: getAvatarColor(a.id) }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                >
                  {athleteInitials(a)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{athleteName(a)}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="justify-self-end" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      open={target !== null}
      onOpenChange={onOpenChange}
      title={target ? `${target.team.name} em ${target.category.name}` : ""}
      description="Escolha os atletas que participarão desta categoria."
    >
      {target && rulesItems(target.category).length > 0 && (
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Regras da categoria</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {rulesItems(target.category).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Atletas do seu elenco</p>
        <button
          type="button"
          onClick={onNewAthlete}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <Plus className="size-3.5" />
          Novo atleta
        </button>
      </div>
      <AthleteChecklist
        items={[...roster]
          .sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "pt-BR"),
          )
          .map((l) => {
            const item = {
              id: l.id,
              label: `${l.firstName} ${l.lastName}`.trim(),
              hint: l.email,
            };
            if (!target?.category.rules || !hasAgeRule(target.category.rules)) return item;
            const rules = target.category.rules;
            const birthDate = birthDates[l.id] ?? null;
            const problem = ageProblem(rules, birthDate);
            const age =
              birthDate && rules.ageCutoffDate ? ageAt(birthDate, rules.ageCutoffDate) : null;
            return {
              ...item,
              hint: age != null ? `${age} anos · ${l.email}` : l.email,
              group: !birthDate
                ? ELIGIBILITY.unknown
                : problem
                  ? ELIGIBILITY.outside
                  : ELIGIBILITY.eligible,
              // Fora da regra de idade: pode marcar, vira pendência do envio.
              warning: problem ?? undefined,
              extra: !birthDate ? (
                <BirthDateFix compact onSave={(date) => onSetBirthDate(l.id, date)} />
              ) : undefined,
            };
          })}
        groupOrder={
          target?.category.rules && hasAgeRule(target.category.rules)
            ? [ELIGIBILITY.eligible, ELIGIBILITY.unknown, ELIGIBILITY.outside]
            : undefined
        }
        selected={selected}
        onChange={setSelected}
        searchPlaceholder="Buscar atleta..."
        emptyMessage="Seu elenco ainda não tem atletas. Use Novo atleta."
        countNoun={{ singular: "atleta selecionado", plural: "atletas selecionados" }}
      />
      <FormError message={error} />
      {target && (
        <SaveRow
          saving={saving}
          onCancel={() => onOpenChange(false)}
          onSave={() => void save(() => onSave(target, [...selected]))}
          extra={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => void save(() => onRemoveFromCategory(target))}
            >
              Tirar da categoria
            </Button>
          }
        />
      )}
    </DialogShell>
  );
}

function AthleteEntriesPicker({
  athlete,
  teams,
  categories,
  birthDate,
  onSetBirthDate,
  eventAthletes,
  onOpenChange,
  onSave,
}: {
  athlete: AthleteLinkView | null;
  teams: Team[];
  // Categorias do evento com a regra (as das equipes não trazem).
  categories: Category[];
  birthDate: string | null;
  onSetBirthDate: (linkId: string, birthDate: string) => Promise<void>;
  eventAthletes: ProgramAthlete[];
  onOpenChange: (open: boolean) => void;
  onSave: (link: AthleteLinkView, entries: { teamId: string; categoryId: string }[]) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { saving, error, setError, save } = useSaver(onOpenChange);
  const rulesById = new Map(categories.map((c) => [c.id, c.rules]));
  const items = teams.flatMap((team) =>
    team.categories.map((category) => {
      const rules = rulesById.get(category.id);
      const problem = rules ? ageProblem(rules, birthDate) : null;
      return {
        id: `${team.id}:${category.id}`,
        label: category.name,
        hint: `Equipe ${team.name}`,
        // Fora da regra de idade: pode marcar, vira pendência do envio.
        warning: problem ?? undefined,
      };
    }),
  );
  const needsBirthDate =
    !birthDate && items.some((i) => i.warning?.startsWith("Data de nascimento"));

  useEffect(() => {
    if (!athlete) return;
    setSelected(
      new Set(entriesOf(athlete, eventAthletes).map((e) => `${e.teamId}:${e.categoryId}`)),
    );
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete, setError]);

  return (
    <DialogShell
      open={athlete !== null}
      onOpenChange={onOpenChange}
      title={athlete ? `${athlete.firstName} ${athlete.lastName}`.trim() : ""}
      description="Em quais categorias este atleta compete neste evento? Sem nenhuma, ele não participa."
    >
      {needsBirthDate && athlete && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Algumas categorias exigem a data de nascimento deste atleta.
          <BirthDateFix onSave={(date) => onSetBirthDate(athlete.id, date)} />
        </div>
      )}
      <AthleteChecklist
        items={items}
        selected={selected}
        onChange={setSelected}
        searchPlaceholder="Buscar categoria ou equipe..."
        emptyMessage="Coloque suas equipes nas categorias primeiro."
        countNoun={{ singular: "categoria selecionada", plural: "categorias selecionadas" }}
      />
      <FormError message={error} />
      {athlete && (
        <SaveRow
          saving={saving}
          onCancel={() => onOpenChange(false)}
          onSave={() =>
            void save(() =>
              onSave(
                athlete,
                [...selected].map((key) => {
                  const [teamId, categoryId] = key.split(":");
                  return { teamId, categoryId };
                }),
              ),
            )
          }
        />
      )}
    </DialogShell>
  );
}
