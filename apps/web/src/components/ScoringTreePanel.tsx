import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronsDownUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoringCriterionRow } from "@/components/ScoringCriterionRow";
import { flattenTree } from "@/lib/scoringTree";
import { getProjection } from "@/lib/dndProjection";
import type { ScoringCriterion } from "@/api/client";

const INDENTATION_WIDTH = 24;

interface ScoringTreePanelProps {
  criteria: ScoringCriterion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddRoot: () => void;
  onAddChild: (parentId: string) => void;
  onDelete: (criterion: ScoringCriterion) => void;
  onMove: (criterionId: string, newParentId: string | null, newIndex: number) => void;
}

interface SortableRowProps {
  criterion: ScoringCriterion;
  criteria: ScoringCriterion[];
  depth: number;
  path: string;
  hasChildren: boolean;
  collapsed: boolean;
  selected: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}

function SortableRow({
  criterion,
  criteria,
  depth,
  path,
  hasChildren,
  collapsed,
  selected,
  onToggleCollapse,
  onSelect,
  onAddChild,
  onDelete,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: criterion.id,
  });

  return (
    <ScoringCriterionRow
      criterion={criterion}
      criteria={criteria}
      depth={depth}
      path={path}
      hasChildren={hasChildren}
      collapsed={collapsed}
      selected={selected}
      onToggleCollapse={onToggleCollapse}
      onSelect={onSelect}
      onAddChild={onAddChild}
      onDelete={onDelete}
      rootRef={setNodeRef}
      rootStyle={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
    />
  );
}

export function ScoringTreePanel({
  criteria,
  selectedId,
  onSelect,
  onAddRoot,
  onAddChild,
  onDelete,
  onMove,
}: ScoringTreePanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function collapseAll() {
    setCollapsedIds(new Set(criteria.filter((c) => c.type === "group").map((c) => c.id)));
  }

  function expandAll() {
    setCollapsedIds(new Set());
  }

  const allCollapsed =
    criteria.filter((c) => c.type === "group").length > 0 &&
    criteria.filter((c) => c.type === "group").every((c) => collapsedIds.has(c.id));

  const nodes = flattenTree(criteria, collapsedIds);
  const flatItems = useMemo(
    () => nodes.map(({ criterion, depth }) => ({ id: criterion.id, parentId: criterion.parentId, depth })),
    [nodes],
  );

  const projected =
    activeId && overId
      ? getProjection(flatItems, activeId, overId, offsetLeft, INDENTATION_WIDTH)
      : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setOverId(String(event.active.id));
  }

  function handleDragMove(event: DragMoveEvent) {
    setOffsetLeft(event.delta.x);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function resetDragState() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !projected) {
      resetDragState();
      return;
    }

    const { depth, parentId } = projected;
    const activeIndex = flatItems.findIndex((item) => item.id === active.id);
    const overIndex = flatItems.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(flatItems, activeIndex, overIndex).map((item) =>
      item.id === active.id ? { ...item, depth, parentId } : item,
    );

    // Índice entre os irmãos do novo pai, na ordem resultante do drop.
    const newSiblingIds = reordered
      .filter((item) => item.parentId === parentId)
      .map((item) => item.id);
    const newIndex = newSiblingIds.indexOf(String(active.id));

    resetDragState();
    onMove(String(active.id), parentId, newIndex);
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between gap-4 border-b border-border/60 p-4">
        <h2 className="font-semibold text-foreground">Estrutura do template</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAddRoot}>
            <Plus data-icon="inline-start" />
            Adicionar critério raiz
          </Button>
          <Button size="sm" variant="ghost" onClick={allCollapsed ? expandAll : collapseAll}>
            <ChevronsDownUp data-icon="inline-start" />
            {allCollapsed ? "Expandir tudo" : "Recolher tudo"}
          </Button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nenhum critério ainda. Comece adicionando um critério raiz.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={resetDragState}
        >
          <SortableContext
            items={flatItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {nodes.map(({ criterion, depth, path, hasChildren }) => (
                <SortableRow
                  key={criterion.id}
                  criterion={criterion}
                  criteria={criteria}
                  depth={
                    activeId === criterion.id && projected ? projected.depth : depth
                  }
                  path={path}
                  hasChildren={hasChildren}
                  collapsed={collapsedIds.has(criterion.id)}
                  selected={selectedId === criterion.id}
                  onToggleCollapse={() => toggleCollapse(criterion.id)}
                  onSelect={() => onSelect(criterion.id)}
                  onAddChild={() => onAddChild(criterion.id)}
                  onDelete={() => onDelete(criterion)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="border-t border-border/60 p-4">
        <Button variant="outline" className="w-full" onClick={onAddRoot}>
          <Plus data-icon="inline-start" />
          Adicionar critério raiz
        </Button>
      </div>
    </div>
  );
}
