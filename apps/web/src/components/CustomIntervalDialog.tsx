import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { ApiError, scheduleApi, type ScheduleDay, type ScheduleEntry } from "@/api/client";

interface CustomIntervalDialogProps {
  eventId: string;
  day: ScheduleDay;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (createdEntries: ScheduleEntry[]) => void;
}

// Aberto pelo bloco "Intervalo personalizado" na biblioteca de
// componentes — diferente dos outros blocos (Almoço, Contestação...),
// que já têm nome e duração fixos e vão direto pro recurso onde forem
// soltos, este pede nome (opcional) e duração antes de criar, então
// usa um popup com seletor de recurso em vez de drag-and-drop.
export function CustomIntervalDialog({
  eventId,
  day,
  open,
  onOpenChange,
  onCreated,
}: CustomIntervalDialogProps) {
  const sortedResources = [...day.resources].sort((a, b) => a.order - b.order);
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [resourceId, setResourceId] = useState(sortedResources[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setDurationMinutes(15);
      setResourceId(sortedResources[0]?.id ?? "");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resourceId) {
      setError("Escolha em qual recurso adicionar o intervalo.");
      return;
    }
    if (!durationMinutes || durationMinutes < 1) {
      setError("Informe uma duração válida.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await scheduleApi.createEntry(eventId, day.id, {
        resourceId,
        type: "break",
        order: Number.MAX_SAFE_INTEGER,
        durationMinutes,
        label: name.trim() || undefined,
      });
      onCreated(created);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Intervalo personalizado</DialogTitle>
          <DialogDescription>
            Adicione um intervalo com o nome e a duração que fizerem sentido pro seu evento.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="interval-name">
              Nome <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="interval-name"
              autoFocus
              placeholder="Ex: Reunião técnica, Manutenção do tapete..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="interval-duration">Duração (min)</Label>
            <Input
              id="interval-duration"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Recurso</Label>
            <Select value={resourceId || null} onValueChange={(value) => setResourceId(value ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {(value: string) =>
                    sortedResources.find((r) => r.id === value)?.name ?? "Selecione um recurso"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedResources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FormError message={error} />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adicionando..." : "Adicionar intervalo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
