import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface FunctionsSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  functions: string[];
}

// Mesmo espírito de JudgesSummaryDialog/ProgramsSummaryDialog ("clicar
// pra ver todos") — aqui pro card "Funções" da tela de Notas, quando o
// jurado está escalado em mais funções do que cabe no card (ver
// MetricTile.onExpand).
export function FunctionsSummaryDialog({ open, onOpenChange, functions }: FunctionsSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Suas funções neste evento</DialogTitle>
        <DialogDescription>
          {functions.length} {functions.length === 1 ? "função atribuída" : "funções atribuídas"} a você.
        </DialogDescription>

        <div className="-mx-1 max-h-80 divide-y divide-border overflow-y-auto">
          {functions.map((fn, index) => (
            <p key={`${fn}-${index}`} className="px-1 py-2.5 text-sm font-medium text-foreground">
              {fn}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
