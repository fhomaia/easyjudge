import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  FileText,
  Lock,
  GripVertical,
  List,
  Pencil,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { CRITERION_LABELS, CRITERION_ORDER, isOptionCriterion } from "@/lib/categoryCriteria";
import { cn } from "@/lib/utils";
import {
  ApiError,
  categoryCriteriaApi,
  registrationSettingsApi,
  type CategoryCriterion,
  type CategoryCriterionKey,
  type RegistrationRequirement,
  type RegistrationSettings,
  type RequirementKind,
  type RequirementPreset,
} from "@/api/client";

const KIND_LABELS: Record<RequirementKind, string> = {
  document: "Documento",
  text: "Texto",
  select: "Lista de opções",
  date: "Data",
};

const KIND_ICONS: Record<RequirementKind, typeof FileText> = {
  document: FileText,
  text: Type,
  select: List,
  date: CalendarDays,
};

// Sugestões com formato e validação próprios: nome fixo (espelha
// LOCKED_LABEL_PRESETS da API).
const LOCKED_LABEL_PRESETS: RequirementPreset[] = ["birth_date", "cpf", "phone"];

// Sempre pedidos (vêm do cadastro do atleta): fixos no topo, sem editar,
// remover ou mover.
const FIXED_FIELDS = ["Nome", "Email"];

// "Todas as categorias" ou "Vínculo institucional: Escolar · Gênero: COED".
function appliesToText(
  appliesTo: RegistrationRequirement["appliesTo"],
  criteria: CategoryCriterion[],
): string {
  if (!appliesTo) return "Todas as categorias";
  return Object.entries(appliesTo)
    .map(([key, ids]) => {
      const options = criteria.find((c) => c.key === key)?.options ?? [];
      const labels = (ids ?? []).map((id) => options.find((o) => o.id === id)?.label ?? id);
      return `${CRITERION_LABELS[key as CategoryCriterionKey]}: ${labels.join(", ")}`;
    })
    .join(" · ");
}

// Aba Configurações (tela de Inscrições do produtor): dados e documentos
// pedidos aos atletas. O produtor ativa as sugestões que quiser e cria
// outros (documento, texto ou lista de opções). Cada mudança salva na hora.
export function RegistrationRequirementsSection({ eventId }: { eventId: string }) {
  const [settings, setSettings] = useState<RegistrationSettings | null>(null);
  const [presets, setPresets] = useState<RegistrationRequirement[]>([]);
  const [criteria, setCriteria] = useState<CategoryCriterion[]>([]);
  const [editing, setEditing] = useState<{ index: number | null; value: RegistrationRequirement } | null>(
    null,
  );
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registrationSettingsApi
      .get(eventId)
      .then(({ presets: p, ...s }) => {
        setSettings(s);
        setPresets(p);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar."),
      );
    categoryCriteriaApi.get(eventId).then(setCriteria).catch(() => setCriteria([]));
  }, [eventId]);

  async function save(next: RegistrationSettings) {
    setError(null);
    const saved = await registrationSettingsApi.update(eventId, next);
    setSettings(saved);
  }

  // Ordem da lista = ordem do formulário do atleta/programa. Arrastar
  // pela alça ou usar as setas; salva na hora.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function reorder(from: number, to: number) {
    if (!settings || from === to || to < 0 || to >= settings.requirements.length) return;
    const requirements = arrayMove(settings.requirements, from, to);
    setSettings({ ...settings, requirements });
    void save({ ...settings, requirements }).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar."),
    );
  }

  function move(index: number, delta: number) {
    reorder(index, index + delta);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!settings || !event.over || event.active.id === event.over.id) return;
    const ids = settings.requirements.map((r, index) => r.id ?? `new-${index}`);
    reorder(ids.indexOf(String(event.active.id)), ids.indexOf(String(event.over.id)));
  }

  if (!settings) {
    return error ? <p className="text-sm text-destructive">{error}</p> : null;
  }

  const usedPresets = new Set(settings.requirements.map((r) => r.preset).filter(Boolean));
  const available = presets.filter((p) => p.preset && !usedPresets.has(p.preset));

  return (
    <section className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <div>
        <h2 className="font-semibold text-foreground">Dados e documentos dos atletas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O que cada atleta precisa informar ou enviar na inscrição, na ordem em que aparece no
          formulário (arraste ou use as setas para mudar). O próprio atleta completa pela conta dele, ou o
          programa completa por ele.
        </p>
      </div>

      <FormError message={error} />

      <ul className="grid gap-2">
        {FIXED_FIELDS.map((label) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm"
          >
            <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
              <Lock className="size-4" />
            </span>
            <span className="font-medium text-foreground">{label}</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Obrigatório
            </span>
          </li>
        ))}
      </ul>

      {settings.requirements.length === 0 ? null : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={settings.requirements.map((r, index) => r.id ?? `new-${index}`)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="grid gap-2">
              {settings.requirements.map((r, index) => (
                <SortableRequirementRow
                  key={r.id ?? `new-${index}`}
                  id={r.id ?? `new-${index}`}
                  requirement={r}
                  index={index}
                  total={settings.requirements.length}
                  criteria={criteria}
                  onMove={move}
                  onEdit={() => setEditing({ index, value: r })}
                  onRemove={() => setRemoveIndex(index)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="grid gap-2">
        {available.length > 0 && (
          <>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sugestões
            </p>
            <div className="flex flex-wrap gap-2">
              {available.map((p) => (
                <button
                  key={p.preset}
                  type="button"
                  onClick={() =>
                    void save({
                      ...settings,
                      requirements: [...settings.requirements, { ...p, id: null }],
                    }).catch((err) =>
                      setError(err instanceof ApiError ? err.message : "Não foi possível salvar."),
                    )
                  }
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="size-3.5" />
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() =>
            setEditing({
              index: null,
              value: {
                id: null,
                kind: "document",
                preset: null,
                label: "",
                description: null,
                required: true,
                options: [],
                appliesTo: null,
              },
            })
          }
        >
          <Plus data-icon="inline-start" />
          Novo dado ou documento
        </Button>
      </div>

      <div className="flex items-start gap-3 border-t border-border/60 pt-4 text-sm">
        <Switch
          id="allow-submit-without-documents"
          checked={settings.allowSubmitWithoutDocuments}
          onCheckedChange={(checked) =>
            void save({ ...settings, allowSubmitWithoutDocuments: checked }).catch((err) =>
              setError(err instanceof ApiError ? err.message : "Não foi possível salvar."),
            )
          }
          className="mt-0.5"
        />
        <div>
          <label
            htmlFor="allow-submit-without-documents"
            className="cursor-pointer font-medium text-foreground"
          >
            O programa pode enviar a ficha sem todos os documentos dos atletas
          </label>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            <li>
              Desligado: a ficha só é enviada com os documentos obrigatórios de todos os atletas.
            </li>
            <li>
              Ligado: os documentos que faltarem podem ser enviados depois, até o prazo de
              inscrição.
            </li>
            <li>
              Os dados obrigatórios (texto, lista e data) sempre precisam estar preenchidos para
              enviar.
            </li>
          </ul>
        </div>
      </div>

      <RequirementDialog
        editing={editing}
        criteria={criteria}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={async (value) => {
          const requirements = [...settings.requirements];
          if (editing?.index != null) requirements[editing.index] = value;
          else requirements.push(value);
          await save({ ...settings, requirements });
        }}
      />

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => !open && setRemoveIndex(null)}
        title="Remover"
        description={`Deixar de pedir "${
          removeIndex !== null ? settings.requirements[removeIndex]?.label : ""
        }" aos atletas?`}
        confirmLabel="Remover"
        confirmingLabel="Removendo..."
        onConfirm={async () => {
          if (removeIndex === null) return;
          await save({
            ...settings,
            requirements: settings.requirements.filter((_, i) => i !== removeIndex),
          });
        }}
      />
    </section>
  );
}

function SortableRequirementRow({
  id,
  requirement: r,
  index,
  total,
  criteria,
  onMove,
  onEdit,
  onRemove,
}: {
  id: string;
  requirement: RegistrationRequirement;
  index: number;
  total: number;
  criteria: CategoryCriterion[];
  onMove: (index: number, delta: number) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const Icon = KIND_ICONS[r.kind];
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
        transition,
      }}
      className={cn(
        "relative flex items-start gap-2 rounded-lg border border-border/60 bg-card p-3 sm:gap-3",
        isDragging && "z-10 shadow-md ring-1 ring-primary/40",
      )}
    >
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${r.label}`}
          className="flex size-7 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Subir ${r.label}`}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Descer ${r.label}`}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      </div>
      <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">
          {r.label}
          <span
            className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
              r.required
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {r.required ? "Obrigatório" : "Opcional"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {KIND_LABELS[r.kind]}
          {r.kind === "select" && r.options.length > 0 && ` (${r.options.join(", ")})`}
          {" · "}
          {appliesToText(r.appliesTo, criteria)}
        </p>
        {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
        {r.preset === "birth_date" && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Categorias com regra de idade exigem a data mesmo se ela sair daqui.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${r.label}`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${r.label}`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function RequirementDialog({
  editing,
  criteria,
  onOpenChange,
  onSave,
}: {
  editing: { index: number | null; value: RegistrationRequirement } | null;
  criteria: CategoryCriterion[];
  onOpenChange: (open: boolean) => void;
  onSave: (value: RegistrationRequirement) => Promise<void>;
}) {
  const [draft, setDraft] = useState<RegistrationRequirement | null>(null);
  // Uma caixa por opção (lista); vazias são ignoradas ao salvar.
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [focusOption, setFocusOption] = useState<number | null>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Leva o cursor pra opção recém-criada (Enter ou "Adicionar opção").
  useEffect(() => {
    if (focusOption === null) return;
    optionRefs.current[focusOption]?.focus();
    setFocusOption(null);
  }, [focusOption, optionsList]);
  const [someCategories, setSomeCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setDraft(editing.value);
    setOptionsList(editing.value.options.length ? editing.value.options : ["", ""]);
    setFocusOption(null);
    setSomeCategories(!!editing.value.appliesTo);
    setError(null);
  }, [editing]);

  if (!draft) return <Dialog open={false} onOpenChange={onOpenChange} />;
  const isPreset = !!draft.preset;
  // Data, CPF e telefone: nome fixo (validação e máscara próprias).
  const labelLocked = !!draft.preset && LOCKED_LABEL_PRESETS.includes(draft.preset);
  const optionCriteria = CRITERION_ORDER.filter(isOptionCriterion)
    .map((key) => criteria.find((c) => c.key === key))
    .filter((c): c is CategoryCriterion => !!c);

  function toggleOption(key: CategoryCriterionKey, id: string) {
    setDraft((d) => {
      if (!d) return d;
      const current = d.appliesTo?.[key] ?? [];
      const nextList = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
      const appliesTo = { ...(d.appliesTo ?? {}), [key]: nextList };
      if (nextList.length === 0) delete appliesTo[key];
      return { ...d, appliesTo };
    });
  }

  async function handleSave() {
    if (!draft) return;
    setError(null);
    if (!draft.label.trim()) {
      setError("Informe o nome.");
      return;
    }
    const options =
      draft.kind === "select" ? optionsList.map((o) => o.trim()).filter(Boolean) : [];
    if (draft.kind === "select" && options.length < 2) {
      setError("Cadastre ao menos duas opções.");
      return;
    }
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      setError("Há opções repetidas.");
      return;
    }
    const appliesTo =
      someCategories && draft.appliesTo && Object.keys(draft.appliesTo).length > 0
        ? draft.appliesTo
        : null;
    if (someCategories && !appliesTo) {
      setError("Escolha ao menos uma opção de divisão, ou marque Todas as categorias.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...draft, label: draft.label.trim(), options, appliesTo });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={editing !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            {editing?.index == null ? "Novo dado ou documento" : "Editar"}
          </DialogTitle>
          <DialogDescription>Pedido a cada atleta na inscrição.</DialogDescription>
        </div>

        <FormError message={error} />

        {!isPreset && (
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABELS) as RequirementKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDraft({ ...draft, kind })}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    draft.kind === kind
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="requirement-label" className="flex items-center gap-1.5">
            Nome
            {labelLocked && (
              <span
                title="Este dado tem formato e validação próprios: o nome não pode ser alterado."
                aria-label="Nome fixo"
                className="text-muted-foreground"
              >
                <Lock className="size-3.5" />
              </span>
            )}
          </Label>
          <Input
            id="requirement-label"
            maxLength={60}
            placeholder="Ex.: Atestado médico"
            value={draft.label}
            disabled={labelLocked}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="requirement-description">Orientação (opcional)</Label>
          <Textarea
            id="requirement-description"
            maxLength={300}
            rows={2}
            placeholder="Ex.: emitido nos últimos 6 meses"
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value || null })}
          />
        </div>

        {draft.kind === "select" && (
          <div className="grid gap-2">
            <Label>Opções</Label>
            <div className="grid gap-2">
              {optionsList.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    maxLength={60}
                    placeholder={`Opção ${index + 1}`}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    aria-label={`Opção ${index + 1}`}
                    onChange={(e) =>
                      setOptionsList((list) =>
                        list.map((o, i) => (i === index ? e.target.value : o)),
                      )
                    }
                    onKeyDown={(e) => {
                      // Enter cria a próxima opção (sem enviar o formulário).
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      setOptionsList((list) => [
                        ...list.slice(0, index + 1),
                        "",
                        ...list.slice(index + 1),
                      ]);
                      setFocusOption(index + 1);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setOptionsList((list) => list.filter((_, i) => i !== index))}
                    disabled={optionsList.length <= 1}
                    aria-label={`Remover opção ${index + 1}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setOptionsList((list) => [...list, ""]);
                setFocusOption(optionsList.length);
              }}
              className="flex items-center gap-1.5 justify-self-start text-sm font-medium text-primary hover:underline"
            >
              <Plus className="size-4" />
              Adicionar opção
            </button>
          </div>
        )}

        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={draft.required}
            onCheckedChange={(required) => setDraft({ ...draft, required })}
          />
          Obrigatório
        </label>

        <div className="grid gap-2">
          <Label>Vale para</Label>
          <div className="flex flex-wrap gap-2">
            {[
              [false, "Todas as categorias"],
              [true, "Algumas categorias"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setSomeCategories(value as boolean)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  someCategories === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {label as string}
              </button>
            ))}
          </div>
          {someCategories && (
            <div className="grid gap-3 rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Vale para as categorias com as opções marcadas (em cada divisão marcada, uma delas).
              </p>
              {optionCriteria.map((criterion) => (
                <div key={criterion.key} className="grid gap-1.5">
                  <p className="text-xs font-medium text-foreground">
                    {CRITERION_LABELS[criterion.key]}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {criterion.options.map((option) => {
                      if (!option.id) return null;
                      const active = draft.appliesTo?.[criterion.key]?.includes(option.id) ?? false;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(criterion.key, option.id as string)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
