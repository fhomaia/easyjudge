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
import { scheduleReferenceLabel } from "@/lib/scheduleEntryDisplay";
import { useSchedulePosition } from "@/lib/useSchedulePosition";
import { ApiError, type ScheduleDay, type UnscheduledPair } from "@/api/client";

interface AddUnscheduledEntryDialogProps {
  pair: UnscheduledPair | null;
  day: ScheduleDay | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (resourceId: string, order: number) => Promise<void>;
}

// Aberto ao CLICAR (não arrastar) num card de "equipe não agendada" —
// alternativa ao drag-and-drop pra quando a pista de destino não está
// visível na tela sem rolar (mesmo motivo/padrão de
// PresentationDetailsDialog, que resolve o mesmo problema pro lado de
// MOVER uma apresentação já agendada; este dialog é o equivalente pro
// lado de ADICIONAR uma que ainda não está).
export function AddUnscheduledEntryDialog({
  pair,
  day,
  onOpenChange,
  onConfirm,
}: AddUnscheduledEntryDialogProps) {
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
    if (pair) {
      reset();
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    const order = computeOrder();
    if (order === null || !resourceId) return;
    setError(null);
    setLoading(true);
    try {
      await onConfirm(resourceId, order);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canConfirm = computeOrder() !== null && !!resourceId;

  return (
    <Dialog open={pair !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Adicionar ao cronograma</DialogTitle>
          <DialogDescription>
            {pair?.teamName ?? "Equipe"}
            {pair?.categoryName ? ` · ${pair.categoryName}` : ""}
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

        <div className="grid min-w-0 gap-3">
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
              <SelectTrigger className="w-full min-w-0">
                <SelectValue className="truncate">
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
