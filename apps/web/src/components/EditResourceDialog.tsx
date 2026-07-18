import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ResourceColorPicker } from "@/components/ResourceColorPicker";
import { getResourceColor } from "@/lib/resourceColor";
import { ApiError, scheduleApi, type ScheduleResource } from "@/api/client";

const NONE_VALUE = "none";

interface EditResourceDialogProps {
  eventId: string;
  dayId: string;
  resourceId: string | null;
  allResources: ScheduleResource[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

// Aberto ao clicar no nome de um recurso na própria timeline — reúne
// edição (nome, aceita apresentações, aquecimento vinculado) e
// exclusão de UM recurso, substituindo o antigo botão "Gerenciar
// recursos" (que abria a lista inteira de uma vez). Reordenar é feito
// arrastando o recurso direto na timeline (ver ScheduleTimeline), não
// mais por aqui.
export function EditResourceDialog({
  eventId,
  dayId,
  resourceId,
  allResources,
  onOpenChange,
  onChanged,
}: EditResourceDialogProps) {
  const sortedResources = [...allResources].sort((a, b) => a.order - b.order);
  const resource = sortedResources.find((r) => r.id === resourceId) ?? null;

  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [supportsPresentations, setSupportsPresentations] = useState(false);
  const [pairedResourceId, setPairedResourceId] = useState(NONE_VALUE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (resource) {
      setName(resource.name);
      setColor(getResourceColor(resource));
      setSupportsPresentations(resource.supportsPresentations);
      setPairedResourceId(resource.pairedResourceId ?? NONE_VALUE);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource?.id]);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resource) return;
    if (!name.trim()) {
      setError("Informe um nome para o recurso.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await scheduleApi.updateResource(eventId, dayId, resource.id, {
        name: name.trim(),
        color,
        supportsPresentations,
        pairedResourceId:
          !supportsPresentations && pairedResourceId !== NONE_VALUE ? pairedResourceId : null,
      });
      onChanged();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!resource) return;
    await scheduleApi.removeResource(eventId, dayId, resource.id);
    onChanged();
    handleOpenChange(false);
  }

  return (
    <>
      <Dialog open={!!resource} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-6 p-8 sm:max-w-md">
          <div className="grid gap-1.5">
            <DialogTitle className="text-xl font-medium">Editar recurso</DialogTitle>
            <DialogDescription>
              Ajuste o nome, se aceita apresentações, ou a pista a que este aquecimento atende.
            </DialogDescription>
          </div>

          {resource && (
            <form onSubmit={handleSubmit} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="edit-resource-name">Nome</Label>
                <Input
                  id="edit-resource-name"
                  autoFocus
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
                  <Select
                    value={pairedResourceId}
                    onValueChange={(value) => setPairedResourceId(value ?? NONE_VALUE)}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value: string) =>
                          value === NONE_VALUE
                            ? "Nenhuma"
                            : (sortedResources.find((r) => r.id === value)?.name ?? "Nenhuma")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                      {sortedResources
                        .filter((r) => r.id !== resource.id && r.supportsPresentations)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Excluir recurso
                </button>
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
                  {loading ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Remover recurso"
        description={`Remover "${resource?.name}"? Todos os itens agendados nessa linha também serão removidos.`}
        confirmLabel="Remover"
        confirmingLabel="Removendo..."
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
