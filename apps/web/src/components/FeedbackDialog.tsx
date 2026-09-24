import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { StarRating } from "@/components/StarRating";
import { ApiError } from "@/api/client";

// Popup de avaliação (nota de 1 a 5 + comentário opcional), usado pela
// avaliação da plataforma e pela do evento. As duas continuam separadas:
// cada uma tem título, rota e tabela próprias.
export function FeedbackDialog({
  open,
  onOpenChange,
  title,
  description,
  initialRating = 0,
  initialComment = "",
  onSubmit,
  thanksMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialRating?: number;
  initialComment?: string;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  thanksMessage: string;
}) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Reabrir já mostra a avaliação atual (evento) ou volta limpo.
  useEffect(() => {
    if (open) {
      setRating(initialRating);
      setComment(initialComment);
      setError(null);
      setSent(false);
    }
  }, [open, initialRating, initialComment]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(rating, comment.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 p-8 sm:max-w-md">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">{title}</DialogTitle>
          <DialogDescription>{sent ? thanksMessage : description}</DialogDescription>
        </div>

        {sent ? (
          <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <StarRating value={rating} onChange={setRating} className="justify-center" />
            <div className="grid gap-2">
              <Label htmlFor="feedback-comment">Comentário (opcional)</Label>
              <Textarea
                id="feedback-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Conte o que achou, o que funcionou e o que pode melhorar."
              />
            </div>
            <FormError message={error} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar avaliação"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
