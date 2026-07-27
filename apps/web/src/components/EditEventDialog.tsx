import { useEffect, useState, type FormEvent } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
    venue: event.venue ?? "",
  };
}

// Evento publicado/iniciado não pode ser editado direto (2026-07-27, a
// pedido do usuário) — campos ficam travados e o botão de salvar vira
// "Reverter publicação", que abre o mesmo ConfirmDialog usado na tela
// Início/menu "⋯". Depois de reverter com sucesso, este popup
// PERMANECE aberto (só o ConfirmDialog fecha) — `onUpdated` também
// atualiza o `event` que o pai passa de volta pra cá (ver
// HomePage.handleEditDialogUpdated), então os campos voltam a ficar
// editáveis e o botão volta a ser "Salvar alterações" sozinho, sem
// fechar o popup.
export function EditEventDialog({ event, onOpenChange, onUpdated }: EditEventDialogProps) {
  const [form, setForm] = useState<EventFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);

  const isLocked = event?.status === "published" || event?.status === "started";

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
      const updated = await eventsApi.update(event.aliasId, {
        name: form.name,
        startDate: form.startDate,
        location: form.location,
        venue: form.venue,
      });
      onUpdated(updated);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevert() {
    if (!event) return;
    const updated = await eventsApi.unpublish(event.aliasId);
    onUpdated(updated);
  }

  return (
    <>
      <Dialog open={event !== null} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-7 p-10 sm:max-w-lg">
          <div className="grid gap-1.5">
            <DialogTitle className="text-xl font-medium">Editar evento</DialogTitle>
            <DialogDescription>Atualize os dados básicos do evento.</DialogDescription>
          </div>

          <FormError message={error} />

          {form && (
            <div className="grid gap-5">
              {isLocked && (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-400">
                  <Info className="size-4 shrink-0" />
                  Reverta a publicação do evento para editar
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid gap-5">
                <EventFormFields form={form} onChange={update} disabled={isLocked} />

                {isLocked ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setRevertDialogOpen(true)}
                  >
                    Reverter publicação
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Salvando..." : "Salvar alterações"}
                  </Button>
                )}
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        title="Reverter publicação?"
        description="O evento volta para o status Criado e você pode editar as configurações novamente. Ele deixa de ficar visível para os participantes até ser publicado de novo."
        confirmLabel="Reverter"
        confirmingLabel="Revertendo..."
        onConfirm={handleRevert}
      />
    </>
  );
}
