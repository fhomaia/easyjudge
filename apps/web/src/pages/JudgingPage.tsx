import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Info, Users } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SpecialRolesCard } from "@/components/SpecialRolesCard";
import { JudgingCriterionTree } from "@/components/JudgingCriterionTree";
import { JudgeLibraryPanel } from "@/components/JudgeLibraryPanel";
import { CreateJudgeDialog } from "@/components/CreateJudgeDialog";
import { JudgeAssignmentSheet, type JudgeAssignmentTarget } from "@/components/JudgeAssignmentSheet";
import {
  AssignConflictDialog,
  type AssignConflictState,
} from "@/components/AssignConflictDialog";
import { getDescendantLeafIds } from "@/lib/judgingAssignments";
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
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [assignments, setAssignments] = useState<CriterionAssignmentsState | null>(null);
  const [templateStats, setTemplateStats] = useState<
    Map<string, { total: number; assigned: number }>
  >(new Map());
  const [error, setError] = useState<string | null>(null);

  const [openCriterionId, setOpenCriterionId] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<SpecialJudgeRole | null>(null);
  const [conflictState, setConflictState] = useState<AssignConflictState | null>(null);
  const [pendingBulkDrop, setPendingBulkDrop] = useState<{
    groupCriterionId: string;
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

  const templateOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      if (category.scoringTemplate) {
        map.set(category.scoringTemplate.id, category.scoringTemplate.name);
      }
    }
    return Array.from(map.entries()).map(([templateId, name]) => ({ templateId, name }));
  }, [categories]);

  useEffect(() => {
    if (!selectedTemplateId && templateOptions.length > 0) {
      setSelectedTemplateId(templateOptions[0].templateId);
    }
  }, [templateOptions, selectedTemplateId]);

  // Progresso de todos os sistemas de pontuação do evento (não só o
  // selecionado) — pra mostrar "X de N sistemas completos" junto do
  // seletor. Busca em segundo plano; o template selecionado no momento
  // é mantido sincronizado com o estado ao vivo logo abaixo, sem
  // precisar buscar de novo a cada atribuição.
  useEffect(() => {
    if (!id || templateOptions.length === 0) return;
    let cancelled = false;
    fetchTemplateJudgingStats(id, templateOptions.map((o) => o.templateId)).then((stats) => {
      if (!cancelled) setTemplateStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [id, templateOptions]);

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

  const judgeIdsByCriterion = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of assignments?.criterionAssignments ?? []) {
      map.set(row.criterionId, row.judgeIds);
    }
    return map;
  }, [assignments]);

  const judgeIdsByRole = useMemo(() => {
    const map = new Map<SpecialJudgeRole, string[]>();
    for (const row of assignments?.specialRoles ?? []) {
      map.set(row.role, row.judgeIds);
    }
    return map;
  }, [assignments]);

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
  const assignedLeafCount = leafCriteria.filter(
    (c) => (judgeIdsByCriterion.get(c.id)?.length ?? 0) > 0,
  ).length;
  const pendingLeafCount = leafCriteria.length - assignedLeafCount;
  const progressPct =
    leafCriteria.length > 0 ? Math.round((assignedLeafCount / leafCriteria.length) * 100) : 0;

  // Mantém o progresso do template selecionado sincronizado com o
  // estado ao vivo (otimista) da tela, sem esperar o próximo fetch em
  // segundo plano de todos os templates.
  useEffect(() => {
    if (!selectedTemplateId) return;
    setTemplateStats((prev) => {
      const next = new Map(prev);
      next.set(selectedTemplateId, { total: leafCriteria.length, assigned: assignedLeafCount });
      return next;
    });
  }, [selectedTemplateId, leafCriteria.length, assignedLeafCount]);

  const completedTemplatesCount = templateOptions.filter((option) =>
    isTemplateJudgingComplete(templateStats.get(option.templateId)),
  ).length;
  const templatesProgressPct =
    templateOptions.length > 0
      ? Math.round((completedTemplatesCount / templateOptions.length) * 100)
      : 0;

  function patchCriterionAssignments(criterionId: string, judgeIds: string[]) {
    setAssignments((prev) => {
      if (!prev) return prev;
      const filtered = prev.criterionAssignments.filter((a) => a.criterionId !== criterionId);
      return {
        ...prev,
        criterionAssignments:
          judgeIds.length > 0 ? [...filtered, { criterionId, judgeIds }] : filtered,
      };
    });
  }

  function patchRoleAssignments(role: SpecialJudgeRole, judgeIds: string[]) {
    setAssignments((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        specialRoles: prev.specialRoles.map((r) => (r.role === role ? { ...r, judgeIds } : r)),
      };
    });
  }

  function assignJudgeToLeaf(criterionId: string, judgeId: string) {
    if (!id || !selectedTemplateId) return;
    const current = judgeIdsByCriterion.get(criterionId) ?? [];
    if (current.includes(judgeId)) return;
    const next = [...current, judgeId];
    patchCriterionAssignments(criterionId, next);
    judgingApi
      .setCriterionJudges(id, selectedTemplateId, criterionId, next)
      .catch(() => {
        setError("Não foi possível salvar a atribuição. Tente novamente.");
        refetchAssignments();
      });
  }

  function applyBulkAssign(
    groupCriterionId: string,
    judgeParticipationId: string,
    strategy: "unassigned_only" | "replace" | "add",
  ) {
    if (!id || !selectedTemplateId) return;
    judgingApi
      .bulkAssign(id, selectedTemplateId, groupCriterionId, judgeParticipationId, strategy)
      .then(refetchAssignments)
      .catch(() => setError("Não foi possível aplicar a atribuição em massa. Tente novamente."));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const judgeId = String(active.id);
    const criterionId = String(over.id);
    const criterion = criteria.find((c) => c.id === criterionId);
    if (!criterion) return;

    if (criterion.type === "score_item") {
      assignJudgeToLeaf(criterionId, judgeId);
      return;
    }

    const leafIds = getDescendantLeafIds(criteria, criterionId);
    if (leafIds.length === 0) return;
    const hasExisting = leafIds.some((leafId) => (judgeIdsByCriterion.get(leafId)?.length ?? 0) > 0);

    if (!hasExisting) {
      applyBulkAssign(criterionId, judgeId, "add");
      return;
    }

    setPendingBulkDrop({ groupCriterionId: criterionId, judgeParticipationId: judgeId });
    setConflictState({
      judgeName: judgesById.get(judgeId)?.name ?? "Jurado",
      groupName: criterion.name,
      leafCount: leafIds.length,
    });
  }

  function handleConfirmConflict(strategy: "unassigned_only" | "replace" | "add") {
    if (!pendingBulkDrop) return;
    applyBulkAssign(pendingBulkDrop.groupCriterionId, pendingBulkDrop.judgeParticipationId, strategy);
    setPendingBulkDrop(null);
  }

  function handleToggleJudge(judgeId: string, checked: boolean) {
    if (openCriterionId) {
      const current = judgeIdsByCriterion.get(openCriterionId) ?? [];
      const next = checked ? [...current, judgeId] : current.filter((jid) => jid !== judgeId);
      patchCriterionAssignments(openCriterionId, next);
      if (id && selectedTemplateId) {
        judgingApi
          .setCriterionJudges(id, selectedTemplateId, openCriterionId, next)
          .catch(() => refetchAssignments());
      }
    } else if (openRole) {
      const current = judgeIdsByRole.get(openRole) ?? [];
      const next = checked ? [...current, judgeId] : current.filter((jid) => jid !== judgeId);
      patchRoleAssignments(openRole, next);
      if (id) {
        judgingApi.setSpecialRoleJudges(id, openRole, next).catch(() => refetchAssignments());
      }
    }
  }

  const sheetTarget: JudgeAssignmentTarget | null = useMemo(() => {
    if (openCriterionId) {
      const criterion = criteria.find((c) => c.id === openCriterionId);
      if (!criterion) return null;
      return {
        title: criterion.name,
        description: "Selecione os jurados responsáveis por este item de avaliação.",
        assignedJudgeIds: judgeIdsByCriterion.get(openCriterionId) ?? [],
      };
    }
    if (openRole) {
      const def = SPECIAL_JUDGE_ROLES.find((r) => r.role === openRole);
      return {
        title: def?.label ?? "",
        description: def?.description ?? "",
        assignedJudgeIds: judgeIdsByRole.get(openRole) ?? [],
      };
    }
    return null;
  }, [openCriterionId, openRole, criteria, judgeIdsByCriterion, judgeIdsByRole]);

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
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-sm font-medium text-foreground">
                      Sistemas de pontuação completos
                    </span>
                    <Progress value={templatesProgressPct} className="flex-1" />
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {completedTemplatesCount}/{templateOptions.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 divide-y divide-border/60 rounded-lg border border-border/60 bg-card sm:grid-cols-[1.2fr_auto_auto_auto_1.4fr] sm:divide-x sm:divide-y-0">
                    <div className="flex flex-col justify-center p-5">
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

                    <div className="flex flex-col justify-center p-5">
                      <p className="text-sm text-muted-foreground">Critérios totais</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">
                        {leafCriteria.length}
                      </p>
                    </div>

                    <div className="flex flex-col justify-center p-5">
                      <p className="text-sm text-muted-foreground">Atribuídos</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-600">
                        {assignedLeafCount}
                      </p>
                    </div>

                    <div className="flex flex-col justify-center p-5">
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                      <p className="mt-1 text-2xl font-semibold text-amber-600">
                        {pendingLeafCount}
                      </p>
                    </div>

                    <div className="flex flex-col justify-center p-5">
                      <p className="text-sm text-muted-foreground">Cobertura da escala</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Progress value={progressPct} className="flex-1" />
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {progressPct}%
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {pendingLeafCount > 0
                          ? `Faltam ${pendingLeafCount} ${pendingLeafCount === 1 ? "critério" : "critérios"} para completar`
                          : "Escala completa"}
                      </p>
                    </div>
                  </div>

                  <SpecialRolesCard
                    judgeIdsByRole={judgeIdsByRole}
                    judgesById={judgesById}
                    onEditRole={setOpenRole}
                  />

                  <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
                    <JudgingCriterionTree
                      criteria={criteria}
                      judgeIdsByCriterion={judgeIdsByCriterion}
                      judgesById={judgesById}
                      selectedCriterionId={openCriterionId}
                      onSelectLeaf={setOpenCriterionId}
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
                    Dica: arraste um jurado para os critérios ou grupos para atribuir. Clique em um
                    item para editar os jurados atribuídos.
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
