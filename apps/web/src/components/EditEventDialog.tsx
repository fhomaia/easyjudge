import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { EventFormFields, type EventFormValues } from "@/components/EventFormFields";
import { eventsApi, ApiError, type Event } from "@/api/client";

interface EditEventDialogProps {
  event: Event | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (event: Event) => void;
}

function toFormValues(event: Event): EventFormValues {
  return {
    name: event.name,
    startDate: event.startDate,
    location: event.location,
  };
}

export function EditEventDialog({ event, onOpenChange, onUpdated }: EditEventDialogProps) {
  const [form, setForm] = useState<EventFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (event) {
      setForm(toFormValues(event));
      setError(null);
    }
  }, [event]);

  function update(key: keyof EventFormValues, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!event || !form) return;
    setError(null);
    if (!form.startDate) {
      setError("Selecione a data de início.");
      return;
    }
    setLoading(true);
    try {
      const updated = await eventsApi.update(event.id, {
        name: form.name,
        startDate: form.startDate,
        location: form.location,
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
    <Dialog open={event !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Editar evento</DialogTitle>
          <DialogDescription>
            {event?.status === "published"
              ? "Este evento está publicado — salvar as alterações volta o status para \"criado\" até republicar."
              : "Atualize os dados básicos do evento."}
          </DialogDescription>
        </div>

        <FormError message={error} />

        {form && (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <EventFormFields form={form} onChange={update} />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
