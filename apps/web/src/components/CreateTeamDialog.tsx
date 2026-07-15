import { useState, type FormEvent } from "react";
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

interface CreateTeamDialogProps {
  eventId: string;
  programId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (team: Team) => void;
}

export function CreateTeamDialog({
  eventId,
  programId,
  open,
  onOpenChange,
  onCreated,
}: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setName("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const team = await teamsApi.create(eventId, programId, { name });
      onCreated(team);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Nova equipe</DialogTitle>
          <DialogDescription>
            Cadastre uma equipe do programa. As categorias são vinculadas depois.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="team-name">Nome da equipe</Label>
            <Input
              id="team-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar equipe"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
