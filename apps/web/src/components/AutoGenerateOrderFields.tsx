import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { autoFormatKeyLabel } from "@/lib/autoFormatKey";
import type {
  AutoGenerateLevelDirection,
  AutoGenerateOrderPrimary,
} from "@/api/client";

// Campos de "ordem das apresentações" do diálogo de gerar
// automaticamente. O estado mora no diálogo (é salvo por evento junto
// com a geração); aqui é só apresentação. Na interface o "formato" da
// categoria (Team Cheer, Group Stunt, Custom pelo nome...) se chama
// "categoria", a pedido do usuário.
interface AutoGenerateOrderFieldsProps {
  primary: AutoGenerateOrderPrimary;
  onPrimaryChange: (value: AutoGenerateOrderPrimary) => void;
  levelDirection: AutoGenerateLevelDirection;
  onLevelDirectionChange: (value: AutoGenerateLevelDirection) => void;
  // Chaves de autoFormatKey, só do que existe no evento. `null` =
  // ainda carregando.
  categoryOrder: string[] | null;
  onCategoryOrderChange: (value: string[]) => void;
  onReset: () => void;
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Item da lista de categorias: arrasta pela alça (só ela inicia o
// arraste, então as setas e a rolagem por toque seguem funcionando) e
// mantém as setas como alternativa por teclado/toque. O movimento fica
// preso ao eixo vertical (x zerado).
function SortableCategoryItem({
  id,
  index,
  total,
  onMove,
}: {
  id: string;
  index: number;
  total: number;
  onMove: (index: number, delta: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const label = autoFormatKeyLabel(id);
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(
          transform ? { ...transform, x: 0 } : null,
        ),
        transition,
      }}
      className={cn(
        "relative flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm",
        isDragging && "z-10 shadow-md ring-1 ring-primary/40",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${label}`}
        className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-muted-foreground">{index + 1}.</span>
      <span className="flex-1">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onMove(index, -1)}
        disabled={index === 0}
        aria-label={`Subir ${label}`}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onMove(index, 1)}
        disabled={index === total - 1}
        aria-label={`Descer ${label}`}
      >
        <ArrowDown className="size-4" />
      </Button>
    </li>
  );
}

export function AutoGenerateOrderFields({
  primary,
  onPrimaryChange,
  levelDirection,
  onLevelDirectionChange,
  categoryOrder,
  onCategoryOrderChange,
  onReset,
}: AutoGenerateOrderFieldsProps) {
  // Distância mínima antes de começar a arrastar evita disparar por um
  // clique simples na alça.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!categoryOrder || !over || active.id === over.id) return;
    const from = categoryOrder.indexOf(String(active.id));
    const to = categoryOrder.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onCategoryOrderChange(arrayMove(categoryOrder, from, to));
  }

  function move(index: number, delta: -1 | 1) {
    if (!categoryOrder) return;
    const target = index + delta;
    if (target < 0 || target >= categoryOrder.length) return;
    const next = [...categoryOrder];
    [next[index], next[target]] = [next[target], next[index]];
    onCategoryOrderChange(next);
  }

  const levelLabel =
    levelDirection === "asc" ? "nível crescente" : "nível decrescente";
  const categoriesLabel = (categoryOrder ?? [])
    .map(autoFormatKeyLabel)
    .join(" > ");
  const summary =
    primary === "format"
      ? `Primeiro por categoria (${categoriesLabel}); dentro de cada categoria, ${levelLabel}.`
      : `Primeiro por ${levelLabel}; em cada nível, categorias na ordem ${categoriesLabel}.`;

  // Os dois critérios são sempre os mesmos (categoria e nível): o
  // usuário só escolhe qual vem primeiro, e o outro fica automaticamente
  // como secundário. Cada um tem o seu próprio controle de ordenação,
  // exibido na ordem principal, depois secundário.
  const levelControl = (
    <div className="flex gap-2">
      <ChoiceButton
        selected={levelDirection === "asc"}
        onClick={() => onLevelDirectionChange("asc")}
      >
        Crescente
      </ChoiceButton>
      <ChoiceButton
        selected={levelDirection === "desc"}
        onClick={() => onLevelDirectionChange("desc")}
      >
        Decrescente
      </ChoiceButton>
    </div>
  );

  const categoryControl =
    categoryOrder === null ? (
      <p className="text-sm text-muted-foreground">Carregando categorias...</p>
    ) : categoryOrder.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Este evento ainda não tem categorias cadastradas.
      </p>
    ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categoryOrder}
          strategy={verticalListSortingStrategy}
        >
          <ol className="grid gap-1.5">
            {categoryOrder.map((key, index) => (
              <SortableCategoryItem
                key={key}
                id={key}
                index={index}
                total={categoryOrder.length}
                onMove={move}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    );

  const categoryLabel = "Ordem de preferência das categorias";
  const levelOrderLabel = "Ordem por nível";
  const primaryIsCategory = primary === "format";

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Ordem das apresentações</p>
          <p className="text-xs text-muted-foreground">
            Define em que ordem as apresentações entram no cronograma.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Restaurar padrão
        </Button>
      </div>

      <div className="grid gap-1.5">
        <Label>Critério principal</Label>
        <div className="flex gap-2">
          <ChoiceButton
            selected={primaryIsCategory}
            onClick={() => onPrimaryChange("format")}
          >
            Categoria
          </ChoiceButton>
          <ChoiceButton
            selected={!primaryIsCategory}
            onClick={() => onPrimaryChange("level")}
          >
            Nível
          </ChoiceButton>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{primaryIsCategory ? categoryLabel : levelOrderLabel}</Label>
        {primaryIsCategory ? categoryControl : levelControl}
      </div>

      <div className="grid gap-1.5 border-t border-border/60 pt-4">
        <Label>
          Critério secundário: {primaryIsCategory ? "nível" : "categoria"}
        </Label>
        <p className="text-xs text-muted-foreground">
          Desempata dentro de cada {primaryIsCategory ? "categoria" : "nível"}.
        </p>
        {primaryIsCategory ? levelControl : categoryControl}
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {summary}
      </p>
    </div>
  );
}
