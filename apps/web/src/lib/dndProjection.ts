import { arrayMove } from "@dnd-kit/sortable";

export interface FlatDndItem {
  id: string;
  parentId: string | null;
  depth: number;
}

export interface Projection {
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: string | null;
}

// Adaptado do exemplo oficial "sortable tree" do dnd-kit: calcula, a
// partir da posição de drop e do deslocamento horizontal do drag,
// qual seria a profundidade (e portanto o novo pai) do item arrastado.
export function getProjection(
  items: FlatDndItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number,
): Projection {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;

  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  return { depth, maxDepth, minDepth, parentId: getParentId() };

  function getParentId(): string | null {
    if (depth === 0 || !previousItem) {
      return null;
    }
    if (depth === previousItem.depth) {
      return previousItem.parentId;
    }
    if (depth > previousItem.depth) {
      return previousItem.id;
    }
    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;
    return newParent ?? null;
  }
}
