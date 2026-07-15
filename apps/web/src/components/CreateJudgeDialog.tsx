import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { JudgeFormFields, type JudgeFormValues } from "@/components/JudgeFormFields";
import { judgesApi, ApiError, type Judge } from "@/api/client";

interface CreateJudgeDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (judge: Judge) => void;
}

const initialForm: JudgeFormValues = {
  name: "",
  email: "",
  userId: "",
};

export function CreateJudgeDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: CreateJudgeDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof JudgeFormValues, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
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
      const judge = await judgesApi.create(eventId, {
        name: form.name,
        email: form.email,
        userId: form.userId || undefined,
      });
      onCreated(judge);
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
          <DialogTitle className="text-xl font-medium">Adicionar jurado</DialogTitle>
          <DialogDescription>Essa ação adicionará um jurado ao painel de jurados.</DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <JudgeFormFields form={form} onChange={update} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Adicionando..." : "Adicionar jurado"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
