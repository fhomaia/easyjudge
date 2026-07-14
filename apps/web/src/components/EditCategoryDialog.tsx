import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/FormError";
import {
  CategoryFormFields,
  type CategorySharedFormValues,
} from "@/components/CategoryFormFields";
import { STATUS_LABELS, isAlwaysNonTumbling } from "@/lib/categoryLabels";
import { normalizeDecimalInput } from "@/lib/normalizeDecimalInput";
import {
  categoriesApi,
  ApiError,
  type Category,
  type CategoryFormat,
  type CategoryStatus,
} from "@/api/client";

interface EditCategoryDialogProps {
  eventId: string;
  category: Category | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (category: Category) => void;
}

interface EditFormValues extends CategorySharedFormValues {
  name: string;
  level: string;
}

function toFormValues(category: Category): EditFormValues {
  return {
    name: category.name,
    modality: category.modality,
    division: category.division,
    categoryFormat: category.categoryFormat,
    customFormatLabel: category.customFormatLabel ?? "",
    level: String(category.level),
    nonTumbling: category.nonTumbling,
  };
}

export function EditCategoryDialog({
  eventId,
  category,
  onOpenChange,
  onUpdated,
}: EditCategoryDialogProps) {
  const [form, setForm] = useState<EditFormValues | null>(null);
  const [status, setStatus] = useState<CategoryStatus>("active");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      setForm(toFormValues(category));
      setStatus(category.status);
      setError(null);
    }
  }, [category]);

  function update(key: keyof CategorySharedFormValues, value: string) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      if (key === "categoryFormat" && isAlwaysNonTumbling(value as CategoryFormat)) {
        next.nonTumbling = true;
      }
      return next;
    });
  }

  function toggleNonTumbling(value: boolean) {
    setForm((f) => (f ? { ...f, nonTumbling: value } : f));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!category || !form) return;
    setError(null);

    if (form.categoryFormat === "custom" && !form.customFormatLabel.trim()) {
      setError("Informe o nome do formato customizado.");
      return;
    }

    setLoading(true);
    try {
      const updated = await categoriesApi.update(eventId, category.id, {
        name: form.name,
        modality: form.modality,
        division: form.division,
        categoryFormat: form.categoryFormat,
        customFormatLabel: form.categoryFormat === "custom" ? form.customFormatLabel : null,
        level: Number(form.level),
        nonTumbling: isAlwaysNonTumbling(form.categoryFormat) || form.nonTumbling,
        status,
      });
      onUpdated(updated);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={category !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Editar categoria</DialogTitle>
          <DialogDescription>Atualize os dados da categoria.</DialogDescription>
        </div>

        <FormError message={error} />

        {form && (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="category-name">Nome da categoria</Label>
              <Input
                id="category-name"
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                required
              />
            </div>

            <CategoryFormFields form={form} onChange={update} onToggleNonTumbling={toggleNonTumbling} />

            <div className="grid gap-2">
              <Label htmlFor="category-level">Nível (1 a 7)</Label>
              <Input
                id="category-level"
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 3.5"
                value={form.level}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, level: normalizeDecimalInput(e.target.value) } : f,
                  )
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as CategoryStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: CategoryStatus) => STATUS_LABELS[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as CategoryStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {STATUS_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
