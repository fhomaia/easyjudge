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
import { athletesApi, ApiError, type AthleteLinkView } from "@/api/client";

interface CreateAthleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (athlete: AthleteLinkView) => void;
}

export function CreateAthleteDialog({ open, onOpenChange, onCreated }: CreateAthleteDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
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
      const athlete = await athletesApi.create({ firstName, lastName, email });
      onCreated(athlete);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-lg">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Adicionar atleta</DialogTitle>
          <DialogDescription>
            Cadastre um atleta no seu elenco. Se ele ainda não tem conta na plataforma, o vínculo
            fica pronto e é reclamado automaticamente quando ele se cadastrar com esse email.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="athlete-first-name">Nome</Label>
              <Input
                id="athlete-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-last-name">Sobrenome</Label>
              <Input
                id="athlete-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="athlete-email">Email</Label>
            <Input
              id="athlete-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Adicionando..." : "Adicionar atleta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
