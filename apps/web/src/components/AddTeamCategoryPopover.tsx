import { useState } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Category, Team } from "@/api/client";

interface AddTeamCategoryPopoverProps {
  team: Team;
  categories: Category[];
  onAdd: (categoryIds: string[]) => Promise<void>;
}

export function AddTeamCategoryPopover({
  team,
  categories,
  onAdd,
}: AddTeamCategoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const linkedIds = new Set(team.categories.map((c) => c.id));
  const availableCategories = categories.filter((c) => !linkedIds.has(c.id));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSelectedIds(new Set());
  }

  function toggleCategory(categoryId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(categoryId);
      else next.delete(categoryId);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      await onAdd(Array.from(selectedIds));
      handleOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label="Adicionar categoria à equipe"
        className="flex size-7 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Plus className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="grid w-96 max-w-[90vw] gap-4 p-4" align="start">
        <div className="grid gap-1.5">
          <p className="text-sm font-medium text-foreground">Adicionar categorias à equipe</p>
          <p className="text-xs text-muted-foreground">{team.name}</p>
        </div>

        <div className="grid min-w-0 gap-2">
          {availableCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Todas as categorias do evento já estão vinculadas a esta equipe.
            </p>
          ) : (
            <div className="grid max-h-64 gap-1 overflow-y-auto">
              {availableCategories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted/60"
                >
                  <Checkbox
                    checked={selectedIds.has(category.id)}
                    onCheckedChange={(value) =>
                      toggleCategory(category.id, value === true)
                    }
                  />
                  <span className="min-w-0 truncate text-foreground">{category.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={selectedIds.size === 0 || loading}
          onClick={handleAdd}
        >
          {loading
            ? "Adicionando..."
            : selectedIds.size > 1
              ? `Adicionar ${selectedIds.size} categorias`
              : "Adicionar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
