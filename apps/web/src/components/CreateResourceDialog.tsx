import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/FormError";
import { ResourceColorPicker } from "@/components/ResourceColorPicker";
import { VIBRANT_COLORS } from "@/lib/avatarColor";
import { ApiError, scheduleApi, type ScheduleResource } from "@/api/client";

const NONE_VALUE = "none";

interface CreateResourceDialogProps {
  eventId: string;
  dayId: string;
  existingResources: ScheduleResource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// Formulário de cadastro de um recurso novo — aberto pela linha
// tracejada "Novo recurso" no fim da timeline (ScheduleTimeline). O
// recurso só é criado de fato no submit.
export function CreateResourceDialog({
  eventId,
  dayId,
  existingResources,
  open,
  onOpenChange,
  onCreated,
}: CreateResourceDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(VIBRANT_COLORS[0]);
  const [supportsPresentations, setSupportsPresentations] = useState(false);
  const [pairedResourceId, setPairedResourceId] = useState(NONE_VALUE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setColor(VIBRANT_COLORS[0]);
      setSupportsPresentations(false);
      setPairedResourceId(NONE_VALUE);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Informe um nome para o recurso.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await scheduleApi.createResource(eventId, dayId, {
        name: name.trim(),
        color,
        supportsPresentations,
        pairedResourceId:
          !supportsPresentations && pairedResourceId !== NONE_VALUE ? pairedResourceId : undefined,
      });
      onCreated();
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
          <DialogTitle className="text-xl font-medium">Adicionar recurso</DialogTitle>
          <DialogDescription>
            Um recurso é uma linha da timeline — pista, área de aquecimento, isolamento, palco de
            premiação, o que fizer sentido pro seu evento.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="resource-name">Nome</Label>
            <Input
              id="resource-name"
              autoFocus
              placeholder="Ex: Tapete Azul, Isolamento 1..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Cor</Label>
            <ResourceColorPicker value={color} onChange={setColor} />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={supportsPresentations}
              onCheckedChange={(value) => setSupportsPresentations(value === true)}
            />
            Aceita apresentações
          </label>

          {!supportsPresentations && (
            <div className="grid gap-2">
              <Label>Pista vinculada</Label>
              <p className="text-xs text-muted-foreground">
                Se este recurso funciona como aquecimento, diga a qual pista ele atende. Uma
                pista pode ter mais de uma área de aquecimento vinculada.
              </p>
              <Select value={pairedResourceId} onValueChange={(value) => setPairedResourceId(value ?? NONE_VALUE)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) =>
                      value === NONE_VALUE
                        ? "Nenhuma"
                        : (existingResources.find((r) => r.id === value)?.name ?? "Nenhuma")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                  {existingResources
                    .filter((r) => r.supportsPresentations)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <FormError message={error} />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adicionando..." : "Adicionar recurso"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
