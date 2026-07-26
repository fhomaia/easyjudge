import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getAvatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Program, TeamWithProgram } from "@/api/client";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

interface ProgramsSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: Program[] | null;
  // Vem de teamsApi.listForEvent — um GET só pra todas as equipes do
  // evento, agrupadas aqui por programId (evita N chamadas, uma por
  // programa). `null` = ainda carregando/falhou; nesse caso o bloco de
  // equipes de cada programa vira "Carregando..." em vez de "0 equipes".
  teams: TeamWithProgram[] | null;
}

// Popup informativo (mesmo espírito de JudgesSummaryDialog) — programas
// e equipes do evento, admin/assessor. Sem navegação pra outra tela.
// Cada programa é colapsável (mesmo padrão de "categoria" em
// EventLiveResultsPage) — expandir mostra a lista de equipes daquele
// programa, não só a contagem do badge.
export function ProgramsSummaryDialog({ open, onOpenChange, programs, teams }: ProgramsSummaryDialogProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const teamsByProgram = useMemo(() => {
    const map = new Map<string, TeamWithProgram[]>();
    for (const team of teams ?? []) {
      const list = map.get(team.programId) ?? [];
      list.push(team);
      map.set(team.programId, list);
    }
    return map;
  }, [teams]);

  function toggle(programId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) next.delete(programId);
      else next.add(programId);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Programas cadastrados</DialogTitle>
        <DialogDescription>
          {programs === null
            ? "Carregando..."
            : programs.length === 0
              ? "Nenhum programa cadastrado neste evento ainda."
              : `${programs.length} ${programs.length === 1 ? "programa" : "programas"} neste evento.`}
        </DialogDescription>

        {programs && programs.length > 0 && (
          <div className="-mx-1 max-h-96 divide-y divide-border overflow-y-auto">
            {programs.map((program) => {
              const isExpanded = expandedIds.has(program.id);
              const programTeams = teamsByProgram.get(program.id) ?? [];
              return (
                <div key={program.id}>
                  <button
                    type="button"
                    onClick={() => toggle(program.id)}
                    className="flex w-full items-center gap-3 px-1 py-2.5 text-left"
                  >
                    <span
                      style={{ backgroundColor: getAvatarColor(program.userId ?? program.id) }}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    >
                      {getInitials(program.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{program.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{program.email}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-transparent bg-primary/10 text-primary">
                      {program.teamsCount ?? 0} {program.teamsCount === 1 ? "equipe" : "equipes"}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="pb-2 pl-12">
                      {teams === null ? (
                        <p className="py-1 text-xs text-muted-foreground">Carregando equipes...</p>
                      ) : programTeams.length === 0 ? (
                        <p className="py-1 text-xs text-muted-foreground">Nenhuma equipe cadastrada.</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {programTeams.map((team) => (
                            <li key={team.id} className="truncate text-sm text-foreground/80">
                              {team.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
