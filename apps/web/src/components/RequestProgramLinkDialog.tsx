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
import { athleteProgramsApi, ApiError, type AthleteLinkView } from "@/api/client";

interface RequestProgramLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (link: AthleteLinkView) => void;
}

export function RequestProgramLinkDialog({
  open,
  onOpenChange,
  onCreated,
}: RequestProgramLinkDialogProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const link = await athleteProgramsApi.request(email);
      onCreated(link);
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
          <DialogTitle className="text-xl font-medium">Vincular a um programa</DialogTitle>
          <DialogDescription>
            Informe o email do programa. O pedido fica pendente até o programa confirmar — se ele
            ainda não tem conta na plataforma, o vínculo é reclamado automaticamente quando ele se
            cadastrar com esse email.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="program-email">Email do programa</Label>
            <Input
              id="program-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enviando..." : "Pedir vínculo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
