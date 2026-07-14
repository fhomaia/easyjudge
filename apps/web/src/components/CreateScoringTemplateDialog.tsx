import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  ScoringTemplateFormFields,
  type ScoringTemplateFormValues,
} from "@/components/ScoringTemplateFormFields";
import { scoringTemplatesApi, ApiError, type ScoringTemplate } from "@/api/client";

interface CreateScoringTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (template: ScoringTemplate) => void;
}

const initialForm: ScoringTemplateFormValues = {
  name: "",
  description: "",
  targetScore: "100",
};

export function CreateScoringTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateScoringTemplateDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [cloneFromId, setCloneFromId] = useState("");
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      scoringTemplatesApi.list().then(setTemplates).catch(() => setTemplates([]));
    }
  }, [open]);

  function update(key: keyof ScoringTemplateFormValues, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateCloneFromId(value: string) {
    setCloneFromId(value);
    const source = templates.find((t) => t.id === value);
    if (source) {
      setForm((f) => ({
        ...f,
        name: `${source.name} (cópia)`,
        targetScore: String(source.targetScore),
      }));
    }
  }

  function resetForm() {
    setForm(initialForm);
    setCloneFromId("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const template = await scoringTemplatesApi.create({
        name: form.name,
        description: form.description || undefined,
        targetScore: form.targetScore ? Number(form.targetScore) : undefined,
        cloneFromId: cloneFromId || undefined,
      });
      onCreated(template);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Novo template de pontuação</DialogTitle>
          <DialogDescription>
            Crie e organize os critérios que irão compor a pontuação das categorias.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          {templates.length > 0 && (
            <div className="grid gap-2">
              <Label>
                Clonar de{" "}
                <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Select
                value={cloneFromId || null}
                onValueChange={(value) => updateCloneFromId(value as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Começar em branco">
                    {(value: string) => templates.find((t) => t.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ScoringTemplateFormFields form={form} onChange={update} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar template"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
