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
  ProgramFormFields,
  type ProgramFormValues,
} from "@/components/ProgramFormFields";
import { programsApi, ApiError, type Program } from "@/api/client";

interface CreateProgramDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (program: Program) => void;
}

const initialForm: ProgramFormValues = {
  name: "",
  email: "",
  city: "",
  state: "",
  userId: "",
};

export function CreateProgramDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: CreateProgramDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof ProgramFormValues, value: string) {
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
      const program = await programsApi.create(eventId, {
        name: form.name,
        email: form.email,
        city: form.city,
        state: form.state,
        userId: form.userId || undefined,
      });
      onCreated(program);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-lg sm:gap-7 sm:p-10">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Novo programa</DialogTitle>
          <DialogDescription>
            Cadastre o programa participante do evento.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <ProgramFormFields form={form} onChange={update} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Adicionando..." : "Adicionar programa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
