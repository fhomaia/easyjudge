import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/FormError";
import { eventsApi, ApiError, type Event } from "@/api/client";

interface JoinByCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (event: Event) => void;
}

// "Tenho um código" na Home — mesmo resultado de escanear o QR (ver
// ShareEventDialog/JoinEventPage), só que digitado à mão, pra quem já
// está logado.
export function JoinByCodeDialog({ open, onOpenChange, onJoined }: JoinByCodeDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCode("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const event = await eventsApi.joinByCode(code);
      onJoined(event);
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
          <DialogTitle className="text-xl font-medium">Tenho um código</DialogTitle>
          <DialogDescription>
            Digite o código do evento pra adicioná-lo à sua lista como espectador.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <Input
            autoFocus
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center font-mono text-lg tracking-wider uppercase"
          />
          <Button type="submit" disabled={loading || !code.trim()} className="w-full">
            {loading ? "Entrando..." : "Entrar no evento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
