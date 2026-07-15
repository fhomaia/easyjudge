import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { teamsApi, ApiError, type Team } from "@/api/client";

interface EditTeamDialogProps {
  eventId: string;
  programId: string;
  team: Team | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (team: Team) => void;
}

export function EditTeamDialog({
  eventId,
  programId,
  team,
  onOpenChange,
  onUpdated,
}: EditTeamDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setError(null);
    }
  }, [team]);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!team) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await teamsApi.update(eventId, programId, team.id, { name });
      onUpdated(updated);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={team !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Editar equipe</DialogTitle>
          <DialogDescription>Atualize o nome da equipe.</DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="edit-team-name">Nome da equipe</Label>
            <Input
              id="edit-team-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
