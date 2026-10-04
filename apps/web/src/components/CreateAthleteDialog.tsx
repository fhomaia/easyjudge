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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setFullName("");
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
      // Um campo só de nome completo; a API continua recebendo nome e
      // sobrenome, separados no primeiro espaço (mesma regra de
      // CreateEventStaffMemberDialog). O `pattern` do campo garante as
      // duas partes.
      const name = fullName.trim().replace(/\s+/g, " ");
      const i = name.indexOf(" ");
      const athlete = await athletesApi.create({
        firstName: name.slice(0, i),
        lastName: name.slice(i + 1),
        email,
      });
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
      <DialogContent className="max-h-[92dvh] gap-7 overflow-y-auto p-6 sm:max-w-lg sm:p-10">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Adicionar atleta</DialogTitle>
          <DialogDescription>
            Cadastre um atleta no seu elenco. Se ele ainda não tem conta na plataforma, o vínculo
            fica pronto e é reclamado automaticamente quando ele se cadastrar com esse email.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="athlete-full-name">Nome completo</Label>
            <Input
              id="athlete-full-name"
              placeholder="Nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              pattern="\s*\S+\s+\S.*"
              title="Informe o nome completo (nome e sobrenome)."
              required
            />
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
