import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { AthleteChecklist } from "@/components/AthleteChecklist";
import { athleteName, entryKey } from "@/lib/programAthletes";
import {
  programAthletesApi,
  ApiError,
  type ProgramAthlete,
  type Team,
} from "@/api/client";

interface AthleteEntriesDialogProps {
  eventId: string;
  programId: string;
  athlete: ProgramAthlete | null;
  teams: Team[];
  onOpenChange: (open: boolean) => void;
  onSaved: (athlete: ProgramAthlete) => void;
}

// Caminho inverso da tela da equipe: marca em quais equipe+categoria do
// programa o atleta compete.
export function AthleteEntriesDialog({
  eventId,
  programId,
  athlete,
  teams,
  onOpenChange,
  onSaved,
}: AthleteEntriesDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!athlete) return;
    setSelected(new Set(athlete.entries.map((e) => entryKey(e.teamId, e.categoryId))));
    setError(null);
  }, [athlete]);

  const items = teams.flatMap((team) =>
    team.categories.map((category) => ({
      id: entryKey(team.id, category.id),
      label: category.name,
      hint: `Equipe ${team.name}`,
    })),
  );

  async function handleSave() {
    if (!athlete) return;
    setError(null);
    setLoading(true);
    try {
      const entries = Array.from(selected).map((key) => {
        const [teamId, categoryId] = key.split(":");
        return { teamId, categoryId };
      });
      const saved = await programAthletesApi.setEntries(eventId, programId, athlete.id, entries);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={athlete !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-6 overflow-y-auto p-6 sm:max-w-lg sm:p-10">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Editar categorias</DialogTitle>
          <DialogDescription>
            {athlete ? athleteName(athlete) : ""}. O atleta pode competir em mais de uma
            categoria, inclusive por equipes diferentes.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <AthleteChecklist
          items={items}
          selected={selected}
          onChange={setSelected}
          searchPlaceholder="Buscar categoria ou equipe..."
          emptyMessage="Nenhuma equipe deste programa está inscrita em categorias ainda."
          countNoun={{ singular: "categoria selecionada", plural: "categorias selecionadas" }}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={loading || items.length === 0} onClick={handleSave}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
