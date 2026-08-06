import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/FormError";
import { SchedulePositionRadioGroup } from "@/components/SchedulePositionRadioGroup";
import type { ComponentBlockDef } from "@/components/EventComponentsLibrary";
import { scheduleReferenceLabel } from "@/lib/scheduleEntryDisplay";
import { useSchedulePosition } from "@/lib/useSchedulePosition";
import { ApiError, scheduleApi, type ScheduleDay, type ScheduleEntry } from "@/api/client";

interface AddComponentEntryDialogProps {
  eventId: string;
  day: ScheduleDay | null;
  def: ComponentBlockDef | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (createdEntries: ScheduleEntry[]) => void;
}

// Aberto ao CLICAR (não arrastar) num bloco de "componente do evento"
// (Almoço, Contestação de notas, Abertura, Premiação) — mesmo padrão de
// AddUnscheduledEntryDialog, pro caso de a pista de destino não estar
// visível na tela sem rolar. "Intervalo personalizado" fica de fora de
// propósito (pedido do usuário 2026-08-06): ele já tem seu próprio popup
// (CustomIntervalDialog, que também pede nome/duração antes de criar).
export function AddComponentEntryDialog({
  eventId,
  day,
  def,
  onOpenChange,
  onCreated,
}: AddComponentEntryDialogProps) {
  const {
    resourceId,
    setResourceId,
    positionType,
    setPositionType,
    referenceEntryId,
    setReferenceEntryId,
    presentationResources,
    anchorEntries,
    computeOrder,
    reset,
  } = useSchedulePosition(day);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (def) {
      reset();
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    const order = computeOrder();
    if (order === null || !resourceId || !day || !def) return;
    setError(null);
    setLoading(true);
    try {
      const created = await scheduleApi.createEntry(eventId, day.id, {
        resourceId,
        type: def.type,
        order,
        durationMinutes: def.durationMinutes,
        label: def.label,
      });
      onCreated(created);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canConfirm = computeOrder() !== null && !!resourceId;

  return (
    <Dialog open={def !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Adicionar ao cronograma</DialogTitle>
          <DialogDescription>
            {def?.label ?? "Componente"} · {def?.durationMinutes ?? 0} min
          </DialogDescription>
        </div>

        <div className="grid gap-2">
          <Label>Pista</Label>
          <Select value={resourceId} onValueChange={(value) => value && setResourceId(value)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue className="truncate">
                {(value: string) =>
                  presentationResources.find((r) => r.id === value)?.name ?? "Selecione"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {presentationResources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3">
          <Label>Posição</Label>
          <SchedulePositionRadioGroup
            value={positionType}
            onChange={setPositionType}
            showBeforeAfter={anchorEntries.length > 0}
          />

          {(positionType === "before" || positionType === "after") && (
            <Select
              value={referenceEntryId || null}
              onValueChange={(value) => setReferenceEntryId(value as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    if (!value) return "Escolha o item de referência";
                    const anchor = anchorEntries.find(({ entry }) => entry.id === value);
                    return anchor ? scheduleReferenceLabel(anchor.entry) : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {anchorEntries.map(({ entry }) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {scheduleReferenceLabel(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <FormError message={error} />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !canConfirm}>
            {loading ? "Adicionando..." : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
