import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/FormError";
import { ApiError } from "@/api/client";

interface WithdrawPresentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  // Só admin/assessor decide se remove do cronograma (ver
  // ScoringService.withdrawPresentation — programa nunca controla
  // isso). Sem essa opção, o programa só confirma a desistência
  // simples.
  canRemoveFromSchedule: boolean;
  onConfirm: (removeFromSchedule: boolean) => Promise<void>;
}

// Não reaproveita ConfirmDialog genérico de propósito — precisa do
// checkbox condicional "Remover também do cronograma", que o
// ConfirmDialog não suporta.
export function WithdrawPresentationDialog({
  open,
  onOpenChange,
  teamName,
  canRemoveFromSchedule,
  onConfirm,
}: WithdrawPresentationDialogProps) {
  const [removeFromSchedule, setRemoveFromSchedule] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setRemoveFromSchedule(false);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await onConfirm(canRemoveFromSchedule && removeFromSchedule);
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
          <DialogTitle className="text-xl font-medium">Sinalizar desistência?</DialogTitle>
          <DialogDescription>
            {`"${teamName}" deixa de poder ser avaliada. A apresentação continua aparecendo nas súmulas, marcada como desistência.`}
          </DialogDescription>
        </div>

        {canRemoveFromSchedule && (
          <label className="flex items-start gap-2 text-sm text-foreground">
            <Checkbox
              checked={removeFromSchedule}
              onCheckedChange={(value) => setRemoveFromSchedule(value === true)}
              className="mt-0.5"
            />
            <span>
              Remover também do cronograma
              <span className="block text-xs text-muted-foreground">
                Some da listagem do cronograma (mas continua nas súmulas).
              </span>
            </span>
          </label>
        )}

        <FormError message={error} />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Sinalizando..." : "Sinalizar desistência"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
