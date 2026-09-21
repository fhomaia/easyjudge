import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { EventFormFields } from "@/components/EventFormFields";
import { EventPhotoField } from "@/components/EventPhotoField";
import { eventsApi, ApiError, type Event } from "@/api/client";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: Event) => void;
}

const initialForm = {
  name: "",
  startDate: "",
  location: "",
  venue: "",
};

export function CreateEventDialog({ open, onOpenChange, onCreated }: CreateEventDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof initialForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.startDate) {
      setError("Selecione a data de início.");
      return;
    }
    setLoading(true);
    try {
      let event = await eventsApi.create({
        name: form.name,
        startDate: form.startDate,
        location: form.location,
        venue: form.venue,
      });
      if (photo) {
        event = await eventsApi.uploadLogo(event.aliasId, photo);
      }
      onCreated(event);
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
          <DialogTitle className="text-xl font-medium">Criar evento</DialogTitle>
          <DialogDescription>
            Informe os dados básicos do evento. Categorias e equipes são
            adicionadas depois.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <EventPhotoField
            name={form.name}
            preview={photoPreview}
            onSelect={(file, preview) => {
              setPhoto(file);
              setPhotoPreview(preview);
            }}
            onClear={() => {
              setPhoto(null);
              setPhotoPreview(null);
            }}
            onError={setError}
          />

          <EventFormFields form={form} onChange={update} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar evento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
