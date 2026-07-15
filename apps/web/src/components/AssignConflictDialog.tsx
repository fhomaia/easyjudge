import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { BulkAssignStrategy } from "@/api/client";

export interface AssignConflictState {
  judgeName: string;
  groupName: string;
  leafCount: number;
}

interface AssignConflictDialogProps {
  state: AssignConflictState | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (strategy: BulkAssignStrategy) => void;
}

const STRATEGY_OPTIONS: Array<{ value: BulkAssignStrategy; label: string; description: string }> = [
  {
    value: "unassigned_only",
    label: "Apenas itens sem jurado",
    description: "Só atribui aos critérios que ainda não têm ninguém.",
  },
  {
    value: "replace",
    label: "Substituir atribuições existentes",
    description: "Remove os jurados atuais de todos os critérios do grupo.",
  },
  {
    value: "add",
    label: "Adicionar mantendo os jurados atuais",
    description: "Inclui este jurado em todos os critérios, sem remover ninguém.",
  },
];

export function AssignConflictDialog({ state, onOpenChange, onConfirm }: AssignConflictDialogProps) {
  const [strategy, setStrategy] = useState<BulkAssignStrategy>("add");

  function handleOpenChange(next: boolean) {
    if (next) setStrategy("add");
    onOpenChange(next);
  }

  return (
    <Dialog open={state !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-lg font-medium">
            Atribuir {state?.judgeName} aos {state?.leafCount} itens de {state?.groupName}
          </DialogTitle>
          <DialogDescription>
            Este grupo já tem jurados atribuídos em alguns critérios. Como continuar?
          </DialogDescription>
        </div>

        <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as BulkAssignStrategy)}>
          {STRATEGY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/30"
            >
              <RadioGroupItem value={option.value} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </RadioGroup>

        <Button
          onClick={() => {
            onConfirm(strategy);
            handleOpenChange(false);
          }}
        >
          Confirmar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
