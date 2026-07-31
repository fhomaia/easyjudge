import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { supportApi, ApiError } from "@/api/client";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMessage("");
      setError(null);
      setSent(false);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await supportApi.contact(message);
      setSent(true);
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
          <DialogTitle className="text-xl font-medium">Preciso de ajuda</DialogTitle>
          <DialogDescription>
            {sent
              ? "Mensagem enviada — nossa equipe vai te responder por email."
              : "Descreva o que está acontecendo. Sua mensagem vai direto pro nosso email de suporte."}
          </DialogDescription>
        </div>

        {sent ? (
          <Button onClick={() => handleOpenChange(false)} className="w-full">
            Fechar
          </Button>
        ) : (
          <>
            <FormError message={error} />

            <form onSubmit={handleSubmit} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="help-message">Sua mensagem</Label>
                <Textarea
                  id="help-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="min-h-48"
                  maxLength={2000}
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
