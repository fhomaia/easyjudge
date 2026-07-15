import { useState } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Team } from "@/api/client";

interface AddTeamCategoryPopoverProps {
  team: Team;
  categories: Category[];
  onAdd: (categoryId: string) => Promise<void>;
}

export function AddTeamCategoryPopover({
  team,
  categories,
  onAdd,
}: AddTeamCategoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  const linkedIds = new Set(team.categories.map((c) => c.id));
  const availableCategories = categories.filter((c) => !linkedIds.has(c.id));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setCategoryId("");
  }

  async function handleAdd() {
    if (!categoryId) return;
    setLoading(true);
    try {
      await onAdd(categoryId);
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
      <PopoverContent className="grid w-72 gap-4 p-4" align="start">
        <div className="grid gap-1.5">
          <p className="text-sm font-medium text-foreground">Adicionar categoria à equipe</p>
          <p className="text-xs text-muted-foreground">{team.name}</p>
        </div>

        <div className="grid gap-2">
          <Label>Categoria</Label>
          <Select value={categoryId || null} onValueChange={(v) => setCategoryId(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma categoria">
                {(value: string) => availableCategories.find((c) => c.id === value)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableCategories.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Todas as categorias do evento já estão vinculadas a esta equipe.
            </p>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={!categoryId || loading}
          onClick={handleAdd}
        >
          {loading ? "Adicionando..." : "Adicionar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
