import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Lock, Pencil } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { ScoringStatCards } from "@/components/ScoringStatCards";
import { ScoringTreePanel } from "@/components/ScoringTreePanel";
import { EditCriterionPanel } from "@/components/EditCriterionPanel";
import { ScoringValidationBar } from "@/components/ScoringValidationBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportScoringTemplateToExcel, exportScoringTemplateToPdf } from "@/lib/scoringTemplateExport";
import { hasStaleScoreBands } from "@/lib/scoreBands";
import {
  ApiError,
  scoringCriteriaApi,
  scoringTemplatesApi,
  usersApi,
  type ScoringCriterion,
  type ScoringTemplate,
  type UserProfile,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";

const NAME_DEBOUNCE_MS = 600;

export function ScoringTemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [template, setTemplate] = useState<ScoringTemplate | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriterion[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScoringCriterion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    scoringTemplatesApi
      .get(id)
      .then((t) => {
        setTemplate(t);
        setNameDraft(t.name);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar o template."),
      );
    scoringCriteriaApi
      .list(id)
      .then(setCriteria)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar os critérios."),
      );
  }, [id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function persistName(name: string) {
    if (!id) return;
    scoringTemplatesApi.update(id, { name }).then(setTemplate);
  }

  function handleNameChange(value: string) {
    setNameDraft(value);
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => persistName(value), NAME_DEBOUNCE_MS);
  }

  async function handleAddRoot() {
    if (!id) return;
    const criterion = await scoringCriteriaApi.create(id, {
      type: "group",
      name: "Novo critério",
      maxScore: 0,
    });
    setCriteria((prev) => [...(prev ?? []), criterion]);
    setSelectedId(criterion.id);
  }

  async function handleAddChild(parentId: string) {
    if (!id) return;
    const criterion = await scoringCriteriaApi.create(id, {
      type: "group",
      name: "Novo critério",
      maxScore: 0,
      parentId,
    });
    setCriteria((prev) => {
      if (!prev) return prev;
      // O pai pode ter sido promovido de "Item de avaliação" pra "Grupo"
      // no servidor — atualiza localmente também.
      const updated = prev.map((c) =>
        c.id === parentId && c.type === "score_item" ? { ...c, type: "group" as const } : c,
      );
      return [...updated, criterion];
    });
    setSelectedId(criterion.id);
  }

  function handleCriterionUpdated(updated: ScoringCriterion) {
    setCriteria((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? prev);
  }

  function handleCriterionDeleted(deletedId: string) {
    setCriteria((prev) => {
      if (!prev) return prev;
      // Remove o nó e todos os seus descendentes (a cascata já aconteceu
      // no servidor — aqui só reflete isso no estado local).
      const toRemove = new Set([deletedId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of prev) {
          if (c.parentId && toRemove.has(c.parentId) && !toRemove.has(c.id)) {
            toRemove.add(c.id);
            changed = true;
          }
        }
      }
      return prev.filter((c) => !toRemove.has(c.id));
    });
    setSelectedId((current) => (current === deletedId ? null : current));
  }

  async function handleMove(criterionId: string, newParentId: string | null, newIndex: number) {
    if (!id || !criteria) return;
    const previous = criteria;
    // Atualização otimista: reposiciona localmente na hora; a resposta
    // do servidor (lista completa e autoritativa) chega logo em seguida
    // e reconcilia qualquer diferença de order entre os irmãos.
    setCriteria((prev) =>
      prev?.map((c) =>
        c.id === criterionId ? { ...c, parentId: newParentId, order: newIndex } : c,
      ) ?? prev,
    );
    try {
      const updated = await scoringCriteriaApi.move(id, criterionId, { newParentId, newIndex });
      setCriteria(updated);
    } catch (err) {
      setCriteria(previous);
      setError(err instanceof ApiError ? err.message : "Não foi possível mover o critério.");
    }
  }

  function countDescendants(criterionId: string): number {
    if (!criteria) return 0;
    const toCount = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of criteria) {
        if (
          c.parentId &&
          (c.parentId === criterionId || toCount.has(c.parentId)) &&
          !toCount.has(c.id)
        ) {
          toCount.add(c.id);
          changed = true;
        }
      }
    }
    return toCount.size;
  }

  async function handleConfirmDelete() {
    if (!id || !deleteTarget) return;
    await scoringCriteriaApi.remove(id, deleteTarget.id);
    handleCriterionDeleted(deleteTarget.id);
  }

  const selectedCriterion = criteria?.find((c) => c.id === selectedId) ?? null;
  const selectedHasChildren = selectedCriterion
    ? (criteria?.some((c) => c.parentId === selectedCriterion.id) ?? false)
    : false;
  const deleteDescendantCount = deleteTarget ? countDescendants(deleteTarget.id) : 0;
  const isLocked = template?.isLocked ?? false;
  const staleScoreBands = criteria ? hasStaleScoreBands(criteria) : false;

  return (
    <div className="flex h-svh bg-background">
      <AppSidebar profile={profile} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-10 pt-6">
          <button
            type="button"
            onClick={() => navigate("/scoring-templates")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para templates
          </button>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Salvo automaticamente
            </span>
            {template && criteria !== null && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
                  <Download className="size-4" />
                  Baixar súmula
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => exportScoringTemplateToPdf(template, criteria)}
                  >
                    <FileText data-icon="inline-start" />
                    Baixar como PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportScoringTemplateToExcel(template, criteria)}
                  >
                    <FileSpreadsheet data-icon="inline-start" />
                    Baixar como Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <NotificationBell />
          </div>
        </div>

        <div className="px-10 pb-10">
          {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

          {template && criteria !== null && (
            <div className="mt-4 grid gap-6">
              <div>
                {editingName && !isLocked ? (
                  <Input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => setEditingName(false)}
                    className="h-auto max-w-md py-1 text-2xl font-semibold"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => !isLocked && setEditingName(true)}
                    disabled={isLocked}
                    className="group flex items-center gap-2 text-2xl font-semibold text-foreground disabled:cursor-not-allowed"
                  >
                    {template.name}
                    {!isLocked && (
                      <Pencil className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie e organize os critérios que irão compor a pontuação das categorias.
                </p>
              </div>

              {isLocked && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <Lock className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Este sistema de pontuação está em uso por um evento que já saiu da fase de
                    configuração e não pode mais ser editado, para não invalidar notas já
                    lançadas ou a estrutura que os jurados estão usando.
                  </p>
                </div>
              )}

              {!isLocked && staleScoreBands && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Alguma faixa de pontuação não cobre mais a nota máxima do critério — a
                    pontuação máxima foi alterada depois que as faixas foram salvas. Revise as
                    faixas do critério afetado (veja o aviso no painel de edição) antes de usar
                    este sistema de pontuação numa categoria.
                  </p>
                </div>
              )}

              <ScoringStatCards criteria={criteria} targetScore={template.targetScore} />

              <div className="rounded-lg border border-border/60 bg-primary/[0.03] p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Como funciona?</p>
                <p className="mt-1">
                  Crie critérios (grupos ou itens de avaliação) e defina a pontuação máxima para
                  cada um. Os itens podem ser organizados em níveis hierárquicos para refletir a
                  estrutura do seu sistema de avaliação.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ScoringTreePanel
                    criteria={criteria}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onAddRoot={handleAddRoot}
                    onAddChild={handleAddChild}
                    onDelete={setDeleteTarget}
                    onMove={handleMove}
                    readOnly={isLocked}
                  />
                </div>
                <EditCriterionPanel
                  className="min-w-0"
                  templateId={id!}
                  criterion={selectedCriterion}
                  hasChildren={selectedHasChildren}
                  onUpdated={handleCriterionUpdated}
                  onRequestDelete={setDeleteTarget}
                  readOnly={isLocked}
                />
              </div>

              <ScoringValidationBar criteria={criteria} targetScore={template.targetScore} />
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir critério"
        description={
          deleteDescendantCount > 0
            ? `Tem certeza que quer excluir "${deleteTarget?.name}"? ${deleteDescendantCount === 1 ? "O critério dentro dele também será apagado" : `Todos os ${deleteDescendantCount} critérios dentro dele também serão apagados`}. Essa ação não pode ser desfeita.`
            : `Tem certeza que quer excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`
        }
        confirmLabel="Excluir"
        confirmingLabel="Excluindo..."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
