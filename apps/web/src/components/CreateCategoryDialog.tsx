import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import {
  CategoryFormFields,
  type CategorySharedFormValues,
} from "@/components/CategoryFormFields";
import { CategoryLevelSelector } from "@/components/CategoryLevelSelector";
import { buildCategoryName, isAlwaysNonTumbling } from "@/lib/categoryLabels";
import { categoriesApi, ApiError, type Category, type CategoryFormat } from "@/api/client";

interface CreateCategoryDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: Category) => void;
}

const initialForm: CategorySharedFormValues = {
  modality: "all_star",
  division: "coed",
  categoryFormat: "team_cheer",
  customFormatLabel: "",
  nonTumbling: false,
};

function collectLevels(selectedLevels: Set<number>, customLevels: string[]): number[] {
  const custom = customLevels
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...selectedLevels, ...custom];
}

export function CreateCategoryDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: CreateCategoryDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());
  const [customLevels, setCustomLevels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof CategorySharedFormValues, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "categoryFormat" && isAlwaysNonTumbling(value as CategoryFormat)) {
        next.nonTumbling = true;
      }
      return next;
    });
  }

  function toggleNonTumbling(value: boolean) {
    setForm((f) => ({ ...f, nonTumbling: value }));
  }

  function toggleLevel(level: number) {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function resetForm() {
    setForm(initialForm);
    setSelectedLevels(new Set());
    setCustomLevels([]);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const levels = collectLevels(selectedLevels, customLevels);
    if (levels.length === 0) {
      setError("Selecione ao menos um nível.");
      return;
    }

    if (form.categoryFormat === "custom" && !form.customFormatLabel.trim()) {
      setError("Informe o nome do formato customizado.");
      return;
    }

    const nonTumbling = isAlwaysNonTumbling(form.categoryFormat) || form.nonTumbling;
    const customFormatLabel = form.categoryFormat === "custom" ? form.customFormatLabel : null;

    setLoading(true);
    try {
      for (const level of levels) {
        const category = await categoriesApi.create(eventId, {
          name: buildCategoryName(
            form.categoryFormat,
            form.modality,
            form.division,
            level,
            customFormatLabel,
          ),
          modality: form.modality,
          division: form.division,
          categoryFormat: form.categoryFormat,
          customFormatLabel,
          level,
          nonTumbling,
        });
        onCreated(category);
      }
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const levelCount = collectLevels(selectedLevels, customLevels).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Adicionar categoria</DialogTitle>
          <DialogDescription>
            Uma categoria é criada para cada nível selecionado.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <CategoryFormFields form={form} onChange={update} onToggleNonTumbling={toggleNonTumbling} />

          <CategoryLevelSelector
            selectedLevels={selectedLevels}
            onToggleLevel={toggleLevel}
            customLevels={customLevels}
            onCustomLevelsChange={setCustomLevels}
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? "Adicionando..."
              : levelCount > 1
                ? `Adicionar ${levelCount} categorias`
                : "Adicionar categoria"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
