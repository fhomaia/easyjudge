import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/FormError";
import { ApiError } from "@/api/client";

// Mesmos limites do backend (contestationImageUploadOptions e
// CONTESTATION_DESCRIPTION_MAX em ScoringService).
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DESCRIPTION = 1000;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface ContestationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  onConfirm: (input: { description: string; images: File[] }) => Promise<void>;
}

// Solicitar contestação (2026-09-28): descrição e imagens opcionais. Só
// imagem: vídeo e outros formatos são recusados na hora, com aviso.
export function ContestationDialog({ open, onOpenChange, teamName, onConfirm }: ContestationDialogProps) {
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function reset() {
    setDescription("");
    setImages([]);
    setWarning(null);
    setError(null);
  }

  // Fechar pelo X/Cancelar/fora é ignorado durante o envio.
  function handleOpenChange(next: boolean) {
    if (loading) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        const kind = file.type.startsWith("video/") ? "vídeo" : "arquivo";
        problems.push(`"${file.name}" é ${kind === "vídeo" ? "um vídeo" : "um formato não aceito"}.`);
      } else if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`"${file.name}" passa de 10 MB.`);
      } else {
        accepted.push(file);
      }
    }
    const room = MAX_IMAGES - images.length;
    if (accepted.length > room) {
      problems.push(`Dá pra anexar no máximo ${MAX_IMAGES} imagens.`);
    }
    setImages((prev) => [...prev, ...accepted.slice(0, Math.max(0, room))]);
    setWarning(
      problems.length > 0
        ? `${problems.join(" ")} Só é possível anexar imagens (JPG, PNG, WEBP ou GIF), até 10 MB cada.`
        : null,
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await onConfirm({ description, images });
      setLoading(false);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar a contestação. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md sm:p-8">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">Solicitar contestação</DialogTitle>
          <DialogDescription>
            {`Cada apresentação só pode ser contestada uma vez. Explique o motivo e, se quiser, anexe imagens para os jurados de "${teamName}".`}
          </DialogDescription>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="contestation-description" className="text-sm font-medium text-foreground">
            Descrição (opcional)
          </label>
          <Textarea
            id="contestation-description"
            value={description}
            maxLength={MAX_DESCRIPTION}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: a queda no stunt da contagem 3 não aconteceu."
            className="min-h-24"
          />
          <p className="text-right text-xs text-muted-foreground">
            {description.length}/{MAX_DESCRIPTION}
          </p>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Imagens (opcional)</span>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((file, i) => (
                <div key={previews[i]} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                  <img src={previews[i]} alt={file.name} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remover ${file.name}`}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < MAX_IMAGES && (
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
              <ImagePlus className="size-4" />
              Adicionar imagens
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {warning && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{warning}</p>}
        </div>

        <FormError message={error} />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Enviando..." : "Solicitar contestação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
