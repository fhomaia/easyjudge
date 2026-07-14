import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import {
  ScoringTemplateFormFields,
  type ScoringTemplateFormValues,
} from "@/components/ScoringTemplateFormFields";
import { scoringTemplatesApi, ApiError, type ScoringTemplate } from "@/api/client";

interface EditScoringTemplateDialogProps {
  template: ScoringTemplate | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (template: ScoringTemplate) => void;
}

function toFormValues(template: ScoringTemplate): ScoringTemplateFormValues {
  return {
    name: template.name,
    description: template.description ?? "",
    targetScore: String(template.targetScore),
  };
}

export function EditScoringTemplateDialog({
  template,
  onOpenChange,
  onUpdated,
}: EditScoringTemplateDialogProps) {
  const [form, setForm] = useState<ScoringTemplateFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (template) {
      setForm(toFormValues(template));
      setError(null);
    }
  }, [template]);

  function update(key: keyof ScoringTemplateFormValues, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!template || !form) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await scoringTemplatesApi.update(template.id, {
        name: form.name,
        description: form.description || undefined,
        targetScore: form.targetScore ? Number(form.targetScore) : undefined,
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
    <Dialog open={template !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Editar template de pontuação</DialogTitle>
          <DialogDescription>Atualize os dados básicos do template.</DialogDescription>
        </div>

        <FormError message={error} />

        {form && (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <ScoringTemplateFormFields form={form} onChange={update} />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
