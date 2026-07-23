import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { EventFormFields } from "@/components/EventFormFields";
import { EventThumbnail } from "@/components/EventThumbnail";
import { eventsApi, ApiError, type Event } from "@/api/client";
import { ImagePlus, X } from "lucide-react";

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

const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export function CreateEventDialog({ open, onOpenChange, onCreated }: CreateEventDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update(key: keyof typeof initialForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setError("A foto deve ter no máximo 5MB.");
      e.target.value = "";
      return;
    }
    setError(null);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForm() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
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
        event = await eventsApi.uploadLogo(event.id, photo);
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
          <div className="grid gap-2">
            <Label>
              Foto do evento{" "}
              <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt=""
                    className="size-16 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    aria-label="Remover foto"
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <EventThumbnail name={form.name || "Evento"} logoUrl={null} className="size-16 text-base" />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus data-icon="inline-start" />
                {photoPreview ? "Trocar foto" : "Adicionar foto"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_LOGO_TYPES}
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          <EventFormFields form={form} onChange={update} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar evento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
