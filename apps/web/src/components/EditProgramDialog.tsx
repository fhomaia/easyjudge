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
  ProgramFormFields,
  type ProgramFormValues,
} from "@/components/ProgramFormFields";
import { programsApi, ApiError, type Program } from "@/api/client";

interface EditProgramDialogProps {
  eventId: string;
  program: Program | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (program: Program) => void;
}

function toFormValues(program: Program): ProgramFormValues {
  return {
    name: program.name,
    email: program.email,
    city: program.city,
    state: program.state,
    userId: program.userId ?? "",
  };
}

export function EditProgramDialog({
  eventId,
  program,
  onOpenChange,
  onUpdated,
}: EditProgramDialogProps) {
  const [form, setForm] = useState<ProgramFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (program) {
      setForm(toFormValues(program));
      setError(null);
    }
  }, [program]);

  function update(key: keyof ProgramFormValues, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!program || !form) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await programsApi.update(eventId, program.id, {
        name: form.name,
        email: form.email,
        city: form.city,
        state: form.state,
        userId: form.userId || undefined,
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
    <Dialog open={program !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Editar dados do programa</DialogTitle>
          <DialogDescription>Atualize os dados do programa.</DialogDescription>
        </div>

        <FormError message={error} />

        {form && (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <ProgramFormFields form={form} onChange={update} />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
