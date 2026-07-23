import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getAvatarColor } from "@/lib/avatarColor";
import type { Judge } from "@/api/client";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

interface JudgesSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judges: Judge[] | null;
}

export function JudgesSummaryDialog({ open, onOpenChange, judges }: JudgesSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Jurados cadastrados</DialogTitle>
        <DialogDescription>
          {judges === null
            ? "Carregando..."
            : judges.length === 0
              ? "Nenhum jurado cadastrado neste evento ainda."
              : `${judges.length} ${judges.length === 1 ? "jurado" : "jurados"} neste evento.`}
        </DialogDescription>

        {judges && judges.length > 0 && (
          <div className="-mx-1 max-h-80 divide-y divide-border overflow-y-auto">
            {judges.map((judge) => (
              <div key={judge.id} className="flex items-center gap-3 px-1 py-2.5">
                <span
                  style={{ backgroundColor: getAvatarColor(judge.userId ?? judge.id) }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                >
                  {getInitials(judge.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {judge.name}
                    {!judge.userId && (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      >
                        Convite pendente
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{judge.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
