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
import { authApi, ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth";

interface ImpersonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImpersonateDialog({ open, onOpenChange }: ImpersonateDialogProps) {
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
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
      const { accessToken, impersonating } = await authApi.impersonate(email);
      startImpersonation(
        accessToken,
        `${impersonating.firstName} ${impersonating.lastName}`.trim(),
      );
      // Reload completo em vez de navigate() — várias telas só buscam
      // dados no mount, um reload garante que nada fica com estado da
      // identidade anterior (ver plano/CLAUDE.md).
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-7 p-10 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Entrar como outro usuário</DialogTitle>
          <DialogDescription>
            Digite o email de uma conta cadastrada pra ver a plataforma do ponto de vista dela.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="impersonate-email">E-mail do usuário</Label>
            <Input
              id="impersonate-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar como"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
