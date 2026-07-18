import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CheckCircle2, Info, Users } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SpecialRolesCard } from "@/components/SpecialRolesCard";
import { JudgingCriterionTree } from "@/components/JudgingCriterionTree";
import { JudgeLibraryPanel } from "@/components/JudgeLibraryPanel";
import { CreateJudgeDialog } from "@/components/CreateJudgeDialog";
import { JudgeAssignmentSheet, type JudgeAssignmentTarget } from "@/components/JudgeAssignmentSheet";
import {
  AssignConflictDialog,
  type AssignConflictState,
} from "@/components/AssignConflictDialog";
import { assignmentKey, getDescendantLeafIds, parseAssignmentKey } from "@/lib/judgingAssignments";
import { SPECIAL_JUDGE_ROLES } from "@/lib/specialJudgeRoles";
import { fetchTemplateJudgingStats, isTemplateJudgingComplete } from "@/lib/templateJudgingProgress";
import {
  categoriesApi,
  judgesApi,
  judgingApi,
  scoringCriteriaApi,
  usersApi,
  type Category,
  type CriterionAssignmentsState,
  type Judge,
  type ScoringCriterion,
  type SpecialJudgeRole,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function JudgingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [assignments, setAssignments] = useState<CriterionAssignmentsState | null>(null);
  const [specialRoles, setSpecialRoles] = useState<
    Array<{ role: SpecialJudgeRole; resourceId: string; judgeIds: string[] }>
  >([]);
  const [templateStats, setTemplateStats] = useState<
    Map<string, { total: number; assigned: number }>
  >(new Map());
  const [error, setError] = useState<string | null>(null);

  const [openCriterionId, setOpenCriterionId] = useState<string | null>(null);
  const [openResourceId, setOpenResourceId] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<SpecialJudgeRole | null>(null);
  const [conflictState, setConflictState] = useState<AssignConflictState | null>(null);
  const [pendingBulkDrop, setPendingBulkDrop] = useState<{
    groupCriterionId: string;
    resourceId: string;
    judgeParticipationId: string;
  } | null>(null);
  const [createJudgeOpen, setCreateJudgeOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    categoriesApi.list(id).then(setCategories).catch(() => setCategories([]));
    judgesApi.list(id).then(setJudges).catch(() => setJudges([]));
  }, [id]);

  // Candidatos "crus" — qualquer template referenciado por alguma
  // categoria do evento, sem checar se essa categoria já tem
  // apresentação agendada. `templateOptions` (abaixo) filtra por cima
  // disso.
  const candidateTemplateOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      if (category.scoringTemplate) {
        map.set(category.scoringTemplate.id, category.scoringTemplate.name);
      }
    }
    return Array.from(map.entries()).map(([templateId, name]) => ({ templateId, name }));
  }, [categories]);

  const [templateStatsLoaded, setTemplateStatsLoaded] = useState(false);

  // Progresso de todos os sistemas de pontuação do evento (não só o
  // selecionado) — pra mostrar "X de N sistemas completos" junto do
  // seletor. Busca em segundo plano; o template selecionado no momento
  // é mantido sincronizado com o estado ao vivo logo abaixo, sem
  // precisar buscar de novo a cada atribuição.
  useEffect(() => {
    if (!id || candidateTemplateOptions.length === 0) {
      setTemplateStatsLoaded(true);
      return;
    }
    let cancelled = false;
    setTemplateStatsLoaded(false);
    fetchTemplateJudgingStats(id, candidateTemplateOptions.map((o) => o.templateId)).then((stats) => {
      if (cancelled) return;
      setTemplateStats(stats);
      setTemplateStatsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, candidateTemplateOptions]);

  // Um template sem nenhuma apresentação agendada (`total === 0`, ver
  // fetchTemplateJudgingStats) não tem em qual dia/recurso escalar
  // jurado ainda — nem deveria aparecer como opção pra escolher, muito
  // menos contar como "pendente" na barra de progresso (ver também
  // EventSetupPage, mesmo filtro pro checklist de setup do evento).
  const templateOptions = useMemo(() => {
    if (!templateStatsLoaded) return [];
    return candidateTemplateOptions.filter(
      (option) => (templateStats.get(option.templateId)?.total ?? 0) > 0,
    );
  }, [candidateTemplateOptions, templateStats, templateStatsLoaded]);

  useEffect(() => {
    if (!templateStatsLoaded) return;
    setSelectedTemplateId((current) => {
      if (current && templateOptions.some((o) => o.templateId === current)) return current;
      return templateOptions[0]?.templateId ?? null;
    });
  }, [templateOptions, templateStatsLoaded]);

  function refetchAssignments() {
    if (!id || !selectedTemplateId) return;
    judgingApi
      .getAssignments(id, selectedTemplateId)
      .then(setAssignments)
      .catch(() => setError("Não foi possível carregar as atribuições."));
  }

  useEffect(() => {
    if (!id || !selectedTemplateId) {
      setCriteria([]);
      setAssignments(null);
      return;
    }
    scoringCriteriaApi.list(selectedTemplateId).then(setCriteria).catch(() => setCriteria([]));
    refetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedTemplateId]);

  // A aba de dia selecionada precisa acompanhar o template — cada
  // template tem seu próprio conjunto de dias com apresentação
  // agendada (ver JudgingService.getRelevantDays no backend). Se o dia
  // selecionado não existe mais nesse conjunto (trocou de template, ou
  // o cronograma mudou), volta pro primeiro disponível.
  useEffect(() => {
    if (!assignments) return;
    setSelectedDayId((current) => {
      if (current && assignments.days.some((d) => d.id === current)) return current;
      return assignments.days[0]?.id ?? null;
    });
  }, [assignments]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleRemoveJudge(judgeId: string) {
    if (!id) return;
    await judgesApi.remove(id, judgeId);
    setJudges((prev) => prev.filter((j) => j.id !== judgeId));
  }

  const judgesById = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges]);

  const selectedDay = useMemo(
    () => assignments?.days.find((d) => d.id === selectedDayId) ?? null,
    [assignments, selectedDayId],
  );
  const dayResources = useMemo(() => selectedDay?.resources ?? [], [selectedDay]);

  function refetchSpecialRoles() {
    if (!id || dayResources.length === 0) {
      setSpecialRoles([]);
      return;
    }
    Promise.all(
      dayResources.map((resource) =>
        judgingApi
          .getSpecialRoles(id, resource.id)
          .then((roles) => roles.map((r) => ({ ...r, resourceId: resource.id })))
          .catch(() => []),
      ),
    ).then((perResource) => setSpecialRoles(perResource.flat()));
  }

  // Funções especiais são por RECURSO (mesma pista/palco da árvore de
  // critérios, ver SpecialRoleAssignment) — refaz o fetch sempre que o
  // dia selecionado mudar (o que muda quais recursos existem).
  useEffect(() => {
    refetchSpecialRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dayResources]);

  const judgeIdsByCriterion = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of assignments?.criterionAssignments ?? []) {
      map.set(assignmentKey(row.criterionId, row.resourceId), row.judgeIds);
    }
    return map;
  }, [assignments]);

  const judgeIdsByRoleResource = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of specialRoles) {
      map.set(assignmentKey(row.role, row.resourceId), row.judgeIds);
    }
    return map;
  }, [specialRoles]);

  const itemsCountByJudge = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of assignments?.criterionAssignments ?? []) {
      for (const judgeId of row.judgeIds) {
        map.set(judgeId, (map.get(judgeId) ?? 0) + 1);
      }
    }
    return map;
  }, [assignments]);

  const leafCriteria = useMemo(() => criteria.filter((c) => c.type === "score_item"), [criteria]);
  // "Slot" = combinação folha × recurso — um jurado não cobre duas
  // pistas ao mesmo tempo, então cada recurso do dia precisa da
  // própria atribuição (ver assignmentKey). Os cards de estatística
  // (abaixo) são do DIA selecionado; o total do TEMPLATE (usado na
  // barra "sistemas de pontuação completos" e na etapa de setup do
  // evento) soma todos os dias — um sistema só está completo quando
  // TODOS os dias em que ele é usado estão com a escala fechada.
  const totalSlots = leafCriteria.length * dayResources.length;
  const assignedSlots = leafCriteria.reduce(
    (sum, leaf) =>
      sum +
      dayResources.filter(
        (resource) => (judgeIdsByCriterion.get(assignmentKey(leaf.id, resource.id))?.length ?? 0) > 0,
      ).length,
    0,
  );
  const pendingSlotCount = totalSlots - assignedSlots;
  const progressPct = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0;

  const allDaysResourceCount = useMemo(
    () => (assignments?.days ?? []).reduce((sum, day) => sum + day.resources.length, 0),
    [assignments],
  );
  const allDaysTotalSlots = leafCriteria.length * allDaysResourceCount;
  const allDaysAssignedSlots = useMemo(() => {
    let count = 0;
    for (const leaf of leafCriteria) {
      for (const day of assignments?.days ?? []) {
        for (const resource of day.resources) {
          if ((judgeIdsByCriterion.get(assignmentKey(leaf.id, resource.id))?.length ?? 0) > 0) {
            count++;
          }
        }
      }
    }
    return count;
  }, [leafCriteria, assignments, judgeIdsByCriterion]);

  // Mantém o progresso do template selecionado sincronizado com o
  // estado ao vivo (otimista) da tela, sem esperar o próximo fetch em
  // segundo plano de todos os templates.
  useEffect(() => {
    if (!selectedTemplateId) return;
    setTemplateStats((prev) => {
      const next = new Map(prev);
      next.set(selectedTemplateId, { total: allDaysTotalSlots, assigned: allDaysAssignedSlots });
      return next;
    });
  }, [selectedTemplateId, allDaysTotalSlots, allDaysAssignedSlots]);

  const completedTemplatesCount = templateOptions.filter((option) =>
    isTemplateJudgingComplete(templateStats.get(option.templateId)),
  ).length;
  const templatesProgressPct =
    templateOptions.length > 0
      ? Math.round((completedTemplatesCount / templateOptions.length) * 100)
      : 0;

  function patchCriterionAssignments(criterionId: string, resourceId: string, judgeIds: string[]) {
    setAssignments((prev) => {
      if (!prev) return prev;
      const filtered = prev.criterionAssignments.filter(
        (a) => !(a.criterionId === criterionId && a.resourceId === resourceId),
      );
      return {
        ...prev,
        criterionAssignments:
          judgeIds.length > 0 ? [...filtered, { criterionId, resourceId, judgeIds }] : filtered,
      };
    });
  }

  function patchRoleAssignments(role: SpecialJudgeRole, resourceId: string, judgeIds: string[]) {
    setSpecialRoles((prev) =>
      prev.map((r) => (r.role === role && r.resourceId === resourceId ? { ...r, judgeIds } : r)),
    );
  }

  function assignJudgeToLeaf(criterionId: string, resourceId: string, judgeId: string) {
    if (!id || !selectedTemplateId) return;
    const current = judgeIdsByCriterion.get(assignmentKey(criterionId, resourceId)) ?? [];
    if (current.includes(judgeId)) return;
    const next = [...current, judgeId];
    patchCriterionAssignments(criterionId, resourceId, next);
    judgingApi
      .setCriterionJudges(id, selectedTemplateId, criterionId, resourceId, next)
      .catch(() => {
        setError("Não foi possível salvar a atribuição. Tente novamente.");
        refetchAssignments();
      });
  }

  function applyBulkAssign(
    groupCriterionId: string,
    resourceId: string,
    judgeParticipationId: string,
    strategy: "unassigned_only" | "replace" | "add",
  ) {
    if (!id || !selectedTemplateId) return;
    judgingApi
      .bulkAssign(id, selectedTemplateId, groupCriterionId, resourceId, judgeParticipationId, strategy)
      .then(refetchAssignments)
      .catch(() => setError("Não foi possível aplicar a atribuição em massa. Tente novamente."));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const judgeId = String(active.id);
    const parsed = parseAssignmentKey(String(over.id));
    if (!parsed) return;
    const { criterionId, resourceId } = parsed;
    const criterion = criteria.find((c) => c.id === criterionId);
    if (!criterion) return;

    if (criterion.type === "score_item") {
      assignJudgeToLeaf(criterionId, resourceId, judgeId);
      return;
    }

    const leafIds = getDescendantLeafIds(criteria, criterionId);
    if (leafIds.length === 0) return;
    const hasExisting = leafIds.some(
      (leafId) => (judgeIdsByCriterion.get(assignmentKey(leafId, resourceId))?.length ?? 0) > 0,
    );

    if (!hasExisting) {
      applyBulkAssign(criterionId, resourceId, judgeId, "add");
      return;
    }

    setPendingBulkDrop({ groupCriterionId: criterionId, resourceId, judgeParticipationId: judgeId });
    setConflictState({
      judgeName: judgesById.get(judgeId)?.name ?? "Jurado",
      groupName: criterion.name,
      leafCount: leafIds.length,
    });
  }

  function handleConfirmConflict(strategy: "unassigned_only" | "replace" | "add") {
    if (!pendingBulkDrop) return;
    applyBulkAssign(
      pendingBulkDrop.groupCriterionId,
      pendingBulkDrop.resourceId,
      pendingBulkDrop.judgeParticipationId,
      strategy,
    );
    setPendingBulkDrop(null);
  }

  function handleToggleJudge(judgeId: string, checked: boolean) {
    if (openCriterionId && openResourceId) {
      const current = judgeIdsByCriterion.get(assignmentKey(openCriterionId, openResourceId)) ?? [];
      const next = checked ? [...current, judgeId] : current.filter((jid) => jid !== judgeId);
      patchCriterionAssignments(openCriterionId, openResourceId, next);
      if (id && selectedTemplateId) {
        judgingApi
          .setCriterionJudges(id, selectedTemplateId, openCriterionId, openResourceId, next)
          .catch(() => refetchAssignments());
      }
    } else if (openRole && openResourceId) {
      const current = judgeIdsByRoleResource.get(assignmentKey(openRole, openResourceId)) ?? [];
      const next = checked ? [...current, judgeId] : current.filter((jid) => jid !== judgeId);
      patchRoleAssignments(openRole, openResourceId, next);
      if (id) {
        judgingApi
          .setSpecialRoleJudges(id, openRole, openResourceId, next)
          .catch(() => refetchSpecialRoles());
      }
    }
  }

  const sheetTarget: JudgeAssignmentTarget | null = useMemo(() => {
    if (openCriterionId && openResourceId) {
      const criterion = criteria.find((c) => c.id === openCriterionId);
      const resource = dayResources.find((r) => r.id === openResourceId);
      if (!criterion || !resource) return null;
      return {
        title: `${criterion.name} · ${resource.name}`,
        description: "Selecione os jurados responsáveis por este item de avaliação nesta pista.",
        assignedJudgeIds: judgeIdsByCriterion.get(assignmentKey(openCriterionId, openResourceId)) ?? [],
      };
    }
    if (openRole && openResourceId) {
      const def = SPECIAL_JUDGE_ROLES.find((r) => r.role === openRole);
      const resource = dayResources.find((r) => r.id === openResourceId);
      if (!resource) return null;
      return {
        title: `${def?.label ?? ""} · ${resource.name}`,
        description: def?.description ?? "",
        assignedJudgeIds: judgeIdsByRoleResource.get(assignmentKey(openRole, openResourceId)) ?? [],
      };
    }
    return null;
  }, [
    openCriterionId,
    openResourceId,
    openRole,
    criteria,
    dayResources,
    judgeIdsByCriterion,
    judgeIdsByRoleResource,
  ]);

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-10 pt-6">
            <button
              type="button"
              onClick={() => navigate(`/events/${id}/setup`)}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar para configuração do evento
            </button>
            <NotificationBell />
          </div>

          <div className="flex flex-1 flex-col px-10 pb-10">
            {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

            <div className="mt-6 flex flex-1 flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">Painel de jurados</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Monte o painel de jurados do evento e defina o papel de cada árbitro.
                    </p>
                  </div>
                </div>

                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Salvo automaticamente
                </span>
              </div>

              {templateOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  Nenhuma categoria deste evento tem um sistema de pontuação atribuído ainda.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4">
                    <div className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:gap-4">
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        Sistemas de pontuação completos
                      </span>
                      <Progress value={templatesProgressPct} className="flex-1" />
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {completedTemplatesCount}/{templateOptions.length}
                      </span>
                    </div>

                    <div className="sm:max-w-sm">
                      <p className="text-sm text-muted-foreground">Sistema de pontuação</p>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="mt-2 w-full">
                          <SelectValue placeholder="Selecione um sistema de pontuação">
                            {(value: string) =>
                              templateOptions.find((option) => option.templateId === value)?.name
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {templateOptions.map((option) => (
                            <SelectItem key={option.templateId} value={option.templateId}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tudo aqui dentro é escopado pelo dia selecionado logo abaixo
                      (jurados, funções especiais e cobertura da árvore mudam
                      de dia pra dia) — uma div só, pra deixar isso óbvio em vez
                      de parecer seções independentes uma da outra. */}
                  <div className="flex flex-1 flex-col gap-6 rounded-lg border border-border/60 bg-card p-4">
                    {assignments && assignments.days.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          Nenhuma apresentação agendada ainda para as categorias que usam este
                          sistema de pontuação.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => navigate(`/events/${id}/schedule`)}
                        >
                          Ir para Cronograma
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="shrink-0 text-sm font-medium text-foreground">Dia</span>
                            <div className="flex flex-wrap items-center gap-2">
                              {(assignments?.days ?? []).map((day) => (
                                <button
                                  key={day.id}
                                  type="button"
                                  onClick={() => setSelectedDayId(day.id)}
                                  className={cn(
                                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                                    day.id === selectedDayId
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  {format(parseISO(day.date), "dd/MM")}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 divide-y divide-border/60 border-t border-border/60 pt-4 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                            <div className="flex flex-col justify-center sm:pr-4">
                              <p className="text-sm text-muted-foreground">Critérios totais</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">
                                {leafCriteria.length}
                              </p>
                            </div>

                            <div className="flex flex-col justify-center sm:px-4">
                              <p className="text-sm text-muted-foreground">Atribuídos</p>
                              <p className="mt-1 text-2xl font-semibold text-emerald-600">
                                {assignedSlots}
                              </p>
                            </div>

                            <div className="flex flex-col justify-center sm:px-4">
                              <p className="text-sm text-muted-foreground">Pendentes</p>
                              <p className="mt-1 text-2xl font-semibold text-amber-600">
                                {pendingSlotCount}
                              </p>
                            </div>

                            <div className="flex flex-col justify-center sm:pl-4">
                              <p className="text-sm text-muted-foreground">Cobertura da escala</p>
                              <div className="mt-2.5 flex items-center gap-3">
                                <Progress value={progressPct} className="flex-1" />
                                <span className="shrink-0 text-sm font-semibold text-foreground">
                                  {progressPct}%
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {pendingSlotCount > 0
                                  ? `Faltam ${pendingSlotCount} ${pendingSlotCount === 1 ? "atribuição" : "atribuições"} para completar`
                                  : "Escala completa"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-border/60 pt-6">
                          <SpecialRolesCard
                            resources={dayResources}
                            judgeIdsByRoleResource={judgeIdsByRoleResource}
                            judgesById={judgesById}
                            selectedRole={openRole}
                            selectedResourceId={openResourceId}
                            onSelectCell={(role, resourceId) => {
                              setOpenCriterionId(null);
                              setOpenRole(role);
                              setOpenResourceId(resourceId);
                            }}
                          />
                        </div>

                        <div className="grid flex-1 grid-cols-1 gap-6 border-t border-border/60 pt-6 lg:grid-cols-[1fr_360px]">
                          <JudgingCriterionTree
                            criteria={criteria}
                            resources={dayResources}
                            judgeIdsByCriterion={judgeIdsByCriterion}
                            judgesById={judgesById}
                            selectedCriterionId={openCriterionId}
                            selectedResourceId={openResourceId}
                            onSelectCell={(criterionId, resourceId) => {
                              setOpenRole(null);
                              setOpenCriterionId(criterionId);
                              setOpenResourceId(resourceId);
                            }}
                          />

                          <JudgeLibraryPanel
                            judges={judges}
                            itemsCountByJudge={itemsCountByJudge}
                            totalCriteria={leafCriteria.length}
                            onCreateJudge={() => setCreateJudgeOpen(true)}
                            onRemoveJudge={handleRemoveJudge}
                          />
                        </div>

                        <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-4 text-sm text-muted-foreground">
                          <Info className="size-4 shrink-0 text-primary" />
                          Dica: arraste um jurado para a coluna de uma pista (nos critérios ou
                          grupos) para atribuir. Clique numa célula para editar os jurados
                          atribuídos ali.
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </DndContext>

      {id && (
        <CreateJudgeDialog
          eventId={id}
          open={createJudgeOpen}
          onOpenChange={setCreateJudgeOpen}
          onCreated={(judge) => setJudges((prev) => [judge, ...prev])}
        />
      )}

      <JudgeAssignmentSheet
        target={sheetTarget}
        judges={judges}
        onOpenChange={(open) => {
          if (!open) {
            setOpenCriterionId(null);
            setOpenResourceId(null);
            setOpenRole(null);
          }
        }}
        onToggleJudge={handleToggleJudge}
      />

      <AssignConflictDialog
        state={conflictState}
        onOpenChange={(open) => {
          if (!open) {
            setConflictState(null);
            setPendingBulkDrop(null);
          }
        }}
        onConfirm={handleConfirmConflict}
      />
    </div>
  );
}
